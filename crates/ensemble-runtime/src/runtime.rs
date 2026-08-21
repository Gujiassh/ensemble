use std::{
    future::{Future, poll_fn},
    net::Ipv4Addr,
    path::PathBuf,
    task::Poll,
};

use chrono::{SecondsFormat, Utc};
use tokio::net::TcpListener;

use crate::{
    PROTOCOL_VERSION, RuntimeError,
    auth::SessionToken,
    cli::Cli,
    data_root::LockedDataRoot,
    http_server,
    ready::{ReadyDescriptor, ReadyFileGuard, ReadyPathLease},
    server,
};

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub data_root: PathBuf,
    pub session_token_file: PathBuf,
    pub ready_file: PathBuf,
}

impl From<Cli> for RuntimeConfig {
    fn from(value: Cli) -> Self {
        Self {
            data_root: value.data_root,
            session_token_file: value.session_token_file,
            ready_file: value.ready_file,
        }
    }
}

pub async fn run_until<F>(config: RuntimeConfig, shutdown: F) -> Result<(), RuntimeError>
where
    F: Future<Output = ()> + Send + 'static,
{
    run_until_with_listener(
        config,
        shutdown,
        TcpListener::bind((Ipv4Addr::LOCALHOST, 0)),
    )
    .await
}

async fn run_until_with_listener<F, L>(
    config: RuntimeConfig,
    shutdown: F,
    listener: L,
) -> Result<(), RuntimeError>
where
    F: Future<Output = ()> + Send + 'static,
    L: Future<Output = std::io::Result<TcpListener>>,
{
    let token = SessionToken::load(&config.session_token_file)?;
    let data_root = LockedDataRoot::acquire(&config.data_root)?;
    eprintln!(
        "runtime_lock_acquired data_root_digest={}",
        data_root.digest()
    );
    let ready_lease = ReadyPathLease::acquire(&config.ready_file, data_root.canonical_path())?;

    let listener = listener.await.map_err(RuntimeError::ListenerBind)?;
    let address = listener
        .local_addr()
        .map_err(RuntimeError::ListenerAddress)?;
    let pid = std::process::id();
    let descriptor = ReadyDescriptor {
        protocol_version: PROTOCOL_VERSION.to_owned(),
        pid,
        host: Ipv4Addr::LOCALHOST.to_string(),
        port: address.port(),
        data_root_digest: data_root.digest().to_owned(),
        started_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
    };
    let app = server::router(token, PROTOCOL_VERSION, pid, data_root.digest());

    // Register shutdown before ready publication so an immediate signal is handled gracefully.
    let mut shutdown = Box::pin(shutdown);
    let shutdown_already_requested =
        poll_fn(|context| Poll::Ready(shutdown.as_mut().poll(context).is_ready())).await;
    if shutdown_already_requested {
        eprintln!("runtime_shutdown_requested pid={pid}");
        return Ok(());
    }

    let mut ready = ReadyFileGuard::publish(ready_lease, descriptor)?;
    eprintln!(
        "runtime_ready protocol_version={} pid={} host={} port={} data_root_digest={}",
        PROTOCOL_VERSION,
        pid,
        Ipv4Addr::LOCALHOST,
        address.port(),
        data_root.digest()
    );

    let shutdown = async move {
        shutdown.await;
        eprintln!("runtime_shutdown_requested pid={pid}");
    };
    http_server::serve_owned(listener, app, shutdown, pid).await?;

    let removed = ready.remove_if_owned()?;
    eprintln!("runtime_stopped pid={} ready_removed={}", pid, removed);
    drop(ready);
    drop(data_root);
    Ok(())
}

#[cfg(test)]
mod tests;
