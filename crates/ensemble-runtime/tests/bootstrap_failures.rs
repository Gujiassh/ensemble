mod support;

use std::{fs, path::Path};

use ensemble_runtime::ReadyDescriptor;
use support::{
    RuntimeProcess, TOKEN, TestWorkspace, assert_flat_runtime_logs, assert_no_secret_or_path,
    assert_no_valid_ready, bearer, request, run_failure, runtime_command,
};

#[test]
fn invalid_token_inputs_fail_with_stable_codes_and_no_ready_descriptor() {
    let workspace = TestWorkspace::new();
    let cases = [
        ("missing", "token_metadata"),
        ("short", "token_too_short"),
        ("malformed", "token_invalid"),
        ("padding-only", "token_invalid"),
        ("oversized", "token_too_large"),
        ("directory", "token_not_file"),
    ];

    for (name, expected_code) in cases {
        let token_file = workspace.path(&format!("{name}-secret-token-path"));
        match name {
            "missing" => {}
            "short" => fs::write(&token_file, "short").expect("write short token"),
            "malformed" => fs::write(
                &token_file,
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc def",
            )
            .expect("write malformed token"),
            "padding-only" => {
                fs::write(&token_file, "=".repeat(64)).expect("write padding-only token")
            }
            "oversized" => {
                fs::write(&token_file, "a".repeat(16 * 1024 + 1)).expect("write oversized token")
            }
            "directory" => fs::create_dir(&token_file).expect("create token path directory"),
            _ => unreachable!("all token cases are enumerated"),
        }
        let data_root = workspace.path(&format!("{name}-data-root"));
        let ready_file = workspace.path(&format!("{name}.ready.json"));
        let captured = run_failure(runtime_command(&data_root, &token_file, &ready_file));

        captured.assert_code(expected_code);
        assert_no_valid_ready(&ready_file);
        assert_no_secret_or_path(&captured, &[&data_root, &token_file, &ready_file], &[TOKEN]);
        assert_flat_runtime_logs(&captured);
    }
}

#[test]
fn invalid_and_uncreatable_data_roots_fail_honestly() {
    let workspace = TestWorkspace::new();
    let root_file = workspace.path("data-root-file-marker");
    fs::write(&root_file, "not a directory").expect("write data-root blocker file");
    let nested_under_file = root_file.join("cannot-exist");

    for (data_root, expected_code, ready_name) in [
        (
            &root_file,
            "data_root_not_directory",
            "root-file.ready.json",
        ),
        (
            &nested_under_file,
            "data_root_create",
            "uncreatable.ready.json",
        ),
    ] {
        let ready_file = workspace.path(ready_name);
        let captured = run_failure(runtime_command(
            data_root,
            &workspace.token_file,
            &ready_file,
        ));
        captured.assert_code(expected_code);
        assert_no_valid_ready(&ready_file);
        assert_no_secret_or_path(
            &captured,
            &[data_root, &workspace.token_file, &ready_file],
            &[TOKEN],
        );
        assert_flat_runtime_logs(&captured);
    }
}

#[test]
fn invalid_ready_parent_and_publish_collision_release_the_data_root_lock() {
    let workspace = TestWorkspace::new();
    let data_root = workspace.path("ready-failure-data-root");
    let missing_parent_ready = workspace.path("missing-parent/runtime.ready.json");
    let first = run_failure(runtime_command(
        &data_root,
        &workspace.token_file,
        &missing_parent_ready,
    ));
    first.assert_code("ready_parent_invalid");
    assert_no_valid_ready(&missing_parent_ready);

    let directory_ready = workspace.path("ready-path-is-directory");
    fs::create_dir(&directory_ready).expect("create ready destination directory");
    let second = run_failure(runtime_command(
        &data_root,
        &workspace.token_file,
        &directory_ready,
    ));
    second.assert_code("ready_publish");
    assert_no_valid_ready(&directory_ready);

    let valid_ready = workspace.path("recovered.ready.json");
    let mut recovered = RuntimeProcess::spawn(&data_root, &workspace.token_file, &valid_ready);
    let descriptor = recovered.wait_ready(&valid_ready);
    let health = request(
        descriptor.port,
        "GET",
        "/v1/health",
        Some(&bearer(TOKEN)),
        "",
    );
    assert_eq!(health.status, 200);
    stop_runtime(recovered, &valid_ready);
}

#[test]
fn bootstrap_failure_does_not_disturb_an_existing_ready_descriptor() {
    let workspace = TestWorkspace::new();
    let ready_file = workspace.path("replacement.ready.json");
    let replacement = ReadyDescriptor {
        protocol_version: "1".to_owned(),
        pid: 42,
        host: "127.0.0.1".to_owned(),
        port: 31000,
        data_root_digest: "a".repeat(64),
        started_at: "2026-08-21T00:00:00.000Z".to_owned(),
    };
    let replacement_bytes = serde_json::to_vec(&replacement).expect("serialize replacement");
    fs::write(&ready_file, &replacement_bytes).expect("write replacement ready descriptor");
    let missing_token = workspace.path("missing-secret-token-path");

    let captured = run_failure(runtime_command(
        &workspace.path("unused-data-root"),
        &missing_token,
        &ready_file,
    ));
    captured.assert_code("token_metadata");
    assert_eq!(
        fs::read(&ready_file).expect("read preserved descriptor"),
        replacement_bytes
    );
}

fn stop_runtime(runtime: RuntimeProcess, ready_file: &Path) {
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
