# Rust Runtime Bootstrap

**Status:** F0-A1 Linux/WSL OWNER ACCEPTED / ACCEPTED; delivery pushed; F0-A2 authorized / active next (2026-08-21)

This document is the current source of truth for the standalone Rust Runtime bootstrap. It covers only process ownership, authenticated loopback health, ready publication, and graceful process shutdown. Electron supervision, Domain/Event persistence, Runner behavior, PTY ownership, and product workflows remain outside F0-A1.

## Invocation And Process Boundary

The production CLI is fixed to:

```text
ensemble-runtime \
  --data-root <path> \
  --session-token-file <path> \
  --ready-file <path>
```

There is no host or port override. The Runtime always asks the operating system for a port on `127.0.0.1`. The built binary has no runtime Python or Node dependency; the Linux black-box suite starts the absolute binary path with an empty environment and confirms it creates no child process.

The Runtime owns one canonical data root. It creates a missing directory, rejects a path that is a file, canonicalizes the directory, and holds an exclusive lock on `<canonical-data-root>/.ensemble-runtime.lock` for its lifetime. Syntactic aliases therefore contend on the same lock, while different roots may run concurrently.

Ready coordination is disjoint from datastore ownership. The ready path must name a non-reserved file whose existing parent canonicalizes outside the canonical data root. The Runtime holds an exclusive cross-process lease in the persistent sibling `<ready-name>.ensemble-runtime-ready.lock` from pre-bind bootstrap through owned-ready removal; the lease file is never unlinked on drop. A second Runtime using the same canonical ready path fails before publication even when its data root differs.

## Token And HTTP Contract

The token path must be a regular file of no more than 16 KiB. Leading and trailing ASCII whitespace is ignored. The remaining value must be token68 syntax with at least 43 non-padding encoded characters; padding-only, short, malformed, missing, directory, and oversized inputs fail before a listener or ready descriptor is published. This validation proves syntax and minimum encoded material only. It cannot prove entropy or unpredictability.

Generating at least 32 unpredictable bytes with a cryptographically secure random generator is a producer/Shell invariant. The owner smoke proves its own `node:crypto.randomBytes(32)` generation and encodes those bytes as 64 hexadecimal characters. F0-A2 must separately prove that the production Electron supervisor generates and protects an equivalent token; F0-A1 Runtime acceptance does not prove future Shell generation.

Only the SHA-256 token digest remains in `SessionToken` after loading. The type does not implement `Debug`. Authorization comparisons hash the candidate and use constant-time digest equality.

Every route is behind the same middleware. The first endpoint is:

```http
GET /v1/health
Authorization: Bearer <session-token>
```

Missing, wrong, or malformed bearer input returns `401` with `WWW-Authenticate: Bearer`. A matching token returns `200` with exactly:

```json
{
  "protocolVersion": "1",
  "runtimeVersion": "0.1.0",
  "status": "ok",
  "pid": 12345,
  "dataRootDigest": "<64 lowercase hex characters>"
}
```

The PID is the serving process. `dataRootDigest` is SHA-256 over the canonical platform path representation and does not expose the path.

## Bootstrap Ordering

Startup is ordered as follows:

1. Validate and digest the session token syntax.
2. Create/canonicalize the data root and acquire its exclusive lock.
3. Canonicalize the existing ready parent, reject a target equal to/inside the data root or using the reserved lease suffix, and acquire the persistent sibling ready-path lease.
4. Bind `127.0.0.1:0` and read the assigned address.
5. Construct the authenticated router and poll the shutdown future once so platform signal registration is active.
6. Serialize the complete descriptor to a same-directory temporary file, append a newline, and `sync_all` the file.
7. Atomically replace the ready path, then attempt a parent-directory sync on Unix.
8. Emit `runtime_ready` and serve until the registered shutdown future resolves.

If shutdown is already requested at step 5, startup exits successfully without publishing ready and releases both leases. An observable ready descriptor therefore belongs to a data-root-locked, ready-path-leased, bound, authenticated process whose termination handler is registered. Immediate authenticated health succeeds, and repeated process tests reject any partial observable JSON.

Parent-directory sync is deliberately best-effort because directory fsync is not portable and the ready file is reconstructible bootstrap coordination, not durable business state. Temporary-file creation, serialization, file sync, and atomic publication remain mandatory failures.

## Ready Ownership And Shutdown

The descriptor contains only:

- `protocolVersion`
- `pid`
- `host`
- `port`
- `dataRootDigest`
- `startedAt`

`ReadyPathLease`, `ReadyFileGuard`, their acquisition/publication/removal methods, and the owned HTTP server are crate-private implementation details. The external library surface exposes the versioned `ReadyDescriptor`, `RuntimeConfig`, `run_until`, errors, and binary bootstrap support without granting callers direct ownership-file mutation.

