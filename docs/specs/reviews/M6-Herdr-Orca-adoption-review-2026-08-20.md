# M6 Herdr and Orca Pattern Adoption Review

> **HISTORICAL · PARTIAL EVIDENCE · NOT CURRENT AUTHORIZATION**
>
> 本文件原样保留当时的审查正文、结论和证据，仅可用于未变化范围的历史参考。当前状态以 [Ensemble Specs Index](../README.md) 为准；下文任何 PASS、ACCEPT、ready、commit/push 或 next-lane 表述均为历史陈述，不能授权 F0/F0-A1、重新打开的 F1 合同或任何产品实现。

**Date**: 2026-08-20
**Risk class**: Critical
**Status**: **ACCEPT**
**Scope**: Runtime activity, supervised dispatch, Runner Handle lifecycle, completion evidence, ContextPackage contracts, restore semantics, execution workspace modes, Diff review, and long-wait behavior adopted from Herdr and Orca references

## 1. Result

The independent read-only review found `0` unresolved High findings, `0` unresolved Medium findings, and `0` Low findings. The adopted patterns are specific enough to remain part of the M6 product and protocol baseline.

This acceptance does not resume F0-A1 implementation. F0 remains `SPEC READY · IMPLEMENTATION PAUSED` until the owner explicitly authorizes implementation.

## 2. Accepted Oracles

| Area | Verifiable invariant | Result |
|---|---|---|
| Product position | Ensemble remains a visual, reusable Workflow product executed by Runtime; Terminal, files, worktrees, and Diff remain execution and inspection tools. | pass |
| Agent activity | UI activity is exactly `working | blocked | done | idle | unknown`; it does not replace Task outcome or Run health. | pass |
| Evidence authority | Canonical Runtime state outranks structured hooks, Adapter lifecycle, provider metadata, and PTY heuristics; heuristics cannot decide success, permissions, Artifacts, or recovery. | pass |
| Dispatch ownership | A transient worker remains supervised by its parent Attempt; only a formal Handoff transfers responsibility across Task or Seat boundaries. | pass |
| Handle lifecycle | Every settled Attempt with a registered Handle records `reuse | retain | release`; coordination-protected Handles cannot be retained, released, or stopped by idle policy. | pass |
| Coordination rotation | Protection covers relevant active/rotating leases, same-Handle pending replacement leases/launches, and non-terminal CoordinationLaunch records; finalization closes those barriers before release. | pass |
| Completion evidence | ArtifactCandidate identity is `sourceSignalId + artifactCandidateId`; complete semantic equality replays, while any changed field or digest conflicts. | pass |
| Success order | Candidate Event precedes RunnerResult Event, contract validation, formal Artifact Event, and Attempt/Task success. | pass |
| Context versions | Adapter capability and RunnerQualification separately match coordination contract, operation guide, and applicable completion receipt schema versions. | pass |
| Restore semantics | UI, conversation, live process, transcript, and business operation restore claims remain separate. | pass |
| Native Terminal | Runner-native slash commands and TUI stay in raw Terminal; Ensemble does not mirror Runner command catalogs. | pass |
| Workspace modes | Shared Git/non-Git root, Git worktree, and temporary directory remain the complete execution workspace modes; workers do not imply worktrees. | pass |
| Diff review | Inline review targets immutable Change Sets; Rework consumes an immutable DiffReviewBundle rather than mutable thread state. | pass |
| Long waits | A long-wait checkpoint requests observation or Attention; liveness and output cannot settle business outcome or release capacity. | pass |

## 3. Explicit Exclusions

- Terminal-first product architecture or pane layout.
- External Terminal import into formal orchestration.
- Unrestricted retained Handles or retained business input.
- IDE/editor, Git staging, commit, or conflict-editing features.
- Browser, SSH, mobile, GitHub, or Linear integration suites.
- PTY text, self-report, transcript replay, or provider-native session resume as business truth.
- Implicit worktree creation for each worker.

## 4. Mechanical Evidence

- Run Operations minimum events: `93`
- Event catalog: `98`; missing minimum events: `0`
- Product and specification Markdown files: `58`
- Local Markdown links: `294`; broken: `0`
- Duplicate headings: `0`
- Unclosed code fences: `0`
- Retired music terminology in active M6 documents: `0`
- `git diff --check`: pass
- Domain model size: `1976` lines
- Staged files: `0`

## 5. Canonical Sources

- [Adopted Runtime Patterns](../m6-adopted-runtime-patterns.md)
- [Domain Model](../m6-domain-model.md)
- [Agent Session and Collaboration](../m6-agent-session-collaboration.md)
- [Runner Adapter](../m6-runner-adapter.md)
- [Run Operations](../m6-run-operations.md)
- [Events and Commands](../m6-events-commands.md)
- [Local Runtime and Scheduling](../m6-local-runtime-scheduling.md)
- [Workspace Output Inspection](../workspace-output-inspection.md)
