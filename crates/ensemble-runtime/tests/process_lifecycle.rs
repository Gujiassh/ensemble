mod support;

use std::{fs, process::Command};

use ensemble_runtime::ReadyDescriptor;
use serde_json::{Value, json};
use support::{
    RuntimeProcess, TOKEN, TestWorkspace, WRONG_TOKEN, assert_flat_runtime_logs,
    assert_no_secret_or_path, assert_no_valid_ready, bearer, request, run_failure, runtime_command,
};

#[test]
fn standalone_binary_runs_with_tooling_removed_from_its_environment() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("raw-data-root-path-marker");
    let ready_file = workspace.path("raw-ready-path-marker.json");
    let mut runtime =
        RuntimeProcess::spawn_without_environment(&data_root, &workspace.token_file, &ready_file);

    let ready = runtime.wait_ready(&ready_file);
    assert_ready_identity(&ready, runtime.id());
    assert_health(&ready, TOKEN);

    #[cfg(target_os = "linux")]
    {
        let children = fs::read_to_string(format!("/proc/{0}/task/{0}/children", runtime.id()))
            .expect("inspect Runtime child process list");
        assert!(
            children.trim().is_empty(),
            "Runtime spawned a child process"
        );
    }

    let captured = stop_runtime(runtime, &ready_file);
    assert_flat_runtime_logs(&captured);
}

#[test]
fn syntactic_aliases_contend_on_one_canonical_data_root() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("canonical-data-root");
    fs::create_dir_all(&data_root).expect("create canonical data root");
    let alias = data_root.join("..").join("canonical-data-root");
    let first_ready = workspace.path("first.ready.json");
    let second_ready = workspace.path("second.ready.json");

    let mut first = RuntimeProcess::spawn(&data_root, &workspace.token_file, &first_ready);
    let first_descriptor = first.wait_ready(&first_ready);
    let second = run_failure(runtime_command(
        &alias,
        &workspace.token_file,
        &second_ready,
    ));
    second.assert_code("data_root_locked");
    assert_no_valid_ready(&second_ready);
    assert_health(&first_descriptor, TOKEN);

    let first_capture = stop_runtime(first, &first_ready);
    assert_flat_runtime_logs(&first_capture);
    assert_flat_runtime_logs(&second);
}

#[test]
fn distinct_data_roots_run_concurrently_with_isolated_health_identity() {
    let workspace = TestWorkspace::new();
    let first_root = workspace.path("first-data-root");
    let second_root = workspace.path("second-data-root");
    let first_ready = workspace.path("first.ready.json");
    let second_ready = workspace.path("second.ready.json");
    let mut first = RuntimeProcess::spawn(&first_root, &workspace.token_file, &first_ready);
    let mut second = RuntimeProcess::spawn(&second_root, &workspace.token_file, &second_ready);

    let first_descriptor = first.wait_ready(&first_ready);
    let second_descriptor = second.wait_ready(&second_ready);
    assert_ne!(first_descriptor.port, second_descriptor.port);
    assert_ne!(
        first_descriptor.data_root_digest,
        second_descriptor.data_root_digest
    );
    assert_health(&first_descriptor, TOKEN);
    assert_health(&second_descriptor, TOKEN);

    stop_runtime(first, &first_ready);
    stop_runtime(second, &second_ready);
}

