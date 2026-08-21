# F0-A1 Rust Runtime Bootstrap Implementation Critical Review

**Date:** 2026-08-21
**Risk class:** Critical
**Baseline:** `main@32ea2997c570955fae07902ddb5c620e18c728cf`
**Reviewed delivery:** authorized uncommitted F0-A1 worktree
**Implementation verdict:** **ACCEPT**
**Delivery state:** **AWAITING OWNER ACCEPTANCE**
**Owner acceptance:** **PENDING**

This clean-room review accepts only the Linux/WSL F0-A1 standalone Rust Runtime bootstrap defined by [F0-A Runtime Lifecycle](../f0-a-runtime-lifecycle.md) and [Rust Runtime Bootstrap](../../ssot/runtime-bootstrap.md). It does not accept the delivery on the product owner's behalf and does not authorize F0-A2, F0-A3, F1, Electron implementation, commit, push, merge, deployment, or release.

## 1. Findings

No open implementation findings remain in the accepted F0-A1 scope.

Two earlier Critical reviews returned `REWORK REQUIRED`. The final worktree closes their data-root/ready-path alias, unbounded drain, detached Axum connection-task, public-surface, smoke-capture, evidence wording, and durable-status findings. Required semantic behavior is supported by static review, automated tests, independent process probes, and in-process socket-lifetime evidence rather than green commands alone.

## 2. Semantic Oracles

| Oracle | Result | Review judgment |
| --- | --- | --- |
| Standalone Runtime | pass | The absolute Rust binary starts with its environment cleared, serves authenticated health, has no Python/Node dynamic library, and creates no child process on Linux. |
| Canonical data-root authority | pass | A data root is created if absent, canonicalized before Runtime state opens, and held by one exclusive datastore lock for the Runtime lifetime. `root` and `root/../root` contend. |
| Distinct-root isolation | pass | Distinct canonical roots run concurrently on different OS-assigned loopback ports and report distinct path digests. |
| HTTP authentication | pass | Every route is behind bearer middleware. Missing, malformed, and wrong tokens return `401`; the matching token returns the exact versioned health payload. |
| Token responsibility | pass | Runtime validates token68 syntax and minimum encoded material. The producer must generate at least 32 unpredictable bytes; the smoke harness proves its own CSPRNG generation. Future Electron generation/protection remains an F0-A2 obligation. |
| Ready ordering | pass | Data-root lock, ready-path lease, listener bind, authenticated router construction, and first shutdown poll precede atomic ready publication. Already-requested shutdown publishes no ready. |
| Ready atomicity | pass | Same-directory temporary serialization, file `sync_all`, atomic replacement, and immediate authenticated health were observed repeatedly. Parent-directory sync is intentionally best-effort Unix coordination durability, not business-state durability. |
| Ready/data-root disjointness | pass | Exact datastore-lock, `..`, and symlink-parent ready aliases inside the canonical root fail with `ready_inside_data_root` without replacing the lock inode. |
| Ready-path lifetime ownership | pass | A persistent sibling lease serializes one canonical ready path across different roots. An active owner cannot be replaced; stale bytes are replaceable only after OS lease release. |
| Listener honesty | pass | Production has only `127.0.0.1:0`; a private injected listener seam proves `listener_bind`, preserved stale bytes, sanitized diagnostic shape, lock release, and restart. No binary execution claim is made for the injected failure. |
| Owned HTTP lifecycle | pass | The Runtime owns the accept loop and every health-only HTTP/1.1 connection in one Tokio `JoinSet`. Shutdown is biased before accept, stops admission, broadcasts graceful shutdown, drains for one second, aborts remainder, and joins the set to empty before ready/lease release. |
| No escaped upgrade task | pass | The server uses Hyper HTTP/1.1 `serve_connection`, not Axum `serve`, `with_upgrades`, WebSocket, HTTP/2, or a detached per-connection path. Future streams/upgrades require a separately authorized owned registry. |
| Graceful shutdown and restart | pass | Ordinary health/keepalive shutdown completes without expiry. One incomplete connection and 48 pressure clients enter the bounded path; every peer observes EOF/reset before `run_until` returns, then same-root restart succeeds. |
| Secret/log safety | pass | Ready data and completed stdout/stderr exclude token, raw wrong token, wrong bearer, paths, request-body marker, and authorization material. Logs remain one flat `tag key=value` record per line. |
| Failure honesty | pass | Token, root, lock, listener, ready-parent, ready-destination, ready-inside-root, and active-ready-lease failures are nonzero or typed injected errors and do not publish/mutate a descriptor they would own. |
| Process/task cleanup | pass | Child fixtures have bounded RAII cleanup; the Runtime creates no child process; every accepted server task is joined or abort-joined before ownership release. |

