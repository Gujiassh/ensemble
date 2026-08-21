//! Python runtime supervisor for Ensemble desktop shell.
//!
//! Spawns `python -m ensemble_runtime` bound to 127.0.0.1:18427 when health
//! fails, and kills the owned process tree on app exit.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const RUNTIME_HOST: &str = "127.0.0.1";
const RUNTIME_PORT: u16 = 18427;
const HEALTH_PATH: &str = "/health";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(1);
const STARTUP_WAIT: Duration = Duration::from_secs(20);
const STARTUP_POLL: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub healthy: bool,
    pub owned: bool,
    pub pid: Option<u32>,
    pub url: String,
    pub detail: String,
}

pub struct RuntimeSupervisor {
    inner: Mutex<Inner>,
    repo_root: PathBuf,
}

struct Inner {
    /// Child we spawned (None if we attached to an already-running runtime).
    child: Option<Child>,
    owned: bool,
}

impl RuntimeSupervisor {
    pub fn new(repo_root: PathBuf) -> Self {
        Self {
            inner: Mutex::new(Inner {
                child: None,
                owned: false,
            }),
            repo_root,
        }
    }

    pub fn status(&self) -> RuntimeStatus {
        let healthy = health_ok();
        let guard = self.inner.lock().expect("runtime mutex");
        let pid = guard.child.as_ref().map(|c| c.id());
        RuntimeStatus {
            healthy,
            owned: guard.owned,
            pid,
            url: format!("http://{RUNTIME_HOST}:{RUNTIME_PORT}"),
            detail: if healthy {
                if guard.owned {
                    "runtime healthy (spawned by shell)".into()
                } else {
                    "runtime healthy (external / already running)".into()
                }
            } else if guard.owned {
                "runtime not healthy (owned child may still be starting or crashed)".into()
            } else {
                "runtime not healthy".into()
            },
        }
    }

    /// Ensure runtime is up: reuse healthy instance, else spawn.
    pub fn ensure_started(&self) -> Result<RuntimeStatus, String> {
        if health_ok() {
            return Ok(self.status());
        }

        {
            let mut guard = self.inner.lock().expect("runtime mutex");
            // Reap a dead owned child before respawn.
            if let Some(child) = guard.child.as_mut() {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        guard.child = None;
                        guard.owned = false;
                    }
                    Ok(None) => {
                        // Still running but not healthy yet — wait below.
                    }
                    Err(e) => return Err(format!("try_wait failed: {e}")),
                }
            }

            if guard.child.is_none() {
                let child = spawn_runtime(&self.repo_root)?;
                guard.child = Some(child);
                guard.owned = true;
            }
        }

        wait_until_healthy(STARTUP_WAIT)?;
        Ok(self.status())
    }

    pub fn restart(&self) -> Result<RuntimeStatus, String> {
        self.shutdown();
        std::thread::sleep(Duration::from_millis(300));
        self.ensure_started()
    }

    /// Kill owned runtime process tree. Safe to call multiple times.
    pub fn shutdown(&self) {
        let mut guard = self.inner.lock().expect("runtime mutex");
        if let Some(mut child) = guard.child.take() {
            let pid = child.id();
            eprintln!("[ensemble-shell] stopping owned runtime pid={pid}");
            kill_process_tree(pid);
            let _ = child.wait();
        }
        guard.owned = false;
    }
}

impl Drop for RuntimeSupervisor {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn runtime_python(repo_root: &Path) -> PathBuf {
    repo_root.join("services/runtime/.venv/bin/python")
}

fn data_dir(repo_root: &Path) -> PathBuf {
    repo_root.join("data")
}

fn spawn_runtime(repo_root: &Path) -> Result<Child, String> {
    let python = runtime_python(repo_root);
    if !python.exists() {
        return Err(format!(
            "runtime venv python missing: {} (create with services/runtime .venv)",
            python.display()
        ));
    }

    let cwd = repo_root.join("services/runtime");
    let data = data_dir(repo_root);
    std::fs::create_dir_all(&data).map_err(|e| format!("create data dir: {e}"))?;

    eprintln!(
        "[ensemble-shell] spawning runtime python={} cwd={} data={}",
        python.display(),
        cwd.display(),
        data.display()
    );

    let mut cmd = Command::new(&python);
    cmd.arg("-m")
        .arg("ensemble_runtime")
        .current_dir(&cwd)
        .env("ENSEMBLE_DATA_DIR", &data)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Own process group so exit can kill the whole tree (uvicorn workers etc.).
    #[cfg(unix)]
    configure_owned_process_group(&mut cmd);

    cmd.spawn()
        .map_err(|e| format!("spawn ensemble_runtime failed: {e}"))
}

#[cfg(unix)]
fn configure_owned_process_group(command: &mut Command) {
    use std::os::unix::process::CommandExt;

    // SAFETY: The closure captures no state and, after fork, only calls the
    // async-signal-safe `setpgid(0, 0)`. On failure it constructs the OS error
    // value expected by `pre_exec`; it performs no allocation, locking, or access
    // to state that may have been held by another thread at fork time.
    unsafe {
        command.pre_exec(unix_pg::become_process_group_leader);
    }
}

#[cfg(unix)]
mod unix_pg {
    use std::io;

