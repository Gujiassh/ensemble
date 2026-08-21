use std::{fs, io::ErrorKind, time::Duration};

use ensemble_runtime::{ReadyDescriptor, RuntimeConfig, run_until};
use tempfile::tempdir;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    sync::oneshot,
    task::JoinSet,
    time::{Instant, sleep, timeout},
};

const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn expired_drain_joins_owned_connections_before_runtime_returns() {
    let temporary = tempdir().expect("temporary directory");
    let token_file = temporary.path().join("session-token");
    let ready_file = temporary.path().join("runtime.ready.json");
    fs::write(&token_file, TOKEN).expect("write token");
    let config = RuntimeConfig {
        data_root: temporary.path().join("data"),
        session_token_file: token_file,
        ready_file: ready_file.clone(),
    };

    let (stop, stopped) = oneshot::channel();
    let runtime = tokio::spawn(run_until(config.clone(), async move {
        let _ = stopped.await;
    }));
    let ready = wait_for_ready(&ready_file).await;
    let mut held_open = TcpStream::connect((ready.host.as_str(), ready.port))
        .await
        .expect("connect incomplete request");
    held_open
        .write_all(
            b"GET /v1/health HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer held-open-secret-marker",
        )
        .await
        .expect("write incomplete request");
    sleep(Duration::from_millis(150)).await;

    let started = Instant::now();
    stop.send(()).expect("request shutdown");
    timeout(Duration::from_secs(3), runtime)
        .await
        .expect("owned server drain is bounded")
        .expect("join Runtime")
        .expect("Runtime shutdown succeeds");
    assert!(started.elapsed() >= Duration::from_millis(800));
    assert!(!ready_file.exists());
    assert_peer_closed(&mut held_open).await;

    let (stop, stopped) = oneshot::channel();
    let restarted = tokio::spawn(run_until(config, async move {
        let _ = stopped.await;
    }));
    let restarted_ready = wait_for_ready(&ready_file).await;
    assert_authenticated_health(&restarted_ready).await;
    stop.send(()).expect("request ordinary shutdown");
    timeout(Duration::from_secs(2), restarted)
        .await
        .expect("ordinary shutdown is bounded")
        .expect("join restarted Runtime")
        .expect("ordinary shutdown succeeds");
    assert!(!ready_file.exists());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn shutdown_remains_bounded_under_accept_pressure_and_closes_every_client() {
    const CLIENTS: usize = 48;

    let temporary = tempdir().expect("temporary directory");
    let token_file = temporary.path().join("session-token");
    let ready_file = temporary.path().join("runtime.ready.json");
    fs::write(&token_file, TOKEN).expect("write token");
    let config = RuntimeConfig {
        data_root: temporary.path().join("data"),
        session_token_file: token_file,
        ready_file: ready_file.clone(),
    };
    let (stop, stopped) = oneshot::channel();
    let runtime = tokio::spawn(run_until(config, async move {
        let _ = stopped.await;
    }));
    let ready = wait_for_ready(&ready_file).await;

    let mut clients = Vec::with_capacity(CLIENTS);
    for index in 0..CLIENTS {
        let mut stream = TcpStream::connect((ready.host.as_str(), ready.port))
            .await
            .expect("connect pressure client");
        stream
            .write_all(
                format!("GET /v1/health HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Pressure: {index}")
                    .as_bytes(),
            )
            .await
            .expect("write incomplete pressure request");
        clients.push(stream);
    }
    sleep(Duration::from_millis(150)).await;

    let started = Instant::now();
    stop.send(()).expect("request pressure shutdown");
    timeout(Duration::from_secs(3), runtime)
        .await
        .expect("pressure shutdown is bounded")
        .expect("join pressure Runtime")
        .expect("pressure shutdown succeeds");
    assert!(started.elapsed() >= Duration::from_millis(800));
    assert!(!ready_file.exists());

    let mut closed_clients = JoinSet::new();
    for mut client in clients {
        closed_clients.spawn(async move {
            assert_peer_closed(&mut client).await;
        });
    }
    while let Some(joined) = closed_clients.join_next().await {
        joined.expect("join client closure assertion");
    }
}

async fn wait_for_ready(path: &std::path::Path) -> ReadyDescriptor {
    for _ in 0..800 {
        if let Ok(bytes) = fs::read(path)
            && let Ok(ready) = serde_json::from_slice(&bytes)
        {
            return ready;
        }
        sleep(Duration::from_millis(5)).await;
    }
    panic!("ready descriptor did not appear");
}

async fn assert_peer_closed(stream: &mut TcpStream) {
    let mut byte = [0_u8; 1];
    match timeout(Duration::from_millis(500), stream.read(&mut byte)).await {
        Ok(Ok(0)) => {}
        Ok(Err(error))
            if matches!(
                error.kind(),
                ErrorKind::ConnectionReset | ErrorKind::ConnectionAborted | ErrorKind::BrokenPipe
            ) => {}
        Ok(Ok(_)) => panic!("aborted connection delivered unexpected response bytes"),
        Ok(Err(error)) => panic!("aborted connection returned unexpected error: {error}"),
        Err(_) => panic!("owned connection socket remained open after run_until returned"),
    }
}

async fn assert_authenticated_health(ready: &ReadyDescriptor) {
    let mut stream = TcpStream::connect((ready.host.as_str(), ready.port))
        .await
        .expect("connect restarted health request");
    let request = format!(
        "GET /v1/health HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {TOKEN}\r\nConnection: close\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .await
        .expect("write restarted health request");
    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .await
        .expect("read restarted health response");
    let response = String::from_utf8(response).expect("health response is UTF-8");
    assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
    assert!(response.contains(&format!("\"pid\":{}", ready.pid)));
}
