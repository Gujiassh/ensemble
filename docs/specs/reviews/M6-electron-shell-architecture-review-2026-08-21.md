# M6 Electron Shell Architecture Critical Review

**Date**: 2026-08-21
**Risk class**: Critical
**Status**: **ACCEPT**
**Scope type**: Documentation architecture, security, transport, ownership, packaging, and transition contract only

## 1. Authorization Boundary

This review accepts the Electron Shell documentation architecture. It does not claim that Electron source, package manifests, fuse output, signed installers, platform lifecycle behavior, or installed-app evidence exists.

This acceptance does not authorize or resume F0, F0-A1, F0-A2, F0-A3, F1, F4, product implementation, implementation-Agent assignment, source changes, Runtime API changes, package work, commit, push, merge, deployment, or release. All implementation remains paused until the product owner explicitly opens the applicable phase through the controller. F0-A2 still depends on accepted F0-A1 delivery; F0-A3 still depends on accepted F0-A2 delivery; F1 Renderer reacceptance and Electron integration remain later gates.

The previous [M6 Interaction Contract Final Critical Review](M6-interaction-contract-final-review-2026-08-21.md) remains historical partial evidence for unchanged Domain, save, and interaction contracts only. It does not authorize Electron Shell security, transport, packaging, or implementation ownership.

## 2. Scope And Canonical Sources

Primary reviewed sources:

- [M6 Electron Shell and Rust Runtime Boundary](../m6-electron-shell.md)
- [M6 Architecture and Boundaries](../m6-architecture.md)
- [F0-A Runtime Lifecycle and Owner Acceptance](../f0-a-runtime-lifecycle.md)
- [F1 Desktop Shell, Design System, and Workspace Entry](../f1-shell-design-system.md)
- [M6 Local Runtime and Scheduling](../m6-local-runtime-scheduling.md)
- [M6 Cross-Platform Packaging Spike](../m6-platform-packaging.md)
- [M6 Events and Commands Contract](../m6-events-commands.md)
- [M6 Execution Workspace, Permissions, and History](../m6-execution-workspace-security.md)
- [M6 Agent Session and Collaboration](../m6-agent-session-collaboration.md)
- [M6 Orchestration Interaction](../m6-orchestration-interaction.md)
- [Workspace Output Inspection](../workspace-output-inspection.md)
- [M6 Product Rebuild](../m6-product-rebuild.md)
- [M6 Interaction Implementation Slices](../m6-interaction-implementation-slices.md)

Canonical indexes, decisions, SSoT, quality, and transition sources:

- [Ensemble Overview](../../00-overview.md)
- [Ensemble V2 Development Plan](../../12-dev-plan.md)
- [Decision Record](../../decisions.md)
- [Specs Index](../README.md)
- [Platform Adaptation SSoT](../../ssot/platform-adaptation.md)
- [Code Quality and Maintainability SSoT](../../ssot/code-quality.md)
- [Design System SSoT](../../ssot/design-system.md)
- [CrewAI SSoT](../../ssot/crewai.md)

No Electron implementation or packaging artifact was treated as existing evidence.

## 3. Owner-Approved Decisions

The accepted direction is:

1. Ensemble has one target production desktop Shell: Electron. It does not maintain a Tauri/Electron dual-production compatibility route.
2. The existing React Canvas remains the Renderer. Electron supplies a fixed Chromium environment for consistent Windows, macOS, and Linux rendering.
3. The Rust Runtime remains the canonical and sole owner of Domain, Command, Event, SQLite, queue, schedule, permission policy, Runner Adapter, PTY/ConPTY, process tree, safe quit, and recovery.
4. Electron Main and Preload are shell/platform/security/supervision/typed-proxy layers only. They do not introduce a Node business Runtime, Node PTY, Node SQLite, Runner state, permission decisions, or a second recovery/state source.
5. Renderer-native directory DTOs contain only opaque `selectionRef`, non-authoritative `displayName`, `access`, and `expiresAt`. Main resolves the raw platform path and constructs the unchanged Runtime input.
6. Terminal, Artifact, Diff, user, and Runner content may naturally contain paths. That exception is content-only: content remains untrusted sensitive text and never becomes a Shell capability, native selection, external-link authorization, permission decision, or structured raw-path DTO.

## 4. Critical Semantic Oracle Matrix

