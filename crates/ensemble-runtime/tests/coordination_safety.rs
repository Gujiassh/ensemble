mod support;

use std::fs;

#[cfg(unix)]
use std::{
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    thread,
    time::{Duration, Instant},
};

use serde_json::Value;
use support::{
    RuntimeProcess, TOKEN, TestWorkspace, assert_flat_runtime_logs, assert_no_secret_or_path,
    assert_no_valid_ready, bearer, request, run_failure, runtime_command,
};

#[test]
fn ready_paths_inside_the_data_root_are_rejected_for_exact_and_alias_forms() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("protected-data-root");
    fs::create_dir_all(&data_root).expect("create protected data root");
    let exact_ready = data_root.join(".ensemble-runtime.lock");
    let alias_ready = data_root
        .join("..")
        .join("protected-data-root")
        .join("alias.ready.json");

    for ready_file in [&exact_ready, &alias_ready] {
        let captured = run_failure(runtime_command(
            &data_root,
            &workspace.token_file,
            ready_file,
        ));
        captured.assert_code("ready_inside_data_root");
        assert_no_valid_ready(ready_file);
        assert_no_secret_or_path(
            &captured,
            &[&data_root, &workspace.token_file, ready_file],
            &[TOKEN],
        );
        assert_flat_runtime_logs(&captured);
    }

    let first_ready = workspace.path("normal.ready.json");
    let contender_ready = workspace.path("contender.ready.json");
    let mut first = RuntimeProcess::spawn(&data_root, &workspace.token_file, &first_ready);
    let first_descriptor = first.wait_ready(&first_ready);
    let contender = run_failure(runtime_command(
        &data_root,
        &workspace.token_file,
        &contender_ready,
    ));
    contender.assert_code("data_root_locked");
    assert_health(&first_descriptor, TOKEN);
    finish_runtime(first, &first_ready);
}

#[test]
fn shared_ready_path_is_exclusive_and_a_dead_owners_stale_descriptor_is_replaceable() {
    let workspace = TestWorkspace::new();
    let first_root = workspace.path("first-root");
    let second_root = workspace.path("second-root");
    let shared_ready = workspace.path("shared.ready.json");
    let mut first = RuntimeProcess::spawn(&first_root, &workspace.token_file, &shared_ready);
    let first_descriptor = first.wait_ready(&shared_ready);
    let first_bytes = fs::read(&shared_ready).expect("read first ready descriptor");

    let collision = run_failure(runtime_command(
        &second_root,
        &workspace.token_file,
        &shared_ready,
    ));
    collision.assert_code("ready_path_locked");
    assert_eq!(
        fs::read(&shared_ready).expect("read unchanged shared descriptor"),
        first_bytes
    );
    assert_health(&first_descriptor, TOKEN);
    assert_no_secret_or_path(
        &collision,
        &[&second_root, &workspace.token_file, &shared_ready],
        &[TOKEN],
    );

    let killed = first.kill();
    assert!(!killed.status.success());
    assert!(shared_ready.is_file());
    let stale_bytes = fs::read(&shared_ready).expect("read stale descriptor");

    let recovered = RuntimeProcess::spawn(&second_root, &workspace.token_file, &shared_ready);
    let recovered_pid = recovered.id();
    let recovered_descriptor = wait_for_replacement(&shared_ready, &stale_bytes);
    assert_eq!(recovered_descriptor.pid, recovered_pid);
    assert_ne!(
        stale_bytes,
        fs::read(&shared_ready).expect("read replacement descriptor")
    );
    assert_health(&recovered_descriptor, TOKEN);
    finish_runtime(recovered, &shared_ready);
}

#[cfg(unix)]
#[test]
fn incomplete_http_request_cannot_hold_graceful_shutdown_beyond_the_drain_bound() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("slow-request-data-root-path-marker");
    let ready_file = workspace.path("slow-request-ready-path-marker.json");
    let mut runtime = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let ready = runtime.wait_ready(&ready_file);
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, ready.port);
    let mut held_open = TcpStream::connect(address).expect("connect held-open request");
    held_open
        .write_all(
            b"GET /v1/health HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer held-open-request-secret-marker",
        )
        .expect("write incomplete HTTP request");
    thread::sleep(Duration::from_millis(150));

    let started = Instant::now();
    let captured = runtime.terminate();
    let elapsed = started.elapsed();
    assert!(captured.status.success());
    assert!(elapsed < Duration::from_secs(3));
    assert!(captured.stderr.contains("runtime_http_drain_expired pid="));
    assert!(captured.stderr.contains("timeout_ms=1000"));
    assert!(!ready_file.exists());
    assert_no_secret_or_path(
        &captured,
        &[&data_root, &workspace.token_file, &ready_file],
        &[TOKEN, "held-open-request-secret-marker"],
    );
    assert_flat_runtime_logs(&captured);
    assert_socket_closed(&mut held_open);

    let mut restarted = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let restarted_ready = restarted.wait_ready(&ready_file);
    assert_health(&restarted_ready, TOKEN);
    finish_runtime(restarted, &ready_file);
}

#[cfg(unix)]
fn assert_socket_closed(stream: &mut TcpStream) {
    stream
        .set_read_timeout(Some(Duration::from_millis(500)))
        .expect("set held-open socket read timeout");
    let mut byte = [0_u8; 1];
    match stream.read(&mut byte) {
        Ok(0) => {}
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::ConnectionReset
                    | std::io::ErrorKind::ConnectionAborted
                    | std::io::ErrorKind::BrokenPipe
            ) => {}
        Ok(_) => panic!("aborted connection delivered unexpected response bytes"),
        Err(error) => panic!("held-open socket remained usable: {error}"),
    }
}

fn wait_for_replacement(
    ready_file: &std::path::Path,
    stale_bytes: &[u8],
) -> ensemble_runtime::ReadyDescriptor {
    let deadline = std::time::Instant::now() + support::PROCESS_TIMEOUT;
    loop {
        if let Ok(bytes) = fs::read(ready_file)
            && bytes != stale_bytes
        {
            return serde_json::from_slice(&bytes).expect("replacement ready is complete JSON");
        }
        assert!(
            std::time::Instant::now() < deadline,
            "stale ready descriptor was not replaced before the bounded deadline"
        );
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
}

fn assert_health(ready: &ensemble_runtime::ReadyDescriptor, token: &str) {
    let response = request(ready.port, "GET", "/v1/health", Some(&bearer(token)), "");
    assert_eq!(response.status, 200);
    let body: Value = serde_json::from_str(&response.body).expect("parse health response");
    assert_eq!(body["pid"], ready.pid);
    assert_eq!(body["dataRootDigest"], ready.data_root_digest);
}

fn finish_runtime(runtime: RuntimeProcess, ready_file: &std::path::Path) {
    #[cfg(unix)]
    {
        let captured = runtime.terminate();
        assert!(captured.status.success());
        assert!(!ready_file.exists());
    }
    #[cfg(not(unix))]
    {
        let captured = runtime.kill();
        assert!(!captured.status.success());
        if ready_file.exists() {
            fs::remove_file(ready_file).expect("remove forced-cleanup ready descriptor");
        }
    }
}