    unsafe extern "C" {
        fn setpgid(pid: i32, pgid: i32) -> i32;
        fn killpg(pgid: i32, sig: i32) -> i32;
    }

    #[derive(Clone, Copy)]
    pub enum Signal {
        Terminate,
        Kill,
    }

    impl Signal {
        const fn as_raw(self) -> i32 {
            match self {
                Self::Terminate => 15,
                Self::Kill => 9,
            }
        }
    }

    pub fn become_process_group_leader() -> io::Result<()> {
        // SAFETY: Zero for both arguments is defined by POSIX to select the
        // calling process and its own PID. `setpgid` takes only integer values,
        // dereferences no Rust memory, and is async-signal-safe for `pre_exec`.
        if unsafe { setpgid(0, 0) } == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }

    pub fn signal_process_group(pgid: u32, signal: Signal) -> io::Result<()> {
        let pgid = i32::try_from(pgid)
            .ok()
            .filter(|pgid| *pgid > 0)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "invalid process group"))?;

        // SAFETY: `pgid` was checked to be a positive `pid_t`, so `killpg`
        // cannot select the caller's group through the special zero value. The
        // private caller supplies the PID of a still-owned child whose `pre_exec`
        // path made that PID its process-group ID. The signal is a POSIX constant,
        // and `killpg` dereferences no Rust memory.
        if unsafe { killpg(pgid, signal.as_raw()) } == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }
}

#[cfg(unix)]
fn kill_process_tree(pid: u32) {
    let _ = unix_pg::signal_process_group(pid, unix_pg::Signal::Terminate);
    std::thread::sleep(Duration::from_millis(400));
    let _ = unix_pg::signal_process_group(pid, unix_pg::Signal::Kill);
}