## 3. Prior Critical Failures And Repaired Evidence

| Attack/regression | Old result | Final result |
| --- | --- | --- |
| `--ready-file <data-root>/.ensemble-runtime.lock` | Atomic publication replaced the locked pathname; two same-root processes both returned health `200`. | Exact and alias targets fail `ready_inside_data_root`; a later normal same-root contender still fails `data_root_locked`. |
| Distinct roots sharing one ready path | Later process overwrote the descriptor and could remove coordination while the earlier Runtime remained healthy. | Second process fails `ready_path_locked`; existing bytes and first health stay unchanged. |
| Stale ready takeover | Behavior was undefined relative to an active owner. | Hard-killing the owner releases the OS lease; only then may another root acquire the persistent lease and atomically replace stale bytes. |
| Incomplete unauthenticated request plus `SIGTERM` | Runtime, ready descriptor, and datastore lock remained alive indefinitely. | Binary exits successfully after the one-second drain bound, closes the held socket, removes owned ready, releases both leases, and restarts. |
| Drop timed-out Axum Serve future | `run_until` returned while a detached connection task/socket remained alive in the same Tokio runtime. | Direct Hyper accept/connection tasks are held in a `JoinSet`; timeout aborts and joins all remainder. In-process peer EOF/reset is observed before return. |
| Accept pressure during shutdown | No priority/ownership proof. | Forty-eight incomplete clients cannot starve shutdown; the biased shutdown branch wins and all client peers close before return. |
| Shutdown registration window | Ready publication preceded router construction/first signal poll; the first replacement-ready test did not prove the repair. | Deterministic first-poll and already-requested unit tests plus 24 immediate post-ready real-process `SIGTERM` trials cover the invariant honestly. |
| Listener failure oracle | No deterministic evidence. | Private listener-future injection proves typed failure and ownership release; evidence describes a constructed diagnostic shape, not a binary-produced failure. |
| Smoke stdout/stderr race | Assertions followed process `exit`, which could precede stream closure, and the wrong bearer was not scanned. | The harness waits for `ChildProcess.close` and scans the correct token, raw wrong token, and derived wrong bearer before reporting authorization sanitization. |
| Public Runtime internals | Ready lease/guard and internal modules were publicly reachable. | Modules and ownership primitives are crate-private; the small external surface is `Cli`, `RuntimeError`, `ReadyDescriptor`, `RuntimeConfig`, `run_until`, and `shutdown_signal`. |

## 4. Owned HTTP Review

The final server implementation in [http_server.rs](../../../crates/ensemble-runtime/src/http_server.rs) has one responsibility: own HTTP/1.1 listener and connection-task lifetime.

- One `JoinSet<()>` owns every accepted connection task.
- `tokio::select!` is biased with shutdown first, so a continuously ready accept socket cannot starve termination.
- Dropping the listener closes unaccepted backlog sockets.
- A watch channel asks accepted Hyper connections to begin graceful shutdown.
- A single absolute one-second deadline covers the full set, rather than granting each connection another second.
- Expiry logs the remaining count, calls `abort_all`, then drains `join_next` until the set is empty.
- Cancelled joins caused by the intentional abort are expected; non-cancelled join errors become `server_task`.
- Hyper connection errors are client/protocol disconnect outcomes because the Axum Router service error is infallible; task panics remain visible as `JoinError`.
- There is no `axum::serve`, `with_graceful_shutdown`, `with_upgrades`, WebSocket, HTTP/2, or detached server-side task path in production source.

An independent keepalive probe sent two authenticated health requests through one Node HTTP agent/socket: `first=200 second=200 same_socket=true`. Ordinary `SIGTERM` then removed ready without emitting `runtime_http_drain_expired`.