`ReadyFileGuard` owns the ready-path lease and retains the exact descriptor it published. Graceful shutdown removes the path only when its current parseable contents still equal that full descriptor. A missing or externally replaced descriptor is preserved. Compliant Runtimes cannot concurrently publish one canonical ready path. Bootstrap failures before publication preserve existing ready bytes. After a prior process dies and the OS releases its lease, a new owner may acquire the same persistent lease file and atomically replace the stale descriptor. Ready paths remain local supervisor-owned coordination paths; the lease/equality guards are not authorization against an adversarial filesystem writer.

On Unix, both `SIGTERM` and Ctrl-C request graceful shutdown. The Runtime directly accepts health-only HTTP/1.1 connections and owns every connection task in a Tokio `JoinSet`; Hyper/hyper-util adapt the authenticated Axum Router without enabling protocol upgrades. Shutdown stops acceptance, broadcasts graceful connection shutdown, and waits at most **1 second**. If an incomplete/slow connection remains, the Runtime logs `runtime_http_drain_expired ... timeout_ms=1000`, aborts every remaining task, and joins the set to empty before removing owned ready or releasing either lease. `run_until` therefore never returns while an owned listener/connection task or server-side socket remains alive. This is only the F0-A1 bootstrap HTTP drain bound; it does not define later business safe-quit/Draft/Runner semantics. WebSocket/HTTP upgrade support is intentionally absent because upgrade tasks would escape this registry; any future event/session transport must add upgrade/session tasks to an explicit owned registry in its separately authorized slice. Windows/macOS runtime execution remains unverified in this slice; platform-specific closure belongs to later owner-gated evidence.

## Stable Failure Codes

The CLI emits only `runtime_failed code=<stable_code>` for Runtime bootstrap failures. Covered F0-A1 codes include:

| Failure | Code |
| --- | --- |
| Data root cannot be created | `data_root_create` |
| Data root is a file | `data_root_not_directory` |
| Same canonical root is owned | `data_root_locked` |
| Token path missing/uninspectable | `token_metadata` |
| Token path is a directory | `token_not_file` |
| Token material is short | `token_too_short` |
| Token material is malformed | `token_invalid` |
| Token file exceeds 16 KiB | `token_too_large` |
| Ready path is missing a filename or uses the reserved lease suffix | `ready_path_invalid` |
| Ready parent is invalid | `ready_parent_invalid` |
| Ready parent cannot be canonicalized | `ready_parent_canonicalize` |
| Ready target is equal to/inside the canonical data root | `ready_inside_data_root` |
| Ready lease file cannot be opened/acquired | `ready_lease_open` / `ready_lease` |
| Another Runtime owns the canonical ready path | `ready_path_locked` |
| Ready destination cannot be atomically replaced | `ready_publish` |
| Loopback listener cannot be bound | `listener_bind` |

Lifecycle output is single-line, grep-friendly `tag key=value`. It may contain protocol version, PID, loopback host, assigned port, data-root digest, and boolean ready removal. It must not contain token material, token/data-root/ready paths, Authorization headers, request bodies, or nested/pretty objects.

## Verification Commands

Run the complete noninteractive F0-A1 gate:

```bash
pnpm verify:f0-a1
```

It runs Rust format checking, production Clippy, all-target Clippy, ten unit tests, sixteen black-box process integration tests, and two in-process owned-server integration tests. The integration suite owns child processes with bounded waits and cleanup; Unix signal cases are explicitly `cfg(unix)`. A private listener-future seam provides deterministic `listener_bind` coverage while production remains fixed to `TcpListener::bind((127.0.0.1, 0))`. Direct minimal locked Hyper 1.11.0/hyper-util 0.1.20 dependencies implement the auditable owned HTTP/1.1 connection lifecycle; Cargo.lock records no new package versions because both crates were already transitive Axum dependencies, only direct dependency/feature edges changed.

Run the sanitized owner smoke harness:

```bash
pnpm smoke:f0-a1
```

The harness builds the binary, creates a 32-byte CSPRNG token in a restricted temporary file, starts the Runtime with `PATH` absent, verifies `401`/`200`, same-root rejection, different-root concurrency, no Linux child process, graceful stop, ready removal, restart, and secret-free captured Runtime output. It awaits Node `ChildProcess.close` before inspecting captured streams, so all stdout/stderr data is drained; spawn errors are explicit and cleanup remains bounded. It prints only non-secret PID/port/digest evidence and removes its temporary workspace.

## Manual Curl Runbook

The automated smoke is the required one-command owner path. For direct inspection on WSL/Linux, these commands reproduce the same contract without placing the token in curl arguments or terminal output:

