# M6 Interaction Contract Final Critical Review

> **HISTORICAL / PARTIAL EVIDENCE / NOT CURRENT AUTHORIZATION.** This review remains evidence only for unchanged Domain, save, and interaction contracts. It does not accept or authorize the current Electron Shell, transport, security boundary, package layout, or implementation ownership; those require a new independent review of [m6-electron-shell.md](../m6-electron-shell.md).

**Date**: 2026-08-21
**Risk class**: Critical
**Status**: **ACCEPT**

## 1. Scope and Authorization Boundary

This record accepts the current M6 interaction and documentation baseline only. It does not authorize F0, F0-A1, or any product implementation, implementation-agent assignment, commit, push, merge, or release activity. Product implementation remains paused until the product owner explicitly authorizes it through the current controller and phase gates.

The review covers Result Review identity and integration, Draft save authority and device-local recovery, safe quit and startup recovery, immutable permissions, AgentInstance lineage, future implementation ordering and ownership, and historical review authorization safety.

## 2. Semantic Oracle Matrix

| Area | Verifiable oracle | Result |
|---|---|---|
| Result Review request identity | Runtime creates a stable persisted ResultReviewRequest with `execution.result.review_requested`; initial Reject uses only `resultReviewRequestId` and creates no ResultIntegrationAttempt. | pass |
| Apply, Retry, and Unknown | Actual Apply alone creates ResultIntegrationAttempt. Selection is union-nonempty and immutable. Retry uses a new command and attempt, preserves the source selection, and references a canonical failed attempt in the same request. Unknown must reconcile first. | pass |
| Saved authority | Transport accepted means only that the durable command ledger owns the command. Draft `revision`, `lastSavedAt`, and saved state advance only through the matching Event or authoritative Snapshot. | pass |
| Client Draft recovery scope | ClientDraftRecoveryRecord is device-local, scoped by Workspace and Draft identities, and never becomes a Domain/server API, canonical Draft, Version source, or saved-revision oracle. | pass |
| Client Draft recovery security | Journal validation covers record/reference integrity, corruption, orphaning, crash-safe revision writes, cleanup/retention, form-buffer restoration, and exclusion of secrets, absolute paths, handles, attachments, response bodies, and other forbidden content. | pass |
| Per-Draft hydration | After Runtime global readiness, each Draft remains read-only through canonical load, journal/registry validation, accepted/sending reconciliation, needs-action creation, FIFO reprojection/revalidation, and one-promoted-command validation. Only an atomically published hydrated queue opens editing; a corrupt Draft does not block other ready surfaces. | pass |
| Reapply | Conflict actions are exactly Reload, Review, and Reapply. Reapply retains the complete old conflict record while loading canonical state, then atomically transforms operations and buffers into a new identity-free LocalDraftBatch before deleting old refs. | pass |
| Safe quit | Graceful quit establishes a sidecar-wide command-admission fence, rejects new Domain commands with `runtime_shutting_down`, drains every accepted Draft row to applied/rejected/conflict, and waits for both Draft and Run barriers before safe acknowledgement. | pass |
| Zero-Run and forced exit | Zero active Runs cannot bypass the admission fence or accepted-command drain. The existing 30-second Continue waiting/Force quit flow applies. Force quit or crash restores from the original command identity and payload before write readiness. | pass |
| Runtime startup classification | Accepted-row convergence is only a sub-barrier. Command admission and business writes stay closed until supervisor markers, launches, deliveries, Handles, claims, Attempts, and every recovery owner have one durable canonical classification. `interrupted/degraded` or blocked plus typed Attention is stable classification and does not require user resolution before readiness. | pass |
| PermissionGrant immutability | An active Attempt/Handle Grant cannot be expanded or hot-replaced. Broader paths or capabilities require `amend_and_rework` and a new Snapshot, TaskExecution, AgentInstance, and Grant. `approve_once` applies only to the matching `ask` operation. | pass |
| AgentInstance lineage | Ordinary transient, formal Attempt recovery, recovered transient, and coordination-only recovery use the approved four unambiguous field combinations. Recovered transient keeps both current parent/spawn and old transient/Attempt recovery lineages; coordination-only creates no fabricated Attempt. | pass |
| Staged implementation ownership | Future work follows I1 -> F2/I2 -> F3-A -> F3-B/I4/I5-B -> F3-C/I3/I5-C -> F3-D/I6. Shell/gateway, protocol/schema, Runtime core, result review, history, scheduling, and feature namespaces are assigned to non-overlapping owners. | pass |
| Historical authorization safety | The four reopened M6/F1 review artifacts have top-level `HISTORICAL · PARTIAL EVIDENCE · NOT CURRENT AUTHORIZATION` banners. Their historical ACCEPT/PASS text cannot authorize current implementation. | pass |
| Runtime/browser execution evidence | This was a documentation-only Critical review while implementation is paused. Runtime and browser evidence is deferred to the applicable implementation gates. | not applicable |