| Area | Verifiable oracle | Result |
|---|---|---|
| Goal and transition truth | Electron is selected for stable Chromium rendering without claiming implementation or platform evidence; legacy Tauri remains current-transition code only until accepted cutover. | pass |
| Renderer boundary | React Canvas remains the product Renderer and receives no Node API, `ipcRenderer`, Runtime token, port, PID, ready path, process/env value, native handle, or structured absolute path. | pass |
| Main/Preload ownership | Main/Preload own only lifecycle, platform primitives, security, signed sidecar supervision, typed proxy, bounded streams, and update orchestration. | pass |
| Runtime authority | Rust Runtime remains the sole Domain/save/SQLite/permission/Runner/PTY/process-tree/safe-quit/recovery authority. | pass |
| Permission and credential ownership | PermissionGrant policy and operation decisions remain Runtime-owned; OS credential, secret-ref, sandbox, and broker work remains Rust-platform-owned; Main does not read Runner/account tokens. | pass |
| Closed bridge | `ShellMethod`, `ShellErrorCode`, request/result envelopes, source checks, schema limits, prototype rejection, rate/deadline/cancel rules, and window generation are closed and typed; no generic IPC exists. | pass |
| BrowserWindow ownership | Security exclusively constructs/configures BrowserWindow, preload path, production URL, scheme, CSP, navigation/window/permission policy, external confirmation, and fuse policy. Lifecycle only consumes the factory and holds references. | pass |
| CSP and production content | Production loads only packaged `app://ensemble`; no arbitrary URL/env redirect, remote content, `unsafe-eval`, Node worker, webview, or production DevTools path is permitted. The policy is compatible with the current production Renderer source/style usage. | pass |
| Structured confidentiality | Renderer/Preload, Shell-exported DTO/error/diagnostic/telemetry, notifications, URLs, and user-exportable logs contain no bootstrap secret, port, PID, ready path, raw path, process, or env value. Restricted local lifecycle logs retain only the unchanged F0-A1 non-secret PID/loopback/protocol/digest allowance. | pass |
| Workspace-create identity | Client allocates and durably records one immutable Domain `commandId` before create dispatch; Shell `requestId` never replaces or generates it. | pass |
| Opaque selection lifecycle | Picker returns an unbound ref bound to source/frame/purpose/access/expiry; Main atomically performs `unbound -> bound(commandId)` during create validation. A ref cannot cross command identity. | pass |
| Lost-response reconciliation | `createWorkspace` and `reconcileWorkspaceCreate` query the Runtime ledger by original `commandId` before resubmission. Accepted/full payload needs no raw ref; only confirmed `not_recorded` may retry with the same command and valid or reselected refs. Main restart cannot duplicate a Workspace. | pass |
| Runtime data/save invariance | `WorkspaceCreateBridgeInput` is Shell-only. Main constructs the unchanged Rust Runtime `WorkspaceCreateInput`; FileRoot, PathGrant, Runtime API, persistence schema, and save meaning remain unchanged. | pass |
| Stream accounting | Event and Terminal use exact encoded byte credit only: `frameByteLength`, `grantBytes`, debit-before-send, continuous monotonic acknowledgement, 256 KiB frame, 4 MiB remaining-credit cap, 8 MiB queue, 30-second pause, and no lifetime byte cap. | pass |
| Stream identity and cancellation | Shell stream sequence remains separate from Domain Event sequence; cancel, navigation, reload, crash, Runtime generation, Handle generation, lease expiry, stale port, and slow consumer close the old port. | pass |
| Terminal authority | Runtime performs the final `TerminalInputLease` validation; Main cannot authorize input from focus, port existence, or an old lease. | pass |
| External links | Renderer supplies only a URL string. Security applies exact compile-time HTTPS target allowlist, per-webContents rate limit, Main-native Cancel/Open confirmation, and an internal one-shot authorization. No Renderer gesture/confirmed flag is trusted. | pass |
| Activation intent | Second instance accepts only the closed opaque activation target, enforces ID/source/512-byte limits, discards and does not log raw argv/cwd/path/URL/env/bootstrap values, and navigates only after Runtime reconciliation. | pass |
| Sidecar bootstrap | Single-instance ownership precedes spawn; production resolves only the signed manifest sidecar under `process.resourcesPath`; PATH, repo, target, dev-server, Python, and old-supervisor fallback are forbidden. F0-A1 token-file, ready-descriptor, random loopback port, data-root lock, and health contracts remain unchanged. | pass |
| Safe quit | Runtime authors the admission fence, accepted-command drain, Run/Runner barrier, durable completion Events, and acknowledgement. Main waits and never writes Domain/SQLite or classifies Runner state. | pass |
| Force quit | Main writes only supervisor marker/sanitized diagnostics and terminates the owned signed Rust sidecar. It does not enumerate, kill, or reclassify Runner children; Rust containment and next-start Runtime reconciliation remain authoritative. | pass |
| Fuse hardening | Pinned `@electron/fuses` flips and reads back six defined values after packaging/before signing and again from final installed binaries; negative RunAsNode/NODE_OPTIONS/inspect/external-app/ASAR tests are required. | pass |
| Packaging and update | Electron/Chromium/electron-builder/Runtime versions are exact; ASAR/extraResources, signing/notarization, exact sidecar manifest, and one signed Shell+sidecar update set are required. Partial updates cannot start. | pass |
| Installed rendering evidence | Windows, macOS, and Linux installed packages must prove forms and Terminal CJK IME, keyboard/focus/Escape/return-focus, forced colors/high contrast, accessibility tree, platform screen reader, locales, themes, DPI, and reduced motion. Browser/component evidence cannot substitute. | pass |
| Owner and path separation | Electron lifecycle, platform, supervisor, Runtime client, IPC router, stream, security, updater, preload, package/test, shared Shell protocol, Canvas gateway, and Rust namespaces have non-overlapping ownership and explicit dependency direction. | pass |
| Historical authorization | D035 and current indexes override old Tauri ownership/ACCEPT wording. Historical banners preserve bodies while removing implementation authority. | pass |
| Quality and CI truth | Current CI honestly continues to check executable legacy Tauri/Python code. Future Electron gates are requirements, not current green evidence; cutover removes the legacy production-shell path instead of retaining dual production. | pass |