#[test]
fn every_route_requires_authentication_and_health_is_exact_and_versioned() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("raw-data-root-path-marker");
    let ready_file = workspace.path("raw-ready-path-marker.json");
    let mut runtime = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let ready = runtime.wait_ready(&ready_file);

    let wrong_bearer = bearer(WRONG_TOKEN);
    for authorization in [
        None,
        Some("Bearer"),
        Some("Basic malformed-credential-marker"),
        Some(wrong_bearer.as_str()),
    ] {
        let response = request(ready.port, "GET", "/v1/health", authorization, "");
        assert_eq!(response.status, 401);
        assert_eq!(response.header("www-authenticate"), Some("Bearer"));
    }

    assert_health(&ready, TOKEN);
    let protected_unknown = request(ready.port, "GET", "/not-a-route", None, "");
    assert_eq!(protected_unknown.status, 401);
    assert_eq!(protected_unknown.header("www-authenticate"), Some("Bearer"));
    let authorized_unknown = request(
        ready.port,
        "POST",
        "/not-a-route",
        Some(&bearer(TOKEN)),
        "request-body-secret-marker",
    );
    assert_eq!(authorized_unknown.status, 404);

    let serialized_ready = fs::read_to_string(&ready_file).expect("read ready descriptor text");
    for forbidden in [TOKEN, WRONG_TOKEN, "request-body-secret-marker"] {
        assert!(!serialized_ready.contains(forbidden));
    }
    for path in [&data_root, &workspace.token_file, &ready_file] {
        assert!(!serialized_ready.contains(path.to_string_lossy().as_ref()));
    }

    let captured = stop_runtime(runtime, &ready_file);
    assert_no_secret_or_path(
        &captured,
        &[&data_root, &workspace.token_file, &ready_file],
        &[
            TOKEN,
            WRONG_TOKEN,
            "malformed-credential-marker",
            "request-body-secret-marker",
        ],
    );
    assert_flat_runtime_logs(&captured);
}

#[test]
fn observable_ready_descriptors_are_atomic_and_immediately_usable() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("repeated-data-root");
    let ready_file = workspace.path("repeated.ready.json");

    for _ in 0..12 {
        assert!(!ready_file.exists());
        let mut runtime = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
        let ready = runtime.wait_ready(&ready_file);
        assert_ready_identity(&ready, runtime.id());
        assert_health(&ready, TOKEN);
        stop_runtime(runtime, &ready_file);
        assert!(!ready_file.exists());
    }
}

#[cfg(unix)]
#[test]
fn ready_observation_then_immediate_sigterm_is_graceful_across_repeated_startups() {
    const TRIALS: usize = 24;

    let workspace = TestWorkspace::new();
    let data_root = workspace.path("immediate-signal-data-root-path-marker");
    let ready_file = workspace.path("immediate-signal-ready-path-marker.json");

    for _ in 0..TRIALS {
        assert!(!ready_file.exists());
        let mut runtime = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
        let expected_pid = runtime.id();
        let ready = runtime.wait_ready(&ready_file);
        let captured = runtime.terminate();

        assert!(captured.status.success());
        assert_ready_identity(&ready, expected_pid);
        assert!(!ready_file.exists());
        assert!(captured.stderr.contains("ready_removed=true"));
        assert_no_secret_or_path(
            &captured,
            &[&data_root, &workspace.token_file, &ready_file],
            &[TOKEN],
        );
        assert_flat_runtime_logs(&captured);
    }

    let mut restarted = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let restarted_ready = restarted.wait_ready(&ready_file);
    assert_health(&restarted_ready, TOKEN);
    let captured = restarted.terminate();
    assert!(captured.status.success());
    assert!(!ready_file.exists());
}

#[cfg(unix)]
#[test]
fn sigterm_removes_owned_ready_releases_lock_and_allows_restart() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("restart-data-root");
    let ready_file = workspace.path("restart.ready.json");

    let mut first = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let first_ready = first.wait_ready(&ready_file);
    assert_health(&first_ready, TOKEN);
    let first_capture = first.terminate();
    assert!(first_capture.status.success());
    assert!(!ready_file.exists());
    assert!(first_capture.stderr.contains("ready_removed=true"));
    assert!(!first_capture.stderr.contains("runtime_http_drain_expired"));

    let mut restarted = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let restarted_ready = restarted.wait_ready(&ready_file);
    assert_eq!(
        first_ready.data_root_digest,
        restarted_ready.data_root_digest
    );
    assert_health(&restarted_ready, TOKEN);
    let restarted_capture = restarted.terminate();
    assert!(restarted_capture.status.success());
    assert!(
        !restarted_capture
            .stderr
            .contains("runtime_http_drain_expired")
    );
    assert!(!ready_file.exists());
}