There are no blocked final review areas.

## 3. Reverse Review

| Assumed regression | Evidence that catches it | Result |
|---|---|---|
| Initial Reject requires an Apply identity | Request-only Reject payload and zero-attempt acceptance scenario. | pass |
| Apply and Reject both win | Compare-and-set on the same ResultReviewRequest aggregate. | pass |
| Retry changes selection, reuses identity, or writes while Unknown | Immutable selection, failed-only source, new IDs, and reconcile-first state matrix. | pass |
| Accepted is displayed as saved | Event/Snapshot-only revision and `lastSavedAt` authority. | pass |
| Zero-Run quit kills accepted Draft work | Admission fence and accepted-row drain are mandatory even with no active Run. | pass |
| Force quit restarts with a new command | Startup uses the original `commandId`, expected revision, digest, and operations. | pass |
| Writes reopen while launch/recovery ownership remains unknown | Global readiness waits for the complete durable startup classification barrier. | pass |
| New edits race journal restoration | Per-Draft editing opens only after atomic hydrated-queue publication; new work appends to the restored FIFO tail. | pass |
| Reapply crash loses old and new local work | One crash-safe journal transaction exposes either the complete old record or complete new batch. | pass |
| Corrupt Draft blocks the whole product | The affected Draft remains needs-action/read-only while other hydrated Drafts and non-Draft surfaces remain ready. | pass |
| `approve_once` expands an active Grant | Operation-bound decision validation and mandatory `amend_and_rework` path. | pass |
| Invalid lineage reaches Adapter launch | Four-way validation in Domain, Event, scheduling, Session, and Adapter contracts. | pass |
| Two lanes edit the same persistence/schema tree | Explicit `persistence/core`, `persistence/schema`, `persistence/result_review`, `persistence/history`, and `persistence/scheduling` ownership. | pass |
| A historical report resumes implementation | In-file non-authorization banners and the current specs index. | pass |

**Reverse-review result**: pass. No unresolved High, Medium, or Low specification finding remains in the reviewed baseline.

## 4. Audit and Rework Trace

1. The initial clean-room Critical review rejected the baseline for undefined accepted-command shutdown handling, contradictory Reapply ordering, overlapping persistence ownership, direct-file historical authorization, stale ResultIntegrationAttempt fields, and unresolved example/command identifiers.
2. The owner-approved contract retained Runtime-created ResultReviewRequest identity, request-only initial Reject, immutable Apply/Retry identities, the four AgentInstance lineage combinations including recovered transient, and device-local-only ClientDraftRecoveryRecord authority.
3. The implementation repair added the sidecar admission fence and accepted-row drain, made Reapply crash-safe, split persistence ownership and added the F3-C history owner, added four historical banners, removed the stale Apply-attempt rejection field, and corrected logical-shape and command naming.
4. A second clean-room review rejected startup ordering because Draft-row convergence opened writes before complete Runtime recovery and before per-Draft journal hydration.
5. The final repair made accepted-row convergence a sub-barrier, added a complete durable Runtime startup classification barrier using the existing readiness fact, and added an independent per-Draft hydration barrier with atomic queue publication and corrupt-Draft isolation.
6. The final targeted clean-room review found no remaining issue and accepted the documentation baseline.

