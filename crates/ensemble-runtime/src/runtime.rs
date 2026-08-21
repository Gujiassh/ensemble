use std::{future::Future, net::Ipv4Addr, path::PathBuf};

use chrono::{SecondsFormat, Utc};
use tokio::net::TcpListener;

use crate::{
    PROTOCOL_VERSION, RuntimeError,
    auth::SessionToken,
    cli::Cli,
    data_root::LockedDataRoot,
    ready::{ReadyDescriptor, ReadyFileGuard},
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
    let token = SessionToken::load(&config.session_token_file)?;
    let data_root = LockedDataRoot::acquire(&config.data_root)?;
    eprintln!(
        "runtime_lock_acquired data_root_digest={}",
        data_root.digest()
    );

    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(RuntimeError::ListenerBind)?;
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
    let mut ready = ReadyFileGuard::publish(config.ready_file, descriptor)?;
    eprintln!(
        "runtime_ready protocol_version={} pid={} host={} port={} data_root_digest={}",
        PROTOCOL_VERSION,
        pid,
        Ipv4Addr::LOCALHOST,
        address.port(),
        data_root.digest()
    );

    let app = server::router(token, PROTOCOL_VERSION, pid, data_root.digest());
    let shutdown = async move {
        shutdown.await;
        eprintln!("runtime_shutdown_requested pid={pid}");
    };
    let server_result = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await;
    if let Err(error) = server_result {
        return Err(RuntimeError::Server(error));
    }

    let removed = ready.remove_if_owned()?;
    eprintln!("runtime_stopped pid={} ready_removed={}", pid, removed);
    drop(data_root);
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{fs, time::Duration};

    use tempfile::tempdir;
    use tokio::{sync::oneshot, time::sleep};

    use super::{RuntimeConfig, run_until};

    const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[tokio::test]
    async fn injected_graceful_shutdown_removes_ready_and_releases_lock() {
        let temporary = tempdir().expect("temporary directory");
        let token_file = temporary.path().join("token");
        let ready_file = temporary.path().join("runtime.ready.json");
        let data_root = temporary.path().join("data");
        fs::write(&token_file, TOKEN).expect("write token");
        let config = RuntimeConfig {
            data_root,
            session_token_file: token_file,
            ready_file: ready_file.clone(),
        };

        let (stop, stopped) = oneshot::channel();
        let first = tokio::spawn(run_until(config.clone(), async move {
            let _ = stopped.await;
        }));
        wait_for_file(&ready_file).await;
        stop.send(()).expect("request stop");
        first.await.expect("join Runtime").expect("stop Runtime");
        assert!(!ready_file.exists());

        let (stop, stopped) = oneshot::channel();
        let restarted = tokio::spawn(run_until(config, async move {
            let _ = stopped.await;
        }));
        wait_for_file(&ready_file).await;
        stop.send(()).expect("request restart stop");
        restarted
            .await
            .expect("join restarted Runtime")
            .expect("stop restarted Runtime");
        assert!(!ready_file.exists());
    }

    async fn wait_for_file(path: &std::path::Path) {
        for _ in 0..100 {
            if path.is_file() {
                return;
            }
            sleep(Duration::from_millis(10)).await;
        }
        panic!("ready descriptor did not appear");
    }
}
