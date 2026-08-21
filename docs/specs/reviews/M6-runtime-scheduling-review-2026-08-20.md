# M6 Runtime and Scheduling Final Review

> **HISTORICAL · PARTIAL EVIDENCE · NOT CURRENT AUTHORIZATION**
>
> 本文件原样保留当时的审查正文、结论和证据，仅可用于未变化范围的历史参考。当前状态以 [Ensemble Specs Index](../README.md) 为准；下文任何 PASS、ACCEPT、ready、commit/push 或 next-lane 表述均为历史陈述，不能授权 F0/F0-A1、重新打开的 F1 合同或任何产品实现。

**Date**: 2026-08-20
**Risk class**: Critical
**Status**: PASS
**Scope**: Workflow termination, Runtime commands/events, Runner launch and result ownership, execution workspace selection, permission decisions, Agent collaboration, scheduling, shutdown, recovery, and history retention

## 1. Findings

The independent Critical re-review found `0` unresolved High findings, `0` unresolved Medium findings, and no new Low specification defect. M6 is ready to advance to the F0 cross-platform Spike; the Spike remains an evidence gate rather than a specification finding.

## 2. Semantic oracles

| Area | Verifiable invariant | Result |
|---|---|---|
| End outcome | Run success requires a completed success End, no completed failure End, and a converged execution graph; a failure End wins and has a stable `resultCode`. | pass |
| Optional Task | Only `optional=true` Tasks can enter `skipped`; `continue_optional` requires a `skipped` Transition; a failed Attempt is never rewritten as skipped. | pass |
| Blocked Join | An unreachable required input creates typed `join_blocked` Attention with retry/rework/fail actions; a new valid Handoff can reopen the Join. | pass |
| Run Amendment | `run.amend` atomically creates RunAmendment and an immutable descendant Snapshot, advances `activeSnapshotId`, and affects only unstarted work; failure applies nothing. | pass |
| Direct Task | Each user round creates an Attempt; a round result leaves the Direct Run idle; only explicit end, idle timeout, or cancel reaches Run finalization. | pass |
| Workspace selection | Runtime reserves capacity and creates the target AgentInstance before sending a stable SelectionRequest; timeout, conflict, or unknown never selects a default directory. | pass |
| Capacity | Every AgentInstance consumes a slot from creation through provisioning, blocked, running, paused, and stopping; the slot is released only after Handle and workspace resources converge. | pass |
| Runner qualification | Device availability is independent from Workspace/Run qualification; pre-Workspace qualification uses a policy digest and needs no existing Workspace ID. | pass |
| Attempt launch | Every first, continued, and recovery Attempt uses prepare/commit/query with a stable launch ID; a new process stays fenced before commit, and Unknown never creates a second Handle. | pass |
| Runner result | A result is bound to result ID, AgentInstance, Attempt, Handle generation, and digest; late output from a reused Handle cannot complete another Attempt. | pass |
| Session delivery | Conversation and instruction share `deliver_message`, receipt, delivery ID, dedupe, and unknown rules; Terminal input ownership prevents concurrent Session writes. | pass |
| Permission decision | `approve_once` matches one request, Handle generation, operation ID, and digest; it does not widen PermissionGrant, and an unknown receipt is not resent automatically. | pass |
| Spawn collaboration | Formal Tasks are dispatched by the root Dispatcher; transient workers are dispatched by their parent and return a contract-validated WorkerResult without completing the parent Attempt. | pass |
| Safe shutdown | Every live Handle is fenced; a mixed Run completes only after both plan reconciliation and process-free aggregate cleanup; plan and `continue_pre_attempt` targets can coexist without owner overlap; a Dispatcher Attempt/lease shared process candidate has one Attempt owner and one replacement Handle, including the prepare-before-registration window. | pass |
| Cancel cleanup | `terminationIntent=cancel` survives `canceling -> interrupted`; such a Run cannot resume or end as ordinary failure and can only continue cancel cleanup. | pass |
| Interrupted end | `run.end_failed` first persists `terminationIntent=fail`; it commits `failed/interrupted_ended` only after finalization resources converge. | pass |
| History deletion | Canonical Workspace Event rows and sequence never change; cleanup removes separate content/index/blob data and preserves typed tombstones for referenced identities. | pass |
| Attention identity | Attention uses typed `subjectRefs[]` for launch, selection, permission, message, worker result, and cleanup subjects; free text cannot replace identity. | pass |

## 3. Review areas

| Area | Result | Required evidence |
|---|---|---|
| Goal alignment | pass | M6 product and development plan remain centered on a concise desktop orchestration tool, not a temporary single-Agent implementation. |
| User-visible flow and timing | pass | Direct Task rounds, Agent status, directory choice, permission waits, termination, and recovery expose the canonical state in the correct order. |
| Architecture and ownership | pass | Client, Shell, Runtime, Adapter, Domain, and Persistence responsibilities remain one-directional and do not share mutable truth. |
| Data and save contracts | pass | Domain fields, commands, events, Adapter calls, and recovery records agree without fallback chains or inferred identity. |
| Implementation readiness | pass | F3 can be decomposed without inventing missing lifecycle states, transaction boundaries, or crash behavior. |
| Cross-platform feasibility | pending F0 verification | Windows/macOS/Linux must prove process control, PTY/ConPTY, permission enforcement, path handling, signing, and all nine supported Runner combinations before F0 is accepted. |

## 4. Mechanical evidence

- Run Operations minimum events: `87`
- Event catalog: `92`; missing: `0`; catalog-only: `5`
- Markdown files: `56`
- Local Markdown links: `260`; broken: `0`
- Duplicate Markdown headings: `0`
- Unclosed code fences: `0`
- Active V2 documents containing retired score or music metaphors: `0`
- Tracked diff and untracked Markdown whitespace: pass
- `git diff --check`: pass
- Domain model size: `1864` lines

## 5. Independent review

The existing independent M6 auditor re-read the latest file snapshot and returned `0 High / 0 Medium`, with no new Low specification defect. The review covered all 18 semantic oracles and reverse-simulated the final Dispatcher recovery window:

- an AttemptLaunch has entered prepare and persisted pending Dispatcher leases but has no prepared receipt or RunnerHandleRegistration
- the ShutdownRecoveryPlan freezes the complete pending lease set and assigns the launch record and leases only to the recoverable Attempt owner
- matching `terminate_launch` evidence rejects the launch and revokes the pending leases in one convergence transaction while preserving their IDs as replacement sources
- Unknown termination does not complete shutdown or create a second owner
- Resume creates one replacement AttemptLaunch, RunnerHandleRegistration, and Handle, then activates the replacement lease on the same commit
- a crash during `resuming` replays the durable `resumeTargets[]` instead of deriving a new target set

Cross-platform feasibility remains `pending F0 verification`. F0 is the first implementation stage, not a pre-development blocker; the evidence is required before F0 acceptance and cross-platform release claims.

## 6. Next gate

After this review reaches PASS with no unresolved High or Medium findings, execute the F0 Windows/macOS/Linux Runtime, PTY/ConPTY, permission, Runner, single-instance, scheduling, and recovery Spike in [m6-platform-packaging.md](../m6-platform-packaging.md). No production Runtime implementation starts before that evidence is written back to the architecture and platform SSoT.