## 5. Controller Ruling On Data And Save Contracts

The controller rules that this documentation migration does not change Runtime API, Domain objects, command/event meaning, SQLite schema, Workspace/FileRoot/PathGrant persistence, or save semantics.

`WorkspaceCreateBridgeInput`, `NativeDirectorySelection`, `ShellRequest`, `ShellResult`, `ActivationIntent`, stream frames, and stream controls are Shell transport DTOs only. They are not new persistent Domain objects and cannot substitute for existing Runtime inputs or canonical results. Transport accepted is not business success; only the original Runtime command result and matching Event/Snapshot may establish Workspace creation or saved state.

The Terminal/Artifact/Diff/user/Runner path exception is limited to untrusted content display and storage under existing content, secret, export, and retention rules. A path-looking string in content never authorizes filesystem access, native selection, IPC, external navigation, permission expansion, or a Main operation.

## 6. Audit Trace

The independent clean-room audit proceeded through three explicit decisions:

1. **Initial review: REJECT.** The first pass recorded four High, three Medium, and one Low findings: Workspace-create lost-response identity, ambiguous stream credit units, unverifiable Renderer gesture for external links, missing Electron fuses, activation/log confidentiality ambiguity, BrowserWindow/external-link ownership overlap, missing installed IME/a11y evidence, and unresolved TypeScript contract names.
2. **Repair review: ACCEPT with one Low wording drift.** The High and Medium findings were closed with immutable Workspace command identity and reconciliation, exact byte credit, Main-native external confirmation, six-fuse policy/readback, closed activation, scoped confidentiality, exclusive Security ownership, installed platform evidence, and compiled unions. One nonblocking F1 picker sentence still implied command binding before the DTO returned.
3. **Final closure: ACCEPT.** The F1 picker contract now states that Main returns an unbound ref, the Client allocates/persists `commandId` before create dispatch, and Main binds the ref during create validation. No unresolved High, Medium, or Low finding remains.

## 7. Reverse Review

The accepted specification requires tests/evidence that make each assumed regression fail before release:

- A lost Workspace-create response or Main restart cannot allocate a new command or create a duplicate Workspace.
- A selection ref cannot cross source, frame, purpose, access, expiry, or immutable command identity.
- A compromised Renderer cannot recover token, port, PID, ready path, process/env values, or structured raw paths through success, error, log, telemetry, DevTools, or diagnostics.
- A generic IPC channel, wrong webContents, subframe, wrong origin, unknown method/key, prototype pollution payload, stale generation, or duplicate request ID cannot reach a handler.
- A Renderer cannot fake a trusted external-link gesture or confirmation; only the Main-native confirmation can create one internal authorization for one exact allowlisted URL.
- Future, stale, duplicate, or non-contiguous acknowledgements cannot create credit; no frame can exceed remaining exact byte credit; a long-lived stream is not terminated by accumulated lifetime bytes.
- A stale MessagePort cannot write after Runtime, window, Handle, or lease generation changes.
- Lifecycle cannot construct or weaken BrowserWindow outside the Security factory; Platform cannot own URL policy or native confirmation.
- A second Electron instance cannot spawn a second Runtime or leak raw argv/cwd/path/URL/env/bootstrap data.
- Production cannot load a development URL or sidecar from PATH, repository output, environment override, Python, or an old supervisor.
- Main cannot become a second Domain Runtime, read Runner credentials, approve permissions, directly kill Runner children, or write Attempt/Run/SQLite recovery state.
- Force quit cannot be reported as safe quit and cannot skip next-start Runtime reconciliation.
- A shipped executable cannot retain RunAsNode, NODE_OPTIONS, CLI inspect, external app loading, or mutable/unverified ASAR behavior because configuration alone is not accepted without final-binary readback.
- An update cannot switch only Electron Shell or only the Rust sidecar.
- Packaged IME cannot submit/send during composition or duplicate after `compositionend`; browser-only accessibility evidence cannot close an installed-app gate.
- Old Tauri ACCEPT or ownership wording cannot authorize current Electron implementation.
- Electron bridge DTOs cannot change Runtime FileRoot/PathGrant/API/save meaning or persist `displayName` in place of the real Runtime path.

