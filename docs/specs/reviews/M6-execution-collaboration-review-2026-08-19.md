# M6 Execution and Collaboration Spec Review

**Date**: 2026-08-19
**Risk class**: Critical
**Scope**: Agent collaboration, execution directories, permissions, history, output inspection, Runner qualification, and the first multi-Agent runtime slice
**Status**: **SUPERSEDED** by [M6-runtime-scheduling-review-2026-08-20.md](M6-runtime-scheduling-review-2026-08-20.md)

This report records an earlier review boundary. Later runtime work added and changed End outcomes, Optional skip, Run Amendment, Direct Task lifecycle, AttemptLaunch, RunnerResult ownership, permission operation delivery, safe shutdown, capacity reservation, RunnerQualification, history deletion, and cancel cleanup. The acceptance statement, event count, and no-High/Medium claim below are historical and must not be used as the current implementation gate.

## 1. Historical review result

**SUPERSEDED ACCEPT.** At this review boundary, the product behavior and implementation contracts were considered specific enough to start the Backend/process-shape Spike and decompose F3-A, F3-B, and F3-C. That conclusion was invalidated by later protocol findings and is replaced by the 2026-08-20 review.

No unresolved product decision in this scope requires another user choice before the Spike starts.

## 2. Frozen behavior

| Area | Oracle | Result |
|---|---|---|
| Execution directory | The explicit dispatcher chooses `shared_workspace`, `git_worktree`, or `temporary_directory`; Runtime records the reason and never silently substitutes another mode. | pass |
| Root bootstrap | The root Dispatcher defaults to `shared_workspace`; the user can override it before Run start. | pass |
| Isolated result integration | `review` is the default; `auto_if_clean` and `manual` are configurable; failed integration leaves no partial writes. | pass |
| Seat Session | A Seat has one long-lived Session projection; every message still belongs to a Task and Run. | pass |
| Direct conversation | A Direct Task creates an immutable minimal `Start -> Task -> End` RunSnapshot and a new AgentInstance. | pass |
| Spawn policy | `auto | ask | deny`, default `auto`; defaults are 4 active Workspace instances, 2 active children per parent, depth 2, and 8 total instances per Run. | pass |
| Runner qualification | Every supported Runner provides Context package delivery plus Session and Terminal backed by the same PTY/ConPTY process handle. | pass |
| CLI interaction | Ensemble does not mirror or discover CLI slash-command recommendations; native CLI interaction remains in Terminal. | pass |
| Permissions | Four profiles and five independent capability policies are frozen; workers cannot widen inherited grants. | pass |
| Additional directories | Native selectors create explicit grants shown under a separate **Allowed paths** root. | pass |
| Secrets | Credentials use OS storage references; structured records are redacted; raw Terminal output is best-effort redacted and warned on export. | pass |
| History | Canonical messages, events, decisions, lineage, Attention, deliverables, and Change Set references persist; raw transcript defaults to 30 days and 100 MB per Run. | pass |
| Change completeness | Unregistered roots under `full_access` produce `partial` Change Sets, which cannot satisfy a complete Review Gate. | pass |
| First runtime acceptance | The first accepted runtime path uses at least two formal Seats, real parallel instances, one transient worker, `pi`, a second real CLI, and cross-Runner context delivery. | pass |

## 3. Cross-layer review

| Review area | Result | Evidence or boundary |
|---|---|---|
| Goal alignment | pass | The plan keeps the organization canvas and flexible orchestration as the product center; it does not replace them with a chat or three-column shell. |
| User-visible flow | pass | Workspace creation, Run preview, Active Seats, Session/Terminal, files, Diff, deliverables, Attention, and isolated-result actions have explicit entry and state rules. |
| Architecture boundaries | pass | Domain objects remain independent of Runner-specific UI; Terminal bytes use a separate authenticated channel and cannot directly mutate canonical Run state. |
| Data and save contracts | pass | RunSnapshot, AgentInstance, Attempt, ContextPackage, PermissionGrant, ChangeSet, and ResultIntegrationAttempt have distinct ownership and immutable history rules. |
| Permission enforcement | blocked by Spike | Prompt-only enforcement and Terminal screen scraping are explicitly rejected; actual brokers and official Runner hooks still require platform evidence. |
| Cross-platform packaging | blocked by Spike | Windows, macOS, and Linux must prove installation, Backend lifecycle, PTY/ConPTY, path handling, credential storage, and cleanup. |
| Runner distribution | blocked by Spike | Default `pi` distribution must not require a user-installed Node runtime; the second CLI must pass the same qualification contract. |
| Verification and evolution | pass for specs | The development plan separates F3-A foundation, F3-B multi-Agent acceptance, and F3-C intervention/history without creating a single-Agent throwaway architecture. |

## 4. Semantic oracles for implementation

The implementation review must reject a slice if any of these statements becomes false:

1. Session and Terminal never represent two processes as one AgentInstance.
2. A Runner signal cannot change Task, deliverable, approval, or permission state unless Runtime persists the corresponding canonical event.
3. A transient worker cannot receive a broader path, network, process, destructive-command, or publish grant than its parent.
4. Starting a Run freezes the effective Runner, execution directory, permission, spawn, locale, and integration policies.
5. An integration conflict or validation failure cannot leave the target Workspace partially modified.
6. A `partial` Change Set cannot be presented as complete evidence or pass a complete Review Gate.
7. A Direct Task remains searchable and recoverable through the same Task, Run, Message, and AgentInstance model as a Workflow Run.
8. The first accepted runtime release cannot substitute sequential logs, two `pi` processes, or a browser-only preview for the required real multi-Agent and cross-Runner flow.

## 5. Historical verification evidence

- `git diff --check`: pass
- Local Markdown links: 230 checked, 0 broken
- Duplicate Markdown headings: 0
- Canonical event parity: 50 events at this historical boundary; this count is invalid after later protocol expansion
- Active V2 documents containing retired score or music metaphors: 0

## 6. Next gate

Run [m6-platform-packaging.md](../m6-platform-packaging.md) with a minimal real Shell/Backend/Runner harness. Write the selected process shape and evidence back to [m6-architecture.md](../m6-architecture.md), [m6-runner-adapter.md](../m6-runner-adapter.md), [platform-adaptation.md](../../ssot/platform-adaptation.md), and [12-dev-plan.md](../../12-dev-plan.md) before production Backend implementation begins.

## 7. Independent review rework

An independent read-only Agent found implementation-contract gaps that the primary review missed. At this historical boundary, the rework added:

- complete NodeExecution, TaskAttempt, Attention, Artifact, DecisionRecord, EvidencePin, export, and deletion entities
- replayable Node input arrival and lifecycle events for Start, End, Gate, and Join
- atomic `direct_task.start` object and Event creation before Runner startup
- distinct conversation/instruction Message semantics and queued next-Attempt delivery
- structured RunnerSignal requests for spawn and execution-directory selection
- one canonical Runner availability enum across Domain, Adapter, and Client
- accepted/rejected/superseded Decision eligibility rules
- Workspace-scoped history event envelopes and deletion failure state

The same independent Agent completed four read-only review passes and reported no High or Medium findings for that version. Later review invalidated that claim by finding additional protocol gaps. The historical mechanical evidence was 230 local links with 0 broken, 751 in-scope headings with 0 duplicates, 50 required events with 50 unique catalog entries and 0 missing, clean tracked and untracked Markdown whitespace, and 0 retired visual terms in active V2 sources.