## 5. Ready And Lock Review

The final ownership order is:

```text
token validation
  -> canonical data-root lock
  -> canonical-parent ready-path validation
  -> persistent sibling ready lease
  -> loopback listener
  -> router + first shutdown poll
  -> atomic ready publication
  -> owned HTTP service
  -> stop/join HTTP
  -> remove owned ready
  -> release ready lease
  -> release data-root lock
```

Independent final probes returned:

```text
probe_ready_lock_alias exit=1 code=runtime_failed code=ready_inside_data_root
probe_ready_lock_alias exit=1 code=runtime_failed code=ready_inside_data_root
probe_shared_live exit=1 code=runtime_failed code=ready_path_locked unchanged=true
probe_shared_stale replaced=true lease_persistent=true
```

Linux `..` and symlink-parent aliases canonicalize correctly. Windows case/short-name behavior and macOS filesystem normalization are not inferred from Linux and remain blocked platform evidence.

## 6. Verification Commands And Counts

The reviewer reran the following commands on the final worktree:

```bash
pnpm verify:f0-a1
pnpm smoke:f0-a1
cargo test --manifest-path crates/ensemble-runtime/Cargo.toml --locked --test owned_http_server -- --nocapture
cargo test --manifest-path crates/ensemble-runtime/Cargo.toml --locked --test coordination_safety -- --nocapture
pnpm quality
git diff --check
```

Results:

| Gate | Result |
| --- | --- |
| Rust unit tests | 10 passed |
| Black-box process integration tests | 16 passed |
| In-process owned-server integration tests | 2 passed |
| Total F0-A1 authored tests | 28 passed, 0 failed, 0 ignored |
| Black-box process invocations | 70 total: 69 bootstrap attempts plus 1 CLI help |
| Owned accept-pressure clients | 48 closed before `run_until` return |
| Quality self-tests | 42 Node plus 11 Python unittest cases passed |
| Repository hygiene | 263 files / 249 text files, 0 errors before this review artifact |
| Source shape | 147 files, 7 reviewed pre-existing warnings, 0 errors |
| TypeScript boundary graph | 68 files / 144 edges, 0 errors |
| Python boundary graph | 29 files / 45 edges, 0 errors |
| Markdown links | 70 files / 421 local links, 0 missing before this review artifact |
| Canvas | lint/typecheck/build passed; 42 tests passed |
| Python Runtime/Runners | Ruff/format passed; 28 tests passed |
| Legacy current-code Tauri | fmt/Clippy passed; 4 tests passed |
| `git diff --check` | pass |

The sanitized owner smoke passed with `401/401/401/200`, same-root rejection, distinct-root concurrency, zero Runtime children, graceful ready removal, same-root restart, and completed-stream secret scans.

Direct locked dependencies added for the owned lifecycle are Hyper `1.11.0` and hyper-util `0.1.20`, using only Hyper HTTP/1 server plus hyper-util Tokio/service features. Both package versions were already transitive through Axum; the lockfile adds direct root/feature edges and activates Tokio `bytes`, not a second package version.

## 7. Full Review Areas

