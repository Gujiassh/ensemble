#![allow(dead_code)] // Each integration test compiles this shared fixture as a separate crate.

use std::{
    fs,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    path::{Path, PathBuf},
    process::{Child, ChildStderr, ChildStdout, Command, ExitStatus, Stdio},
    thread,
    time::{Duration, Instant},
};

use ensemble_runtime::ReadyDescriptor;
use tempfile::{TempDir, tempdir};

pub const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
pub const WRONG_TOKEN: &str = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
pub const PROCESS_TIMEOUT: Duration = Duration::from_secs(8);

pub struct TestWorkspace {
    temporary: TempDir,
    pub token_file: PathBuf,
}

impl TestWorkspace {
    pub fn new() -> Self {
        let temporary = tempdir().expect("create black-box temporary directory");
        let token_file = temporary.path().join("session-token-secret-path-marker");
        fs::write(&token_file, TOKEN).expect("write black-box session token");
        Self {
            temporary,
            token_file,
        }
    }

    pub fn path(&self, name: &str) -> PathBuf {
        self.temporary.path().join(name)
    }
}

pub struct RuntimeProcess {
    child: Option<Child>,
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
}

impl RuntimeProcess {
    pub fn spawn(data_root: &Path, token_file: &Path, ready_file: &Path) -> Self {
        Self::spawn_with_environment(data_root, token_file, ready_file, false)
    }

    pub fn spawn_without_environment(
        data_root: &Path,
        token_file: &Path,
        ready_file: &Path,
    ) -> Self {
        Self::spawn_with_environment(data_root, token_file, ready_file, true)
    }

    fn spawn_with_environment(
        data_root: &Path,
        token_file: &Path,
        ready_file: &Path,
        clear_environment: bool,
    ) -> Self {
        let mut command = runtime_command(data_root, token_file, ready_file);
        if clear_environment {
            command.env_clear();
            #[cfg(windows)]
            for key in ["SystemRoot", "WINDIR"] {
                if let Some(value) = std::env::var_os(key) {
                    command.env(key, value);
                }
            }
        }
        Self::spawn_command(command)
    }

    pub fn spawn_command(mut command: Command) -> Self {
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = command.spawn().expect("spawn ensemble-runtime process");
        let stdout = child.stdout.take().expect("capture Runtime stdout");
        let stderr = child.stderr.take().expect("capture Runtime stderr");
        Self {
            child: Some(child),
            stdout: Some(stdout),
            stderr: Some(stderr),
        }
    }

    pub fn id(&self) -> u32 {
        self.child
            .as_ref()
            .expect("Runtime process is present")
            .id()
    }

    pub fn wait_ready(&mut self, ready_file: &Path) -> ReadyDescriptor {
        let deadline = Instant::now() + PROCESS_TIMEOUT;
        loop {
            if ready_file.exists() {
                let bytes = fs::read(ready_file).expect("read observable ready descriptor");
                return serde_json::from_slice(&bytes)
                    .expect("an observable ready descriptor must always be complete JSON");
            }
            if self
                .child
                .as_mut()
                .expect("Runtime process is present")
                .try_wait()
                .expect("inspect Runtime process")
                .is_some()
            {
                panic!("Runtime exited before publishing its ready descriptor");
            }
            assert!(
                Instant::now() < deadline,
                "Runtime did not publish a ready descriptor before the bounded deadline"
            );
            thread::sleep(Duration::from_millis(5));
        }
    }

    #[cfg(unix)]
    pub fn terminate(self) -> CapturedProcess {
        let pid = libc::pid_t::try_from(self.id()).expect("child PID fits platform pid_t");
        // SAFETY: `pid` belongs to the still-owned child and SIGTERM has no pointer invariants.
        let result = unsafe { libc::kill(pid, libc::SIGTERM) };
        assert_eq!(result, 0, "send SIGTERM to Runtime child");
        self.wait_and_capture(PROCESS_TIMEOUT)
    }

    pub fn kill(self) -> CapturedProcess {
        let mut this = self;
        if let Some(child) = this.child.as_mut()
            && child
                .try_wait()
                .expect("inspect Runtime before kill")
                .is_none()
        {
            child.kill().expect("kill Runtime child");
        }
        this.wait_and_capture(PROCESS_TIMEOUT)
    }

    pub fn wait_and_capture(mut self, timeout: Duration) -> CapturedProcess {
        let mut child = self.child.take().expect("Runtime process is present");
        let status = wait_for_exit(&mut child, timeout);
        let mut stdout = String::new();
        self.stdout
            .take()
            .expect("Runtime stdout is present")
            .read_to_string(&mut stdout)
            .expect("read Runtime stdout");
        let mut stderr = String::new();
        self.stderr
            .take()
            .expect("Runtime stderr is present")
            .read_to_string(&mut stderr)
            .expect("read Runtime stderr");
        CapturedProcess {
            status,
            stdout,
            stderr,
        }
    }
}

