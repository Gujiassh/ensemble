import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const TIMEOUT_MS = 8_000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = path.join(repoRoot, "crates/ensemble-runtime/Cargo.toml");
const binary = path.join(
  repoRoot,
  "crates/ensemble-runtime/target/debug",
  process.platform === "win32" ? "ensemble-runtime.exe" : "ensemble-runtime",
);
const temporary = mkdtempSync(path.join(os.tmpdir(), "ensemble-f0-a1-smoke-"));
const token = randomBytes(32).toString("hex");
const tokenFile = path.join(temporary, "session-token");
const live = new Set();
writeFileSync(tokenFile, token, { mode: 0o600 });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function build() {
  const result = spawnSync(
    "cargo",
    ["build", "--manifest-path", manifest, "--locked", "--bin", "ensemble-runtime"],
    { cwd: repoRoot, stdio: "inherit" },
  );
  check(result.status === 0, "Rust Runtime build failed");
}

function start(dataRoot, readyFile) {
  const environment = {};
  if (process.platform === "win32") {
    for (const key of ["SystemRoot", "WINDIR"]) {
      if (process.env[key]) environment[key] = process.env[key];
    }
  }
  const child = spawn(
    binary,
    ["--data-root", dataRoot, "--session-token-file", tokenFile, "--ready-file", readyFile],
    { env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );
  const processRecord = {
    child,
    readyFile,
    stdout: "",
    stderr: "",
    spawnError: undefined,
  };
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    processRecord.stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    processRecord.stderr += chunk;
  });
  child.once("error", (error) => {
    processRecord.spawnError = error;
  });
  processRecord.completed = new Promise((resolve) => {
    child.once("close", (code, signal) =>
      resolve({ code, signal, spawnError: processRecord.spawnError }),
    );
  });
  live.add(processRecord);
  return processRecord;
}

async function withTimeout(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitReady(processRecord) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(processRecord.readyFile)) {
      const descriptor = JSON.parse(readFileSync(processRecord.readyFile, "utf8"));
      check(descriptor.pid === processRecord.child.pid, "ready PID does not own process");
      check(descriptor.host === "127.0.0.1", "listener is not IPv4 loopback");
      return descriptor;
    }
    check(processRecord.spawnError === undefined, "Runtime process could not be spawned");
    check(
      processRecord.child.exitCode === null && processRecord.child.signalCode === null,
      "Runtime exited before ready",
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("ready descriptor timed out");
}

function request(port, authorization) {
  return withTimeout(
    new Promise((resolve, reject) => {
      const headers = authorization ? { Authorization: authorization } : {};
      const call = http.request(
        { host: "127.0.0.1", port, path: "/v1/health", method: "GET", headers },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () =>
            resolve({ status: response.statusCode, headers: response.headers, body }),
          );
        },
      );
      call.once("error", reject);
      call.end();
    }),
    "health request",
  );
}

async function stop(processRecord) {
  check(processRecord.spawnError === undefined, "Runtime process could not be spawned");
  if (processRecord.child.exitCode === null && processRecord.child.signalCode === null) {
    processRecord.child.kill(process.platform === "win32" ? "SIGKILL" : "SIGTERM");
  }
  const result = await withTimeout(processRecord.completed, "Runtime shutdown");
  live.delete(processRecord);
  check(result.spawnError === undefined, "Runtime process could not be spawned");
  return result;
}

function assertSanitized(processRecord, privatePaths, secretValues) {
  const output = processRecord.stdout + processRecord.stderr;
  check(processRecord.stdout === "", "Runtime wrote unexpected stdout");
  for (const value of [...privatePaths, ...secretValues]) {
    check(!output.includes(value), "Runtime output exposed secret bootstrap material");
  }
  for (const line of processRecord.stderr.split("\n").filter(Boolean)) {
    const fields = line.trim().split(/\s+/u);
    check(!fields[0].includes("="), "lifecycle log tag is not flat");
    check(
      fields.slice(1).every((field) => field.includes("=")),
      "log field is not key=value",
    );
  }
}

async function forceCleanup() {
  const exits = [];
  for (const processRecord of live) {
    if (
      processRecord.spawnError === undefined &&
      processRecord.child.exitCode === null &&
      processRecord.child.signalCode === null
    ) {
      try {
        processRecord.child.kill("SIGKILL");
      } catch {
        // The child may have exited between the status check and cleanup signal.
      }
    }
    exits.push(
      withTimeout(processRecord.completed, "forced Runtime cleanup").catch(() => undefined),
    );
  }
  await Promise.all(exits);
  rmSync(temporary, { recursive: true, force: true });
}

