use std::fs;

use tempfile::tempdir;

use super::{READY_LEASE_SUFFIX, ReadyDescriptor, ReadyFileGuard, ReadyPathLease};

fn descriptor(pid: u32) -> ReadyDescriptor {
    ReadyDescriptor {
        protocol_version: "1".to_owned(),
        pid,
        host: "127.0.0.1".to_owned(),
        port: 32100,
        data_root_digest: "a".repeat(64),
        started_at: "2026-08-20T00:00:00Z".to_owned(),
    }
}

#[test]
fn publishes_complete_json_and_removes_only_its_own_descriptor() {
    let temporary = tempdir().expect("temporary directory");
    let data_root = temporary.path().join("data");
    fs::create_dir(&data_root).expect("create data root");
    let path = temporary.path().join("runtime.ready.json");
    let expected = descriptor(std::process::id());
    let lease = ReadyPathLease::acquire(&path, &data_root).expect("acquire ready lease");
    let mut guard = ReadyFileGuard::publish(lease, expected.clone()).expect("publish descriptor");

    let actual: ReadyDescriptor =
        serde_json::from_slice(&fs::read(&path).expect("read descriptor"))
            .expect("parse descriptor");
    assert_eq!(actual, expected);
    assert!(guard.remove_if_owned().expect("remove owned descriptor"));
    assert!(!path.exists());
}

#[test]
fn preserves_a_replacement_descriptor() {
    let temporary = tempdir().expect("temporary directory");
    let data_root = temporary.path().join("data");
    fs::create_dir(&data_root).expect("create data root");
    let path = temporary.path().join("runtime.ready.json");
    let lease = ReadyPathLease::acquire(&path, &data_root).expect("acquire ready lease");
    let mut guard = ReadyFileGuard::publish(lease, descriptor(10)).expect("publish");
    fs::write(
        &path,
        serde_json::to_vec(&descriptor(11)).expect("serialize replacement"),
    )
    .expect("replace descriptor");

    assert!(!guard.remove_if_owned().expect("ownership check"));
    assert!(path.exists());
}

#[test]
fn ready_path_lease_is_exclusive_persistent_and_reacquirable() {
    let temporary = tempdir().expect("temporary directory");
    let data_root = temporary.path().join("data");
    fs::create_dir(&data_root).expect("create data root");
    let path = temporary.path().join("runtime.ready.json");
    let first = ReadyPathLease::acquire(&path, &data_root).expect("first ready lease");
    let lease_path = temporary
        .path()
        .join(format!("runtime.ready.json{READY_LEASE_SUFFIX}"));

    let error = match ReadyPathLease::acquire(&path, &data_root) {
        Ok(_) => panic!("concurrent ready lease was accepted"),
        Err(error) => error,
    };
    assert_eq!(error.code(), "ready_path_locked");
    drop(first);
    assert!(lease_path.is_file(), "persistent lease file was unlinked");
    ReadyPathLease::acquire(&path, &data_root).expect("reacquire released ready lease");
}