impl Drop for RuntimeProcess {
    fn drop(&mut self) {
        if let Some(child) = self.child.as_mut() {
            if child.try_wait().ok().flatten().is_none() {
                let _ = child.kill();
            }
            let _ = child.wait();
        }
    }
}

pub struct CapturedProcess {
    pub status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

impl CapturedProcess {
    pub fn combined(&self) -> String {
        format!("{}{}", self.stdout, self.stderr)
    }

    pub fn assert_code(&self, code: &str) {
        assert!(!self.status.success(), "failure case exited successfully");
        assert!(
            self.stderr
                .lines()
                .any(|line| line == format!("runtime_failed code={code}")),
            "failure output did not contain the expected stable code"
        );
    }
}

pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl HttpResponse {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(candidate, _)| candidate.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

pub fn runtime_command(data_root: &Path, token_file: &Path, ready_file: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_ensemble-runtime"));
    command
        .arg("--data-root")
        .arg(data_root)
        .arg("--session-token-file")
        .arg(token_file)
        .arg("--ready-file")
        .arg(ready_file);
    command
}

pub fn run_failure(command: Command) -> CapturedProcess {
    RuntimeProcess::spawn_command(command).wait_and_capture(PROCESS_TIMEOUT)
}

pub fn request(
    port: u16,
    method: &str,
    path: &str,
    authorization: Option<&str>,
    body: &str,
) -> HttpResponse {
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    let mut stream = TcpStream::connect_timeout(&address.into(), Duration::from_secs(2))
        .expect("connect to Runtime loopback listener");
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("set HTTP read timeout");
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .expect("set HTTP write timeout");

    let mut wire = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\nContent-Length: {}\r\n",
        body.len()
    );
    if let Some(value) = authorization {
        wire.push_str("Authorization: ");
        wire.push_str(value);
        wire.push_str("\r\n");
    }
    wire.push_str("\r\n");
    wire.push_str(body);
    stream
        .write_all(wire.as_bytes())
        .expect("write raw HTTP request");

    let mut bytes = Vec::new();
    stream
        .read_to_end(&mut bytes)
        .expect("read raw HTTP response");
    parse_response(&bytes)
}

pub fn bearer(token: &str) -> String {
    format!("Bearer {token}")
}

pub fn assert_no_secret_or_path(captured: &CapturedProcess, paths: &[&Path], secrets: &[&str]) {
    let output = captured.combined();
    for path in paths {
        assert!(
            !output.contains(path.to_string_lossy().as_ref()),
            "Runtime output exposed a private bootstrap path"
        );
    }
    for secret in secrets {
        assert!(
            !output.contains(secret),
            "Runtime output exposed secret or request material"
        );
    }
}

pub fn assert_flat_runtime_logs(captured: &CapturedProcess) {
    assert!(
        captured.stdout.is_empty(),
        "Runtime unexpectedly wrote stdout"
    );
    for line in captured.stderr.lines().filter(|line| !line.is_empty()) {
        let mut fields = line.split_ascii_whitespace();
        let tag = fields.next().expect("lifecycle log tag");
        assert!(!tag.contains('='), "lifecycle log tag must be flat");
        assert!(
            fields.all(|field| field.contains('=') && !field.contains(['{', '}', '[', ']'])),
            "lifecycle log fields must use flat key=value syntax"
        );
    }
}

pub fn assert_no_valid_ready(path: &Path) {
    let valid = fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<ReadyDescriptor>(&bytes).ok())
        .is_some();
    assert!(!valid, "failure published a valid ready descriptor");
}

fn wait_for_exit(child: &mut Child, timeout: Duration) -> ExitStatus {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait().expect("inspect Runtime child status") {
            return status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            panic!("Runtime child did not exit before the bounded deadline");
        }
        thread::sleep(Duration::from_millis(10));
    }
}

fn parse_response(bytes: &[u8]) -> HttpResponse {
    let text = String::from_utf8(bytes.to_vec()).expect("HTTP response is UTF-8");
    let (head, body) = text
        .split_once("\r\n\r\n")
        .expect("HTTP response contains header terminator");
    let mut lines = head.lines();
    let status = lines
        .next()
        .expect("HTTP status line")
        .split_ascii_whitespace()
        .nth(1)
        .expect("HTTP status code")
        .parse()
        .expect("numeric HTTP status code");
    let headers = lines
        .map(|line| {
            let (name, value) = line.split_once(':').expect("well-formed HTTP header");
            (name.to_owned(), value.trim().to_owned())
        })
        .collect();
    HttpResponse {
        status,
        headers,
        body: body.to_owned(),
    }
}
