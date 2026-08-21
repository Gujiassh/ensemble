# F0-A Runtime Lifecycle Implementation and Owner Acceptance

**Date**: 2026-08-20
**Risk class**: Critical
**Overall status**: F0-A1 OWNER ACCEPTED / ACCEPTED · F0-A2 AUTHORIZED NEXT AFTER DELIVERY PUSH
**Current slice**: F0-A1 Rust Runtime Bootstrap implementation and owner verdicts ACCEPT; F0-A1 is OWNER ACCEPTED; F0-A2 is authorized to start after the acceptance/delivery status commit is pushed

## 1. Purpose

F0-A proves the selected desktop process shape through small owner-accepted slices. It is the first implementation stage, not a pre-development blocker.

Each slice must pass three gates before the next slice starts:

1. The implementation Agent reports changed files, tests, runtime evidence, and unresolved risks.
2. The main controller independently reviews the diff and reruns the required checks.
3. The owner runs the supplied acceptance steps and records `ACCEPT` or `REWORK REQUIRED`.

Engineering completion is not owner acceptance. A later slice must not silently convert an earlier `AWAITING OWNER ACCEPTANCE` result into `ACCEPTED`.

## 2. Slice order

| Slice | Deliverable | Status | Start condition |
|---|---|---|---|
| F0-A1 | Independent Rust Runtime bootstrap, authenticated loopback health, canonical data-root ownership, and datastore lock | OWNER ACCEPTED / ACCEPTED | Closed |
| F0-A2 | Electron Supervisor/Security Bridge: Security-owned BrowserWindow/external confirm, closed activation, Workspace-create commandId/selection binding, exact byte-credit streams, and signed sidecar | AUTHORIZED NEXT | Acceptance/delivery status commit pushed; own technical/review gates remain mandatory |
| F0-A3 | Windows/macOS/Linux Electron+Runtime lifecycle, final-binary fuse readback, signing/update/uninstall, closed activation/log proof, and installed-app IME/a11y matrix | PENDING | Owner accepts F0-A2 |

Windows, macOS, and Linux Electron lifecycle evidence belongs to F0-A3. It does not change any F0-A1 Runtime contract or authorize F0-A1 implementation.

## 3. F0-A1 scope

F0-A1 creates the production Rust sidecar foundation. It does not preserve or adapt the Python M0-M5 Runtime.

Required behavior:

- build a standalone `ensemble-runtime` Rust binary without Python or Node at runtime
- accept an explicit data root and resolve it to one canonical absolute path before opening Runtime state
- acquire an exclusive datastore lock for that canonical data root before serving requests
- allow different data roots to run concurrently while rejecting a second Runtime for the same data root
- bind only to `127.0.0.1` on an operating-system-assigned port
- require a producer-generated high-entropy session token for every HTTP request, including health checks; Runtime validates token68 syntax/minimum encoded material but cannot validate unpredictability
- require the canonical ready target to be outside the canonical data root, hold a persistent sibling cross-process ready-path lease, and publish an atomic descriptor only after both locks and the authenticated listener are ready
- expose a versioned authenticated health response with Runtime PID, protocol version, and a non-secret data-root digest
- own every accepted health-only HTTP/1.1 connection task, deterministically prioritize shutdown over accept pressure, bound graceful drain to 1 second, abort/join all remainder, then remove the ready descriptor when the current process still owns it and release both leases; protocol upgrades/WebSockets remain disabled
- emit flat, grep-friendly lifecycle logs without the session token, absolute secret-file contents, or request bodies

The implementation may use a dedicated crate under `crates/`. It must not modify the existing frontend Mock files.

## 4. F0-A1 bootstrap contract

The initial CLI contract is:

```text
ensemble-runtime \
  --data-root <path> \
  --session-token-file <path> \
  --ready-file <path>
```

The token producer must generate at least 32 unpredictable bytes with a cryptographically secure random generator. The Runtime reads the encoded token during bootstrap and never writes it to the ready descriptor or logs; its token68/minimum encoded-material checks do not and cannot prove entropy. The owner smoke proves its own 32-byte CSPRNG generation. F0-A2 must later prove production Shell generation and token-file protection without changing the accepted token encoding contract.

The ready target's existing parent is canonicalized. The target must be outside the canonical data root and must not use the reserved `.ensemble-runtime-ready.lock` suffix. The Runtime holds a persistent sibling lease file for the target's lifetime; the lease file is not unlinked on drop. The ready descriptor is written through a same-directory temporary file plus atomic replacement and contains:

```text
protocolVersion
pid
host
port
dataRootDigest
startedAt
```

`host` must equal `127.0.0.1`. `port` must be the actual assigned listener port. `dataRootDigest` identifies the canonical path without exposing it.