async function main() {
  build();
  console.log(
    `smoke_environment platform=${process.platform} arch=${process.arch} path_stripped=true`,
  );
  const firstRoot = path.join(temporary, "first-root");
  const firstReadyPath = path.join(temporary, "first.ready.json");
  const first = start(firstRoot, firstReadyPath);
  const firstReady = await waitReady(first);
  const readyText = readFileSync(firstReadyPath, "utf8");
  for (const forbidden of [token, firstRoot, tokenFile, firstReadyPath]) {
    check(!readyText.includes(forbidden), "ready descriptor exposed bootstrap material");
  }
  const missing = await request(firstReady.port);
  const wrongToken = "f".repeat(64);
  const wrongBearer = `Bearer ${wrongToken}`;
  const wrong = await request(firstReady.port, wrongBearer);
  const malformed = await request(firstReady.port, "Bearer");
  const healthy = await request(firstReady.port, `Bearer ${token}`);
  check(
    missing.status === 401 && missing.headers["www-authenticate"] === "Bearer",
    "missing auth contract failed",
  );
  check(wrong.status === 401 && malformed.status === 401, "invalid auth contract failed");
  const health = JSON.parse(healthy.body);
  check(healthy.status === 200 && health.pid === firstReady.pid, "health identity failed");
  console.log(
    `smoke_ready protocol_version=${firstReady.protocolVersion} pid=${firstReady.pid} host=${firstReady.host} port=${firstReady.port} data_root_digest=${firstReady.dataRootDigest}`,
  );
  console.log(
    `smoke_auth missing=${missing.status} wrong=${wrong.status} malformed=${malformed.status} correct=${healthy.status} challenge=${missing.headers["www-authenticate"]}`,
  );

  const alias = `${firstRoot}${path.sep}..${path.sep}${path.basename(firstRoot)}`;
  const conflictReady = path.join(temporary, "conflict.ready.json");
  const conflict = start(alias, conflictReady);
  const conflictExit = await withTimeout(conflict.completed, "same-root rejection");
  live.delete(conflict);
  check(conflictExit.spawnError === undefined, "conflict Runtime process could not be spawned");
  check(
    conflictExit.code !== 0 && conflict.stderr.includes("code=data_root_locked"),
    "same-root rejection failed",
  );
  check(
    (await request(firstReady.port, `Bearer ${token}`)).status === 200,
    "first Runtime lost health",
  );
  console.log("smoke_same_root exit_nonzero=true code=data_root_locked first_healthy=true");

  const secondRoot = path.join(temporary, "second-root");
  const secondReadyPath = path.join(temporary, "second.ready.json");
  const second = start(secondRoot, secondReadyPath);
  const secondReady = await waitReady(second);
  check(firstReady.port !== secondReady.port, "distinct roots reused one live port");
  check(firstReady.dataRootDigest !== secondReady.dataRootDigest, "distinct roots reused digest");
  check(
    (await request(secondReady.port, `Bearer ${token}`)).status === 200,
    "second health failed",
  );
  console.log(
    `smoke_different_roots ports_distinct=true digests_distinct=true first_port=${firstReady.port} second_port=${secondReady.port}`,
  );

  if (process.platform === "linux") {
    const children = readFileSync(
      `/proc/${first.child.pid}/task/${first.child.pid}/children`,
      "utf8",
    ).trim();
    check(children === "", "Runtime spawned an unexpected child process");
    console.log("smoke_process_children count=0 python_process=false");
  } else {
    console.log(
      `smoke_process_children count=blocked python_process=blocked platform=${process.platform}`,
    );
  }

  const secondExit = await stop(second);
  check(process.platform === "win32" || secondExit.code === 0, "second graceful stop failed");
  const firstExit = await stop(first);
  check(process.platform === "win32" || firstExit.code === 0, "first graceful stop failed");
  check(
    process.platform === "win32" || !existsSync(firstReadyPath),
    "owned ready remained after stop",
  );

  const restarted = start(firstRoot, firstReadyPath);
  const restartedReady = await waitReady(restarted);
  check(
    (await request(restartedReady.port, `Bearer ${token}`)).status === 200,
    "restart health failed",
  );
  const restartExit = await stop(restarted);
  check(process.platform === "win32" || restartExit.code === 0, "restart graceful stop failed");
  console.log(
    `smoke_shutdown graceful=${process.platform === "win32" ? "blocked" : "true"} ready_removed=${process.platform === "win32" ? "blocked" : "true"} restart=true`,
  );

  assertSanitized(first, [firstRoot, tokenFile, firstReadyPath], [token, wrongToken, wrongBearer]);
  assertSanitized(
    second,
    [secondRoot, tokenFile, secondReadyPath],
    [token, wrongToken, wrongBearer],
  );
  assertSanitized(
    restarted,
    [firstRoot, tokenFile, firstReadyPath],
    [token, wrongToken, wrongBearer],
  );
  assertSanitized(conflict, [alias, tokenFile, conflictReady], [token, wrongToken, wrongBearer]);
  console.log("smoke_secret_scan ready=true stdout_stderr=true authorization=true");
  console.log(
    `smoke_result status=${process.platform === "win32" ? "pass_with_platform_gap" : "pass"}`,
  );
}

try {
  await main();
} finally {
  await forceCleanup();
}