```bash
set -euo pipefail
umask 077
SMOKE_DIR="$(mktemp -d)"
TOKEN_FILE="$SMOKE_DIR/session.token"
AUTH_HEADER="$SMOKE_DIR/auth.header"
DATA_ROOT="$SMOKE_DIR/data"
READY_FILE="$SMOKE_DIR/runtime.ready.json"
RUNTIME_LOG="$SMOKE_DIR/runtime.log"
RUNTIME_PID=""
OTHER_PID=""
RESTART_PID=""
cleanup() {
  for pid in "$RESTART_PID" "$OTHER_PID" "$RUNTIME_PID"; do
    test -z "$pid" || kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT

cargo build --manifest-path crates/ensemble-runtime/Cargo.toml --locked --bin ensemble-runtime
RUNTIME_BIN="$PWD/crates/ensemble-runtime/target/debug/ensemble-runtime"
node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' >"$TOKEN_FILE"
printf 'Authorization: Bearer ' >"$AUTH_HEADER"
cat "$TOKEN_FILE" >>"$AUTH_HEADER"
printf '\n' >>"$AUTH_HEADER"

"$RUNTIME_BIN" \
  --data-root "$DATA_ROOT" \
  --session-token-file "$TOKEN_FILE" \
  --ready-file "$READY_FILE" \
  2>"$RUNTIME_LOG" &
RUNTIME_PID=$!
until test -s "$READY_FILE"; do kill -0 "$RUNTIME_PID"; sleep 0.05; done
PORT="$(READY_FILE="$READY_FILE" node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.env.READY_FILE)); process.stdout.write(String(r.port))')"

UNAUTH_STATUS="$(curl -sS -D "$SMOKE_DIR/unauth.headers" -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/v1/health")"
test "$UNAUTH_STATUS" = 401
grep -qi '^www-authenticate: Bearer' "$SMOKE_DIR/unauth.headers"
AUTH_STATUS="$(curl -sS -H "@$AUTH_HEADER" -o "$SMOKE_DIR/health.json" -w '%{http_code}' "http://127.0.0.1:$PORT/v1/health")"
test "$AUTH_STATUS" = 200
READY_FILE="$READY_FILE" node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.env.READY_FILE)); console.log(`ready protocol_version=${r.protocolVersion} pid=${r.pid} host=${r.host} port=${r.port} data_root_digest=${r.dataRootDigest}`)'

if "$RUNTIME_BIN" --data-root "$DATA_ROOT/../data" --session-token-file "$TOKEN_FILE" --ready-file "$SMOKE_DIR/conflict.ready.json" 2>"$SMOKE_DIR/conflict.log"; then exit 1; fi
grep -qx 'runtime_failed code=data_root_locked' "$SMOKE_DIR/conflict.log"
test -z "$(cat "/proc/$RUNTIME_PID/task/$RUNTIME_PID/children")"

"$RUNTIME_BIN" --data-root "$SMOKE_DIR/other-data" --session-token-file "$TOKEN_FILE" --ready-file "$SMOKE_DIR/other.ready.json" 2>"$SMOKE_DIR/other.log" &
OTHER_PID=$!
until test -s "$SMOKE_DIR/other.ready.json"; do kill -0 "$OTHER_PID"; sleep 0.05; done
kill -TERM "$OTHER_PID" "$RUNTIME_PID"
wait "$OTHER_PID"
OTHER_PID=""
wait "$RUNTIME_PID"
RUNTIME_PID=""
test ! -e "$READY_FILE"

"$RUNTIME_BIN" --data-root "$DATA_ROOT" --session-token-file "$TOKEN_FILE" --ready-file "$READY_FILE" 2>>"$RUNTIME_LOG" &
RESTART_PID=$!
until test -s "$READY_FILE"; do kill -0 "$RESTART_PID"; sleep 0.05; done
kill -TERM "$RESTART_PID"
wait "$RESTART_PID"
RESTART_PID=""
test ! -e "$READY_FILE"
```

Delete the temporary directory after inspection with the workspace's preferred recoverable cleanup tool. Do not print or attach `session.token` or `auth.header` to evidence.

## Current Evidence And Gaps

The sanitized WSL/Linux record is [F0-A1 WSL/Linux evidence](../specs/evidence/f0-a1/wsl-linux-2026-08-21.md). The [independent Critical implementation review](../specs/reviews/F0-A1-runtime-implementation-review-2026-08-21.md) and [Owner Acceptance](../specs/reviews/F0-A1-owner-acceptance-2026-08-21.md) are **ACCEPT**; F0-A1 is OWNER ACCEPTED. This is not three-platform closure. the acceptance/delivery status is pushed and F0-A2 is authorized to start now, and every later gate remains mandatory. Windows Ctrl-C/termination, macOS signals, platform filesystems, packaged sidecar resolution, signing, and Electron supervision remain unverified and must not be inferred from Linux results. Hard-crash cleanup of a temporary ready file left during the atomic-publication window is not exercised and remains outside this graceful-shutdown slice; no scavenging behavior is claimed.