| Review area | Result | Notes |
| --- | --- | --- |
| Goal alignment | pass | Implements only F0-A1 bootstrap and evidence. |
| Rust Runtime sole authority | pass | No Node/Python business Runtime or Shell state source was added. |
| F0-A2/Electron implementation | not applicable | Forbidden and absent. |
| CLI/API/health contract | pass | Three fixed path arguments, loopback port 0, exact versioned health. |
| Authentication | pass | All routes authenticated; token comparison uses SHA-256 plus constant-time digest equality. |
| Token entropy boundary | pass | Producer entropy and Runtime syntax validation are distinguished. |
| Canonical data root | pass | Canonical absolute root precedes Runtime state and owns one datastore lock. |
| Ready publication | pass | Leased, disjoint, atomic, owned removal. |
| Ready-before-serve timing | pass | Locks/listener/router/shutdown registration precede observable ready; immediate health passes. |
| Shared ready/stale ready | pass | Active collision rejected; stale takeover only after lease release. |
| Shutdown registration | pass | Deterministic poll-order/already-ready tests and repeated real process evidence. |
| Listener failure | pass | Honest private injection; production bind remains fixed. |
| HTTP keepalive | pass | Two authenticated responses reused one socket. |
| Shutdown/accept ordering | pass | Biased shutdown branch and 48-client pressure proof. |
| Connection task ownership | pass | Abort and join to empty before return/lease release. |
| Upgrade/WebSocket ownership | pass | No upgrade support or escaped task exists in F0-A1. |
| Task panic handling | pass | Non-cancelled `JoinError` becomes stable `server_task`; cleanup still precedes return. |
| Expected client disconnects | pass | Hyper protocol/client errors terminate their owned connection task without taking down the listener. |
| Secret/path/body/log leakage | pass | Completed-stream and integration assertions cover the sensitive markers. |
| Process tree | pass | Runtime creates no child process in F0-A1. |
| Normal file/temp cleanup | pass | Owned ready and temporary workspaces are removed; persistent lease file is deliberately retained to avoid unlink/relock races. |
| Directory fsync | pass | File sync is mandatory; parent sync is explicitly best-effort and non-business coordination only. |
| Source shape/maintainability | pass | Cohesive modules remain below review thresholds; HTTP ownership has a dedicated module. |
| Public API surface | pass | Ownership internals are crate-private. |
| Dependency/lock integrity | pass | Locked direct Hyper edges are minimal and documented. |
| Tests/assertion honesty | pass | Counts, claims, failure seams, scheduler limits, and smoke stream timing match implementation. |
| Repo/workbench status | pass | Current task/checkpoint names final clean-room review and records 28/28 plus both prior rework decisions. |
| Domain/API/save preservation | pass | No Domain model, Command/Event contract, persistence schema/field, or save meaning changed. |
| Windows execution | blocked | No Windows binary, locking, canonicalization, replacement, Ctrl-C, or filesystem evidence in F0-A1. |
| macOS execution | blocked | No macOS binary, signal, locking, canonicalization, or filesystem evidence in F0-A1. |
| Hard-crash temp scavenging | blocked | Atomic-publication crash-window temporary-file cleanup is unproven and no scavenger is claimed. |
| Packaged sidecar/signing/supervision | not applicable | Belongs to later owner-gated F0-A2/F0-A3. |
| Owner acceptance | blocked | Must be performed explicitly by the product owner after this implementation review. |

The blocked rows are declared residual platform/later-slice evidence gaps, not failed Linux/WSL F0-A1 implementation invariants.

## 8. Reverse Review

Assuming each prior regression returned:

- lock replacement would fail exact/alias `ready_inside_data_root` process tests;
- concurrent ready overwrite would fail the persistent lease and shared-path byte-preservation tests;
- premature ready would fail already-requested/first-poll unit tests or immediate signal/health processes;
- slow-client shutdown would fail the binary elapsed/socket-close/restart test;
- detached connection tasks would fail in-process EOF/reset before `run_until` return;
- shutdown starvation would fail the 48-client bounded pressure test;
- secret leakage after process exit would fail the `ChildProcess.close`-based raw token/bearer scan;
- listener failure drift would fail the private injected code/lock/restart unit test;
- public ownership internals would be visible in the root module/API scan;
- status/count drift would fail the SSoT/evidence/workbench comparison and aggregate gates.

The evidence is therefore strong enough for this Critical Linux/WSL implementation slice.

## 9. Residual Risks And Delivery Decision

Accepted residual gaps:

- Windows and macOS behavior is unexecuted and must be proven in later owner-gated platform work.
- WSL/Linux evidence is not installed/package/signing/update/uninstall evidence.
- Hard-crash stale temporary-file scavenging is not implemented or claimed.
- The ready lease/equality guard is coordination, not authorization against an adversarial writer with directory access.
- F0-A2 token generation/file protection, Electron supervision, signed sidecar resolution, and Renderer isolation remain unimplemented.

**Final implementation verdict: ACCEPT.**
**Delivery state: AWAITING OWNER ACCEPTANCE.**

The product owner must still run/assess the supplied acceptance evidence and explicitly record `ACCEPT` or `REWORK REQUIRED`. Until that happens, F0-A1 is not owner-accepted and F0-A2 remains forbidden.
