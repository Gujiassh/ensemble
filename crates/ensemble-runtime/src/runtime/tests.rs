use std::{
    fs, future, io,
    path::PathBuf,
    pin::Pin,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    task::{Context, Poll},
    time::Duration,
};

use tempfile::tempdir;
use tokio::{sync::oneshot, time::sleep};

use super::{RuntimeConfig, run_until, run_until_with_listener};
use crate::{ReadyDescriptor, data_root::LockedDataRoot};

const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[tokio::test]
async fn injected_listener_failure_is_honest_and_releases_the_lock() {
    let temporary = tempdir().expect("temporary directory");
    let token_file = temporary.path().join("secret-token-path-marker");
    let ready_file = temporary.path().join("private-ready-path-marker.json");
    let data_root = temporary.path().join("private-data-root-path-marker");
    let stale_ready = b"preexisting-ready-bytes";
    fs::write(&token_file, TOKEN).expect("write token");
    fs::write(&ready_file, stale_ready).expect("write preexisting ready bytes");
    let config = RuntimeConfig {
        data_root: data_root.clone(),
        session_token_file: token_file.clone(),
        ready_file: ready_file.clone(),
    };

    let error = run_until_with_listener(
        config.clone(),
        future::pending(),
        future::ready(Err(io::Error::new(
            io::ErrorKind::AddrNotAvailable,
            "injected listener failure",
        ))),
    )
    .await
    .expect_err("listener failure must stop bootstrap");
    assert_eq!(error.code(), "listener_bind");
    assert_eq!(
        fs::read(&ready_file).expect("read preserved ready"),
        stale_ready
    );
    let diagnostic = format!("runtime_failed code={}", error.code());
    for forbidden in [
        TOKEN,
        data_root.to_string_lossy().as_ref(),
        token_file.to_string_lossy().as_ref(),
        ready_file.to_string_lossy().as_ref(),
    ] {
        assert!(!diagnostic.contains(forbidden));
    }

    let (stop, stopped) = oneshot::channel();
    let restarted = tokio::spawn(run_until(config, async move {
        let _ = stopped.await;
    }));
    wait_for_ready_descriptor(&ready_file).await;
    stop.send(()).expect("request restarted Runtime stop");
    restarted
        .await
        .expect("join restarted Runtime")
        .expect("stop restarted Runtime");
    assert!(!ready_file.exists());
}

#[tokio::test]
async fn already_requested_shutdown_publishes_no_ready_and_releases_the_data_root() {
    let temporary = tempdir().expect("temporary directory");
    let token_file = temporary.path().join("token");
    let ready_file = temporary.path().join("runtime.ready.json");
    let data_root = temporary.path().join("data");
    fs::write(&token_file, TOKEN).expect("write token");
    let config = RuntimeConfig {
        data_root: data_root.clone(),
        session_token_file: token_file,
        ready_file: ready_file.clone(),
    };

    run_until(config, future::ready(()))
        .await
        .expect("already-requested shutdown is clean");
    assert!(!ready_file.exists());
    let reacquired = LockedDataRoot::acquire(&data_root).expect("shutdown released data-root lock");
    drop(reacquired);
}

#[tokio::test]
async fn pending_shutdown_is_first_polled_before_ready_publication() {
    let temporary = tempdir().expect("temporary directory");
    let token_file = temporary.path().join("token");
    let ready_file = temporary.path().join("runtime.ready.json");
    fs::write(&token_file, TOKEN).expect("write token");
    let config = RuntimeConfig {
        data_root: temporary.path().join("data"),
        session_token_file: token_file,
        ready_file: ready_file.clone(),
    };
    let (stop, stopped) = oneshot::channel();
    let first_polled = Arc::new(AtomicBool::new(false));
    let probe = ShutdownPollProbe {
        ready_file: ready_file.clone(),
        first_polled: Arc::clone(&first_polled),
        stopped,
    };

    let runtime = tokio::spawn(run_until(config, probe));
    wait_for_ready_descriptor(&ready_file).await;
    assert!(first_polled.load(Ordering::SeqCst));
    stop.send(()).expect("request Runtime stop");
    runtime.await.expect("join Runtime").expect("stop Runtime");
}

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

    for _ in 0..2 {
        let (stop, stopped) = oneshot::channel();
        let runtime = tokio::spawn(run_until(config.clone(), async move {
            let _ = stopped.await;
        }));
        wait_for_ready_descriptor(&ready_file).await;
        stop.send(()).expect("request Runtime stop");
        runtime.await.expect("join Runtime").expect("stop Runtime");
        assert!(!ready_file.exists());
    }
}

struct ShutdownPollProbe {
    ready_file: PathBuf,
    first_polled: Arc<AtomicBool>,
    stopped: oneshot::Receiver<()>,
}

impl Future for ShutdownPollProbe {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<Self::Output> {
        if !self.first_polled.swap(true, Ordering::SeqCst) {
            assert!(
                !self.ready_file.exists(),
                "shutdown must be registered before ready is observable"
            );
        }
        Pin::new(&mut self.stopped).poll(context).map(|_| ())
    }
}

async fn wait_for_ready_descriptor(path: &std::path::Path) -> ReadyDescriptor {
    for _ in 0..100 {
        if let Ok(contents) = fs::read(path)
            && let Ok(descriptor) = serde_json::from_slice(&contents)
        {
            return descriptor;
        }
        sleep(Duration::from_millis(10)).await;
    }
    panic!("ready descriptor did not appear");
}
