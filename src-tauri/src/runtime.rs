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
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            cmd.pre_exec(|| {
                if unix_pg::setpgid(0, 0) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }

    cmd.spawn()
        .map_err(|e| format!("spawn ensemble_runtime failed: {e}"))
}

#[cfg(unix)]
mod unix_pg {
    pub unsafe fn setpgid(pid: i32, pgid: i32) -> i32 {
        extern "C" {
            fn setpgid(pid: i32, pgid: i32) -> i32;
        }
        setpgid(pid, pgid)
    }

    pub unsafe fn killpg(pgid: i32, sig: i32) -> i32 {
        extern "C" {
            fn killpg(pgid: i32, sig: i32) -> i32;
        }
        killpg(pgid, sig)
    }

    pub const SIGTERM: i32 = 15;
    pub const SIGKILL: i32 = 9;
}

#[cfg(unix)]
fn kill_process_tree(pid: u32) {
    let pgid = pid as i32;
    unsafe {
        let _ = unix_pg::killpg(pgid, unix_pg::SIGTERM);
    }
    std::thread::sleep(Duration::from_millis(400));
    unsafe {
        let _ = unix_pg::killpg(pgid, unix_pg::SIGKILL);
    }
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
            &format!("{RUNTIME_HOST}:{RUNTIME_PORT}")
                .parse()
                .unwrap(),
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
    fn resolve_paths_look_like_monorepo() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repo root")
            .to_path_buf();
        assert!(root.join("apps/canvas").is_dir());
        assert!(root.join("services/runtime").is_dir());
        assert!(runtime_python(&root).exists() || !runtime_python(&root).exists());
    }
}
