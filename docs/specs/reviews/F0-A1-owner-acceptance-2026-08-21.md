# F0-A1 Rust Runtime Bootstrap Owner Acceptance

**Date:** 2026-08-21
**Owner decision:** **ACCEPT**
**F0-A1 state:** **OWNER ACCEPTED / ACCEPTED**
**Implementation commit:** `aacc6d0dc68f3805b31aa69316561b8cdacad2a0`
**Source baseline:** `main@32ea2997c570955fae07902ddb5c620e18c728cf`
**Branch:** `main`
**Implementation review:** [F0-A1 Runtime Implementation Critical Review](F0-A1-runtime-implementation-review-2026-08-21.md) · **ACCEPT**
**Implementation review SHA-256:** `2bd8f1f183e6385f6ca3948ad25cb9f0425186d7f718c7848978a53ab5e2745f`
**Acceptance-delivery checkpoint:** implementation and owner-acceptance status were **PUSHED** through `c27e4bcc902854e29b08c42d0c659999dbf8767a`; local, tracking, and remote `main` were synchronized at that checkpoint before the later ledger-only commit
**Owner-acceptance status commit:** `c27e4bcc902854e29b08c42d0c659999dbf8767a` · **PUSHED**

## 1. Explicit Owner Decision

The owner explicitly instructed: `你继续吧，我没停你就继续，过程中产生的审批都同意`.

This instruction records **Owner ACCEPT** for the reviewed F0-A1 Rust Runtime Bootstrap implementation at commit `aacc6d0dc68f3805b31aa69316561b8cdacad2a0`. F0-A1 is owner-accepted and closed as an implementation slice.

The same instruction provides standing authorization to continue later phases only after each phase's required technical, security, runtime-evidence, quality, independent-review, and delivery gates close. It does not waive, bypass, or pre-approve the result of any gate.

## 2. Accepted Scope

Owner acceptance covers only the reviewed Linux/WSL F0-A1 contract:

- standalone Rust `ensemble-runtime` binary with no Runtime Python/Node dependency;
- canonical data-root ownership and exclusive datastore lock;
- data-root-disjoint atomic ready coordination with persistent ready-path lease;
- OS-assigned `127.0.0.1` health-only HTTP/1.1 listener;
- bearer authentication on every route and exact versioned health response;
- owned HTTP connection-task registry with shutdown-first selection, one-second drain, abort/join-to-empty, and socket closure before ownership release;
- stable failure codes, flat secret-free lifecycle logs, graceful ready removal, lock release, and restart;
- producer/Shell responsibility for at least 32 bytes of CSPRNG token material, with Runtime validating token68 syntax/minimum encoded material only.

This acceptance does not change Domain, Command/Event, Runtime API meaning, persistence schema/fields, save semantics, or product behavior.

## 3. Environment And Evidence

Accepted environment:

```text
os_pretty=Ubuntu 24.04.3 LTS
kernel=Linux 6.6.87.2-microsoft-standard-WSL2 x86_64
rustc=rustc 1.95.0 (59807616e 2026-04-14)
cargo=cargo 1.95.0 (f2d3ce0bd 2026-03-21)
node=v22.22.0
pnpm=9.15.0
```

Accepted commands and results:

| Command/evidence | Accepted result |
| --- | --- |
| `pnpm verify:f0-a1` | 28/28 authored tests: 10 unit, 16 black-box process integration, 2 in-process owned-server integration |
| Black-box process evidence | 70 binary invocations: 69 bootstrap attempts and 1 CLI help inspection |
| `pnpm smoke:f0-a1` | `401/401/401/200`, same-root rejection, distinct-root concurrency, no child process, graceful ready removal, restart, completed-stream secret scan |
| `pnpm quality` | full repository aggregate passed |
| Owned connection proof | incomplete client and 48-client accept pressure closed before `run_until` returned; `JoinSet` drained/abort-joined to empty |
| Ready ownership proof | exact/alias inside-root rejection, active shared-path rejection without mutation, stale takeover only after OS lease release |
| Immediate shutdown proof | deterministic first-poll/already-requested tests plus 24 immediate post-ready real-process SIGTERM trials |

Canonical implementation evidence is [F0-A1 WSL/Linux Implementation Evidence](../evidence/f0-a1/wsl-linux-2026-08-21.md).

## 4. Residual Gaps

The following accepted residual gaps are later gates, not reasons to reject F0-A1:

- Windows binary execution, locking, canonicalization, ready replacement, CTRL-C, and filesystem evidence;
- macOS binary execution, signals, locking, canonicalization, and filesystem evidence;
- hard-crash temporary-ready scavenging during the atomic-publication crash window;
- installed/package/signing/notarization/update/uninstall evidence;
- Electron supervisor, production token generation/file protection, signed sidecar resolution, Renderer isolation, and Shell transport;
- future WebSocket/Event/session transport, which must own every upgrade/session task in an explicit registry.

These items remain subject to their F0-A2/F0-A3 and later platform/product gates.

## 5. Subsequent Authorization

The owner-acceptance/delivery status commit `c27e4bcc902854e29b08c42d0c659999dbf8767a` has been pushed, so the delivery condition is fulfilled. F0-A2 is the active authorized next phase and may start now, subject to all of its technical, security, evidence, quality, independent-review, and delivery gates.

After F0-A2, standing authorization permits the controller to continue into subsequent phases only when each preceding phase's technical and independent-review gates have closed. No phase may skip its architecture, security, runtime, platform, quality, evidence, review, or delivery requirements. Later phases are authorized conditionally; they are not currently implemented or automatically accepted.

## 6. Delivery Ledger

- Reviewed implementation commit: `aacc6d0dc68f3805b31aa69316561b8cdacad2a0`
- Source baseline: `32ea2997c570955fae07902ddb5c620e18c728cf`
- Branch: `main`
- Independent implementation verdict: **ACCEPT**
- Owner verdict: **ACCEPT**
- Implementation commit: `aacc6d0dc68f3805b31aa69316561b8cdacad2a0` · **PUSHED**
- Owner-acceptance status commit: `c27e4bcc902854e29b08c42d0c659999dbf8767a` · **PUSHED**
- Acceptance-delivery checkpoint: local/tracking/remote `main` were synchronized through `c27e4bcc902854e29b08c42d0c659999dbf8767a` before this later ledger-only synchronization commit
- F0-A2 start: **AUTHORIZED / MAY START NOW**

The acceptance implementation/status SHAs and push result above are final for this record. Any future documentation-only delivery-ledger synchronization commit SHA is recorded by the controller in dev-workbench rather than recursively added to this self-contained acceptance record.