The earlier 99-versus-102 event count concern is not a finding. The controller ruled that Run Operations intentionally defines a 99-event minimum subset of the 102-event catalog, not a complete parity copy. All 99 minimum names exist in the catalog; the three catalog-only Workspace/diagnostic events do not contradict the minimum contract.

## 5. Final Evidence

- Tracked-document `git diff --check`: exit `0`.
- No-index whitespace checks for the untracked interaction specification and Herdr/Orca review: no diagnostics; exit `1` only because each file differs from `/dev/null`.
- Baseline Markdown validation before adding this review record: 58 Markdown files, 303 links, 302 local links, 1 external link, and 0 broken local links.
- Event/command catalogs: 102 unique events and 43 unique commands.
- Run Operations minimum events: 99 unique names; all 99 are a subset of the 102-event catalog.
- TypeScript specification examples: 3 fences compile with strict ES2022 and Bundler module resolution.
- Historical authorization scan: 4 of 4 target M6/F1 review artifacts contain the required top-level banner.
- Source-code changes for this review slice: none.
- Runtime/browser evidence: not applicable to this documentation-only review; required at implementation gates.

## 6. Required Implementation Evidence

The documentation acceptance does not waive implementation evidence. Future implementation gates must provide:

- P0 safe-quit and startup crash-window tests covering pre-admission, accepted-before-handler, in-transaction, Event-committed/response-lost, zero/multiple active Runs, 30-second timeout, Force quit, marker recovery, and write-ready gating.
- P0 ClientDraftRecoveryRecord and Reapply crash tests covering atomic revision writes, old-to-new transfer, form-buffer references, corruption, orphaning, sensitive-data exclusion, FIFO restoration, and per-Draft isolation.
- P0 Result Review race tests covering initial Reject, Reject/Apply competition, nonempty immutable selection, failure without partial write, Unknown reconciliation, duplicate commands, and new-identity Retry.
- P0 permission tests proving active Grant replacement is rejected, `approve_once` cannot expand policy, and `amend_and_rework` creates the required new immutable object chain.
- P0 exhaustive lineage truth-table tests for every valid combination and every missing/extra/mixed field combination before persistence and Adapter launch.
- P0 owner-manifest or equivalent static checks that reject overlapping shared/feature globs and duplicated protocol/schema ownership.
- Real Windows, macOS, and Linux Runtime, sidecar, PTY/ConPTY, process-tree, datastore-lock, permission-enforcement, Runner, quit/restart, and packaging evidence at the applicable F0/F3/F4 gates.

## 7. Canonical Documents Reviewed

- [M6 Domain Model](../m6-domain-model.md)
- [M6 Events and Commands Contract](../m6-events-commands.md)
- [M6 Run Operations](../m6-run-operations.md)
- [M6 Execution Workspace, Permissions, and History](../m6-execution-workspace-security.md)
- [Workspace Output Inspection](../workspace-output-inspection.md)
- [M6 Interaction Implementation Slices](../m6-interaction-implementation-slices.md)
- [M6 Orchestration Interaction](../m6-orchestration-interaction.md)
- [M6 Agent Session and Collaboration](../m6-agent-session-collaboration.md)
- [M6 Local Runtime and Scheduling](../m6-local-runtime-scheduling.md)
- [M6 Runner Adapter Contract](../m6-runner-adapter.md)
- [Ensemble Specs Index](../README.md)
- [F1 Shell Design System](../f1-shell-design-system.md) for review-index and reopened-contract truth only
- [Ensemble V2 Development Plan](../../12-dev-plan.md)
- [Decision Record](../../decisions.md)

## 8. Final Decision

**ACCEPT** the current M6 interaction and documentation baseline.

**End-state architecture**: **YES**. The baseline now consistently preserves Runtime-owned identities, Event/Snapshot save authority, device-local recovery boundaries, complete startup classification, per-Draft hydration, immutable permissions and lineage, staged non-overlapping ownership, and explicit implementation authorization gates.
