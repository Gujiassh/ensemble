# F0-A Runtime Lifecycle Implementation and Owner Acceptance

**Date**: 2026-08-20
**Risk class**: Critical
**Overall status**: IMPLEMENTATION PAUSED BY OWNER
**Current slice**: F0-A1 Rust Runtime Bootstrap specification ready; implementation awaits owner authorization

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
| F0-A1 | Independent Rust Runtime bootstrap, authenticated loopback health, canonical data-root ownership, and datastore lock | SPEC READY · IMPLEMENTATION PAUSED | Owner authorizes implementation to resume |
| F0-A2 | Tauri supervisor, per-data-root Shell ownership, second-instance activation, tray lifecycle, and explicit Runtime shutdown | PENDING | Owner accepts F0-A1 |
| F0-A3 | Native Windows and WSL lifecycle proof, process-tree cleanup, and evidence writeback | PENDING | Owner accepts F0-A2 |

macOS build and native lifecycle evidence remains part of the wider F0 platform matrix. It does not prevent F0-A1 development or Windows/WSL acceptance.

## 3. F0-A1 scope

F0-A1 creates the production Rust sidecar foundation. It does not preserve or adapt the Python M0-M5 Runtime.

Required behavior:

- build a standalone `ensemble-runtime` Rust binary without Python or Node at runtime
- accept an explicit data root and resolve it to one canonical absolute path before opening Runtime state
- acquire an exclusive datastore lock for that canonical data root before serving requests
- allow different data roots to run concurrently while rejecting a second Runtime for the same data root
- bind only to `127.0.0.1` on an operating-system-assigned port
- require a high-entropy session token for every HTTP request, including health checks
- publish an atomic ready descriptor only after the lock and authenticated listener are ready
- expose a versioned authenticated health response with Runtime PID, protocol version, and a non-secret data-root digest
- remove the ready descriptor on graceful shutdown when the current process still owns it
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

The token file contains at least 256 bits of unpredictable token material. The Runtime reads it during bootstrap and never writes the token to the ready descriptor or logs.

The ready descriptor is written through a temporary file plus atomic replacement and contains:

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
| Ready ordering | The ready descriptor never appears before lock and listener readiness. | Crash-window test |
| Shutdown | Graceful termination removes only the current owner's ready descriptor and releases the lock. | Restart smoke test |
| Failure honesty | Lock conflict, invalid token file, invalid data root, or listener failure exits non-zero and never leaves a valid ready descriptor. | Negative tests |

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

- Tauri tray behavior or window activation
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