#[cfg(not(unix))]
fn kill_process_tree(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

fn wait_until_healthy(budget: Duration) -> Result<(), String> {
    let start = Instant::now();
    while start.elapsed() < budget {
        if health_ok() {
            return Ok(());
        }
        std::thread::sleep(STARTUP_POLL);
    }
    Err(format!(
        "runtime did not become healthy at http://{RUNTIME_HOST}:{RUNTIME_PORT}{HEALTH_PATH} within {budget:?}"
    ))
}

/// Minimal HTTP GET /health against loopback — no extra HTTP crate.
pub fn health_ok() -> bool {
    let addr = format!("{RUNTIME_HOST}:{RUNTIME_PORT}");
    let Ok(mut stream) =
        TcpStream::connect_timeout(&addr.parse().expect("runtime addr"), HEALTH_TIMEOUT)
    else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(HEALTH_TIMEOUT));
    let _ = stream.set_write_timeout(Some(HEALTH_TIMEOUT));

    let req = format!(
        "GET {HEALTH_PATH} HTTP/1.1\r\nHost: {RUNTIME_HOST}:{RUNTIME_PORT}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }

    let mut buf = Vec::with_capacity(256);
    let mut tmp = [0u8; 256];
    for _ in 0..8 {
        match stream.read(&mut tmp) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&tmp[..n]);
                if buf.windows(4).any(|w| w == b"\r\n\r\n") || buf.len() > 512 {
                    break;
                }
            }
            Err(_) => break,
        }
    }

    let text = String::from_utf8_lossy(&buf);
    text.starts_with("HTTP/1.1 200") || text.starts_with("HTTP/1.0 200")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_ok_is_false_when_nothing_listens() {
        // If a real runtime is already up on :18427 this would be true — skip then.
        if TcpStream::connect_timeout(
            &format!("{RUNTIME_HOST}:{RUNTIME_PORT}").parse().unwrap(),
            Duration::from_millis(50),
        )
        .is_ok()
        {
            eprintln!("skip: something already listens on :18427");
            return;
        }
        assert!(!health_ok());
    }

    #[test]
    fn resolve_paths_match_monorepo_layout() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repo root")
            .to_path_buf();
        assert!(root.join("package.json").is_file());
        assert!(root.join("apps/canvas").is_dir());
        assert!(root.join("services/runtime").is_dir());
        assert_eq!(
            runtime_python(&root),
            root.join("services/runtime/.venv/bin/python")
        );
        assert_eq!(data_dir(&root), root.join("data"));
    }

    #[cfg(unix)]
    #[test]
    fn process_group_signal_rejects_zero_pgid() {
        let error = unix_pg::signal_process_group(0, unix_pg::Signal::Terminate)
            .expect_err("zero must not select the caller's process group");
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
    }

    #[cfg(unix)]
    const FIXTURE_BUDGET: Duration = Duration::from_secs(2);

    #[cfg(unix)]
    struct ProcessGroupFixture {
        leader: Option<Child>,
        temp_dir: PathBuf,
    }

    #[cfg(unix)]
    impl ProcessGroupFixture {
        fn terminate_and_reap(&mut self) -> Result<std::process::ExitStatus, String> {
            let leader = self.leader.as_mut().expect("fixture leader");
            kill_process_tree(leader.id());
            let status = wait_for_child_exit(leader, FIXTURE_BUDGET)
                .map_err(|error| format!("inspect fixture leader: {error}"))?
                .ok_or_else(|| "fixture leader did not exit after process-group kill".to_owned())?;
            self.leader = None;
            Ok(status)
        }
    }

    #[cfg(unix)]
    impl Drop for ProcessGroupFixture {
        fn drop(&mut self) {
            if let Some(mut leader) = self.leader.take() {
                // Signal the group before any wait can reap the leader and release
                // its PID. This keeps the group identity unavailable for reuse.
                kill_process_tree(leader.id());
                if !matches!(
                    wait_for_child_exit(&mut leader, FIXTURE_BUDGET),
                    Ok(Some(_))
                ) {
                    let _ = leader.kill();
                    let _ = wait_for_child_exit(&mut leader, FIXTURE_BUDGET);
                }
            }
            let _ = std::fs::remove_dir_all(&self.temp_dir);
        }
    }

    #[cfg(unix)]
    fn wait_for_child_exit(
        child: &mut Child,
        budget: Duration,
    ) -> std::io::Result<Option<std::process::ExitStatus>> {
        let deadline = Instant::now() + budget;
        loop {
            if let Some(status) = child.try_wait()? {
                return Ok(Some(status));
            }
            if Instant::now() >= deadline {
                return Ok(None);
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[cfg(unix)]
    fn wait_for_file(path: &Path, budget: Duration) -> Result<String, String> {
        let deadline = Instant::now() + budget;
        loop {
            match std::fs::read_to_string(path) {
                Ok(value) if !value.trim().is_empty() => return Ok(value),
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(format!("read {}: {error}", path.display())),
            }
            if Instant::now() >= deadline {
                return Err(format!("timed out waiting for {}", path.display()));
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    #[cfg(unix)]
    #[test]
    fn kill_process_tree_terminates_owned_descendant() {
        use std::sync::mpsc;
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock after Unix epoch")
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!(
            "ensemble-process-group-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir(&temp_dir).expect("create process-group fixture directory");
        let pid_file = temp_dir.join("descendant.pid");
        let ready_file = temp_dir.join("descendant.ready");

        let mut command = Command::new("sh");
        command
            .args([
                "-c",
                r#"sh -c 'printf ready > "$ENSEMBLE_CHILD_READY_FILE"; exec sleep 5' &
descendant=$!
trap '' TERM
printf '%s\n' "$descendant" > "$ENSEMBLE_CHILD_PID_FILE"
wait "$descendant""#,
            ])
            .env("ENSEMBLE_CHILD_PID_FILE", &pid_file)
            .env("ENSEMBLE_CHILD_READY_FILE", &ready_file)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        configure_owned_process_group(&mut command);

        let mut fixture = ProcessGroupFixture {
            leader: None,
            temp_dir,
        };
        fixture.leader = Some(command.spawn().expect("spawn owned process-group fixture"));
        let leader = fixture.leader.as_mut().expect("fixture leader");
        let leader_pid = leader.id();
        let mut stdout = leader.stdout.take().expect("fixture stdout");
        let (stdout_closed_tx, stdout_closed_rx) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let mut sink = std::io::sink();
            let result = std::io::copy(&mut stdout, &mut sink).map(|_| ());
            let _ = stdout_closed_tx.send(result);
        });

        let descendant_pid = wait_for_file(&pid_file, FIXTURE_BUDGET)
            .expect("capture descendant PID")
            .trim()
            .parse::<u32>()
            .expect("descendant PID is an integer");
        assert_ne!(descendant_pid, 0);
        assert_ne!(descendant_pid, leader_pid);
        assert_eq!(
            wait_for_file(&ready_file, FIXTURE_BUDGET)
                .expect("descendant readiness")
                .trim(),
            "ready"
        );
        assert!(matches!(
            stdout_closed_rx.try_recv(),
            Err(mpsc::TryRecvError::Empty)
        ));

        let status = fixture
            .terminate_and_reap()
            .expect("terminate and reap fixture leader");
        assert!(!status.success());

        // The descendant keeps this pipe open across exec for its full lifetime.
        // EOF therefore proves that exact process exited, without querying a PID
        // that could have been reused after the leader reaped it.
        stdout_closed_rx
            .recv_timeout(FIXTURE_BUDGET)
            .expect("descendant kept stdout open after process-group kill")
            .expect("read fixture stdout");
    }
}
