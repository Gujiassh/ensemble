use std::{future::Future, time::Duration};

use axum::Router;
use hyper::server::conn::http1;
use hyper_util::{rt::TokioIo, service::TowerToHyperService};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::watch,
    task::{JoinError, JoinSet},
    time::{Instant, timeout},
};

use crate::RuntimeError;

const HTTP_DRAIN_TIMEOUT: Duration = Duration::from_secs(1);

pub(crate) async fn serve_owned<F>(
    listener: TcpListener,
    app: Router,
    shutdown: F,
    pid: u32,
) -> Result<(), RuntimeError>
where
    F: Future<Output = ()>,
{
    let (shutdown_connections, _) = watch::channel(false);
    let mut connections = JoinSet::new();
    let mut accept_error = None;
    let mut task_failed = false;
    tokio::pin!(shutdown);

    loop {
        tokio::select! {
            biased;
            () = shutdown.as_mut() => break,
            accepted = listener.accept() => {
                match accepted {
                    Ok((stream, _)) => spawn_connection(
                        &mut connections,
                        stream,
                        app.clone(),
                        shutdown_connections.subscribe(),
                    ),
                    Err(error) => {
                        accept_error = Some(error);
                        break;
                    }
                }
            }
            joined = connections.join_next(), if !connections.is_empty() => {
                if joined.is_some_and(join_failed) {
                    task_failed = true;
                    break;
                }
            }
        }
    }

    drop(listener);
    let _ = shutdown_connections.send(true);
    let deadline = Instant::now() + HTTP_DRAIN_TIMEOUT;
    while !connections.is_empty() {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        match timeout(remaining, connections.join_next()).await {
            Ok(Some(joined)) => task_failed |= join_failed(joined),
            Ok(None) => break,
            Err(_) => break,
        }
    }

    if !connections.is_empty() {
        eprintln!(
            "runtime_http_drain_expired pid={} timeout_ms={} remaining_connections={}",
            pid,
            HTTP_DRAIN_TIMEOUT.as_millis(),
            connections.len()
        );
        connections.abort_all();
        while let Some(joined) = connections.join_next().await {
            if let Err(error) = joined
                && !error.is_cancelled()
            {
                task_failed = true;
            }
        }
    }

    if let Some(error) = accept_error {
        return Err(RuntimeError::Server(error));
    }
    if task_failed {
        return Err(RuntimeError::ServerTask);
    }
    Ok(())
}

fn spawn_connection(
    connections: &mut JoinSet<()>,
    stream: TcpStream,
    app: Router,
    shutdown: watch::Receiver<bool>,
) {
    connections.spawn(async move {
        let _ = serve_connection(stream, app, shutdown).await;
    });
}

async fn serve_connection(
    stream: TcpStream,
    app: Router,
    mut shutdown: watch::Receiver<bool>,
) -> Result<(), hyper::Error> {
    let service = TowerToHyperService::new(app);
    let connection = http1::Builder::new().serve_connection(TokioIo::new(stream), service);
    tokio::pin!(connection);

    if *shutdown.borrow() {
        connection.as_mut().graceful_shutdown();
        return connection.await;
    }

    tokio::select! {
        result = connection.as_mut() => result,
        changed = shutdown.changed() => {
            if changed.is_ok() && *shutdown.borrow() {
                connection.as_mut().graceful_shutdown();
            }
            connection.await
        }
    }
}

fn join_failed(result: Result<(), JoinError>) -> bool {
    result.is_err_and(|error| !error.is_cancelled())
}