#[cfg(unix)]
#[test]
fn graceful_shutdown_preserves_a_replacement_ready_descriptor() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("replacement-data-root");
    let ready_file = workspace.path("replacement.ready.json");
    let mut runtime = RuntimeProcess::spawn(&data_root, &workspace.token_file, &ready_file);
    let original = runtime.wait_ready(&ready_file);
    let replacement = ReadyDescriptor {
        pid: original.pid.wrapping_add(1),
        ..original
    };
    fs::write(
        &ready_file,
        serde_json::to_vec(&replacement).expect("serialize replacement descriptor"),
    )
    .expect("write replacement descriptor");

    let captured = runtime.terminate();
    assert!(
        captured.status.success(),
        "replacement-preserving shutdown failed: {}",
        captured.stderr
    );
    assert!(captured.stderr.contains("ready_removed=false"));
    let remaining: ReadyDescriptor = serde_json::from_slice(
        &fs::read(&ready_file).expect("read preserved replacement descriptor"),
    )
    .expect("parse preserved replacement descriptor");
    assert_eq!(remaining, replacement);
    fs::remove_file(ready_file).expect("remove test replacement descriptor");
}

#[test]
fn cli_exposes_no_host_or_port_override() {
    let help = Command::new(env!("CARGO_BIN_EXE_ensemble-runtime"))
        .arg("--help")
        .output()
        .expect("run Runtime help");
    assert!(help.status.success());
    let help = String::from_utf8(help.stdout).expect("Runtime help is UTF-8");
    assert!(!help.contains("--host"));
    assert!(!help.contains("--port"));

    let workspace = TestWorkspace::new();
    for forbidden in ["--host", "--port"] {
        let ready_file = workspace.path(&format!("{forbidden}.ready.json"));
        let mut command = runtime_command(
            &workspace.path("cli-data-root"),
            &workspace.token_file,
            &ready_file,
        );
        command.arg(forbidden).arg("0");
        let captured = run_failure(command);
        assert!(!captured.status.success());
        assert_no_valid_ready(&ready_file);
    }
}

fn assert_ready_identity(ready: &ReadyDescriptor, expected_pid: u32) {
    assert_eq!(ready.protocol_version, "1");
    assert_eq!(ready.pid, expected_pid);
    assert_eq!(ready.host, "127.0.0.1");
    assert_ne!(ready.port, 0);
    assert_eq!(ready.data_root_digest.len(), 64);
    chrono::DateTime::parse_from_rfc3339(&ready.started_at)
        .expect("ready descriptor startedAt is RFC 3339");
}

fn assert_health(ready: &ReadyDescriptor, token: &str) {
    let response = request(ready.port, "GET", "/v1/health", Some(&bearer(token)), "");
    assert_eq!(response.status, 200);
    let actual: Value = serde_json::from_str(&response.body).expect("parse health JSON");
    assert_eq!(
        actual,
        json!({
            "protocolVersion": "1",
            "runtimeVersion": env!("CARGO_PKG_VERSION"),
            "status": "ok",
            "pid": ready.pid,
            "dataRootDigest": ready.data_root_digest,
        })
    );
}

fn stop_runtime(runtime: RuntimeProcess, ready_file: &std::path::Path) -> support::CapturedProcess {
    #[cfg(unix)]
    {
        let captured = runtime.terminate();
        assert!(captured.status.success(), "graceful test cleanup failed");
        assert!(!ready_file.exists());
        captured
    }
    #[cfg(not(unix))]
    {
        let captured = runtime.kill();
        if ready_file.exists() {
            fs::remove_file(ready_file).expect("remove ready after forced test cleanup");
        }
        captured
    }
}