The first endpoint is:

```text
GET /v1/health
Authorization: Bearer <session-token>
```

Expected results:

- matching token: `200` and the versioned health payload
- missing or mismatched token: `401`
- non-loopback bind request: unsupported because no such CLI option exists

## 5. F0-A1 semantic oracles

| Area | Verifiable invariant | Evidence |
|---|---|---|
| Runtime independence | The built binary starts with Python and Node unavailable from `PATH`. | Process smoke test |
| Canonical ownership | Two path spellings that resolve to the same data root contend on one datastore lock. | Integration test |
| Isolation | Two distinct data roots can run concurrently on distinct assigned ports. | Integration test |
| Authentication | Missing and incorrect bearer tokens return `401`; the correct token returns `200`. | HTTP integration test |
| Secret handling | Token material is absent from ready data and captured logs. | Assertion over evidence files |
| Ready ordering | The ready descriptor never appears before data-root lock, ready-path lease, listener, and shutdown registration readiness. | Poll-order and repeated post-ready signal tests |
| Ready coordination | Ready equal to/inside the canonical data root is rejected; an active ready path cannot be shared across roots; a stale descriptor is replaceable only after the prior lease releases. | Exact/alias and shared-path process tests |
| Shutdown | Graceful termination stops accept, gives owned HTTP tasks at most 1 second to drain, aborts/joins every remainder before return, removes only the current owner's ready descriptor, and releases both leases even with an incomplete request. | In-process ownership, socket-close, slow-request, and restart tests |
| Failure honesty | Lock/token/data-root/listener/ready failures return stable failure and do not publish or mutate a descriptor the failed process would own. An active descriptor remains unchanged; stale replacement occurs only after acquiring the released lease and successfully publishing. | Negative tests |

## 6. Owner acceptance for F0-A1

The delivery must provide one command that runs the automated suite and one command that starts a manual Runtime instance. The owner will verify:

1. The Runtime starts in WSL and prints a ready line without exposing the token.
2. An unauthenticated health request returns `401`.
3. An authenticated health request returns `200` with the expected protocol version and PID.
4. Starting a second Runtime with the same data root fails clearly and does not affect the first process.
5. Starting a Runtime with a different data root succeeds at the same time.
6. Stopping the first Runtime and starting it again with the original data root succeeds.
7. No Python Runtime process is created.

The acceptance record must include the commit SHA, operating system, commands, observed results, and the owner's explicit decision.

## 7. F0-A1 non-goals

F0-A1 does not implement:

- Electron tray behavior, BrowserWindow security, Preload/IPC, window activation, or updater
- WebSocket/HTTP upgrade, Event stream, or session transport; a future authorized slice must put every upgrade/session task in an explicit owned registry
- Shell-side supervisor ownership
- SQLite Event ledger schema or business Domain commands
- Runner discovery, AttemptLaunch, PTY/ConPTY, or permission enforcement
- macOS signing, notarization, or native lifecycle proof
- frontend settings, Workspace creation, or orchestration UI

These concerns remain in later owner-accepted slices and must not be added speculatively to F0-A1.

## 8. Required implementation evidence

- formatting, lint, unit, and integration test commands with results
- a WSL process smoke log using flat `tag key=value` lines
- ready descriptor with non-secret values
- authenticated and unauthenticated health responses
- same-root rejection and different-root concurrency evidence
- graceful stop, lock release, and restart evidence
- independent Critical review with each semantic oracle marked `pass`, `blocked`, or `not applicable`
- owner acceptance result

Current implementation evidence:

- `pnpm verify:f0-a1`: pass; format, production/all-target Clippy, 10 unit tests, 16 black-box process integration tests, and 2 in-process owned-server integration tests
- `pnpm smoke:f0-a1`: pass on WSL/Linux with empty Runtime environment, `401`/`200`, same-root rejection, different-root concurrency, no child process, SIGTERM removal, and restart
- sanitized record: [F0-A1 WSL/Linux implementation evidence](evidence/f0-a1/wsl-linux-2026-08-21.md)
- enforceable bootstrap contract and owner runbook: [Rust Runtime Bootstrap SSoT](../ssot/runtime-bootstrap.md)
- independent Critical review: [**ACCEPT**](reviews/F0-A1-runtime-implementation-review-2026-08-21.md)
- owner acceptance: [**ACCEPT**](reviews/F0-A1-owner-acceptance-2026-08-21.md); F0-A1 is OWNER ACCEPTED

Owner acceptance authorizes F0-A2 as the next phase after this acceptance/delivery status commit is pushed. Windows/macOS platform proof and every later technical/review/quality gate remain mandatory.