## 8. Mechanical Evidence

Task-pre snapshot pointer: `/tmp/ensemble-electron-docs-pre-snapshot.path`.

Protected no-change oracles matched the snapshot exactly:

```text
d57a4fd88f21589b43d36275396c1f9a73e4a2ffec76874494203b1ce17267f1  docs/specs/m6-domain-model.md
8d7beb985d4ddaffa6e4dd332076d591d336430c42688928e43666993c6f4ed5  docs/specs/m6-run-operations.md
b08b8897380bdcd6b724759594f07dbeae57168d2112817f662595181bc9afd6  docs/specs/m6-runner-adapter.md
```

Additional evidence from the final read-only audit:

- Eight historical banner-only files preserved their pre-task bodies byte-for-byte after removing the added banner.
- Event catalog: 102 unique events; command catalog: 43 unique commands; no catalog mutation.
- `pnpm quality:links`: 67 authored Markdown files, 384 links, zero missing before this final review artifact was created.
- `git diff --check`: pass before artifact creation.
- Twenty current `ts`, `js`, and `json` fences: zero syntax, JSON, or TypeScript semantic errors. `ShellMethod`, `ShellErrorCode`, `ConnectionState`, Workspace-create, activation, and byte-credit types compile.
- Task-pre status comparison showed the Electron migration added or changed documentation only; no source/package implementation was introduced by the task.
- Current docs contained 101 Tauri hits. Every hit was classified as archived history, explicitly overridden decision text, or honest current-transition code/CI evidence; no current target document selected Tauri production.
- Structured raw-path scans found no raw path/bootstrap value in the target Renderer/Shell DTO contract. Existing raw-path Canvas types remain explicitly identified as transition code requiring F1 reacceptance.
- Current production Renderer HTML uses external JS/CSS, and current runtime CSS-variable assignment is compatible with the specified CSP. Packaged `app://ensemble` evidence remains pending.
- No Electron dependency, `apps/desktop` source, Electron manifest, fuse output, signed installer, installed binary, or three-platform Electron proof existed during review.

## 9. Residual Evidence And Pending Gates

The following are required future evidence, not unresolved documentation findings:

- F0-A1 implementation, controller review, and owner acceptance remain paused.
- F0-A2 must implement the Security factory, frozen Preload, closed IPC, Workspace command reconciliation, byte-credit streams, activation handling, exact sidecar supervision, external confirmation, and boundary tests.
- F0-A3 must provide signed Windows/macOS/Linux packages, final installed-binary fuse readback, lifecycle, single-instance/data-root, safe/force quit, containment, crash recovery, atomic update, install/uninstall, and packaged IME/a11y evidence.
- F1-A Renderer reacceptance and F1-B Electron integration remain pending after their prerequisites.
- F4 must repeat the real product flow on installed packages; F0 harness evidence cannot replace product evidence.
- Current CI remains legacy Tauri/Python transition coverage until the conjunctive Electron cutover gate is implemented, independently reviewed, accepted, and the legacy production Shell path is removed.

## 10. Final Decision

**End-state architecture aligned: YES.**

The specification points to the intended maintainable end state: one Electron platform Shell, one React Canvas Renderer, one Rust business Runtime, one canonical Domain/save source, bounded typed transport, and non-overlapping ownership. It does not create a transition-only dual Shell, Node business Runtime, duplicate persistence, or hidden compatibility route.

**Final decision: ACCEPT.**

This ACCEPT closes the Electron documentation architecture review only. It does not close any implementation, package, platform, release, or owner-acceptance gate.
