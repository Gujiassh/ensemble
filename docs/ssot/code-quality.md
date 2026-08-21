# Code Quality And Maintainability SSoT

**Status:** active current-code quality/CI contract, F0-A1 OWNER ACCEPTED; F0-A2 authorized / active next, Electron documentation architecture ACCEPT, executable transition gates pending (2026-08-21)

## Scope And Phase Boundary

**Independent acceptance evidence:** [Code Quality Gates Critical/Standard Review (2026-08-21)](../specs/reviews/Code-quality-gates-review-2026-08-21.md) is **ACCEPT** for current quality tooling/governance. [M6 Electron Shell Architecture Critical Review](../specs/reviews/M6-electron-shell-architecture-review-2026-08-21.md) is **ACCEPT** and is the sole current Shell/security/transport/ownership Critical acceptance, but documentation-only. Neither review authorizes F0/F1 implementation, persistence changes, package work, commit, push, merge, deployment, or release.

Ensemble current-code quality gates remain active. Separate explicit owner authorization enabled only the F0-A1 Rust Runtime Bootstrap implementation; it is implemented with WSL/Linux evidence and its [independent Critical implementation review](../specs/reviews/F0-A1-runtime-implementation-review-2026-08-21.md) is **ACCEPT**. [Owner acceptance](../specs/reviews/F0-A1-owner-acceptance-2026-08-21.md) is **ACCEPT** and F0-A1 is OWNER ACCEPTED. The acceptance/delivery status is pushed; F0-A2 is authorized and may start now. F0-A3, F1, and product phases remain gated by their required technical, evidence, quality, independent-review, and delivery conditions; standing authorization waives none of them. Electron is the accepted target production Shell documentation architecture, but Electron source, manifests, package configuration, executable gates and three-platform evidence do not exist yet. Current CI still checks executable legacy Tauri/Python paths until the conjunctive code cutover condition is implemented and accepted; documentation ACCEPT does not make any Electron executable gate green.

File size is one signal, not an architecture. The binding standard is coherent responsibility, explicit contracts, one-way dependencies, testability, and reproducible local/CI evidence.

## Architectural Invariants

- A module MUST have one primary reason to change and a name/public API that matches it.
- Shell, route, shared, and View modules MUST NOT decide feature business rules merely because they compose features.
- Domain owns business invariants; application coordinates use cases through ports; infrastructure/adapters translate IO and implement ports.
- Runtime-only UI state MUST NOT enter persisted Domain documents.
- Names, labels, list position, first-available values, fallback chains, and silent coercion MUST NOT define identity or business behavior.

### TypeScript dependency graph

`scripts/quality/import-boundaries.mjs` uses the installed TypeScript parser and resolves:

- static imports and re-exports;
- `import = require()` and `require()`;
- ImportTypeNode module literals and dynamic import first arguments, including two-argument import-attributes/options calls;
- configured package aliases and Canvas baseUrl `src/...` paths;
- relative files/extensions/directories.

It rejects unresolved configured/local imports, local cycles, production-to-test/test-support imports, protocol-to-app imports, design-system-to-feature imports, and private cross-feature imports. Dynamic imports must use one static string-literal first argument; template/expression imports fail. `import.meta.glob` and `globEager` are conservatively rejected until a dedicated pattern-expansion gate exists.

A feature public entry is mandatory once it exists. Before entries exist, only exact records in `architecture-debt.json` may adjudicate existing private edges. Records contain source, target, owner, reason, target public-entry plan, and a review date within 180 days. New/unlisted, missing, stale, expired, overlong, or post-public-entry edges fail. Current debt: **19 exact edges**, all reviewed by 2026-12-31.

### Python dependency graph

`scripts/quality/python_boundaries.py` uses Python stdlib `ast`, not regular expressions. Current allowed DAG:

```text
composition -> api
api         -> run, persist
run         -> crew, persist, org, runners
crew        -> crew
persist     -> persist
org         -> org
runners     -> runners
```

Same-layer dependencies are allowed. Service and Runner tests are graph roots. Tests may consume production layers but production cannot import either test namespace. `runners` cannot import `ensemble_runtime`; lower layers cannot import API/composition; unresolved local imports and cycles fail.

### Rust dependency direction

Rust compiler/module resolution rejects module cycles. The separate path gate tokenizes authored Rust while ignoring comments/strings and activates for planned `domain/`, `application/`, `infrastructure/`, and `adapter/` directories:

```text
domain         -> domain
application    -> application, domain
infrastructure -> infrastructure, domain
adapter        -> adapter, domain
```

The current flat bootstrap has zero active layered files, so the direction result is explicitly N/A rather than silently absent. The tokenizer resolves `crate::`, `self::`, `super::`, and multi-`super::` paths from each source module, including grouped imports, aliases, and qualified paths outside `use`; ambiguous above-root paths fail.

## Adaptive Source Shape

`pnpm quality:shape` reports physical and code lines. Soft limits require adjudication; review limits require a hard exception.

| Role | Soft | Review |
| --- | ---: | ---: |
| React component | 250 | 450 |
| React hook | 160 | 320 |
| TypeScript/JavaScript logic | 300 | 600 |
| Python module | 300 | 600 |
| Python test | 400 | 800 |
| Rust module | 220 | 500 |
| CSS stylesheet | 500 | 1000 |
| Tests/previews/fixtures | 350 | 750 |
| Localization/declarative data | 600 | 1200 |

Generated candidates under configured names/directories are ignored only when their first eight lines contain an anchored comment-only directive such as `// @generated`, `# @generated`, `/* @generated */`, or canonical `Code generated ... DO NOT EDIT.`. Substring matches and string literals do not establish provenance. `apps/canvas/src/vite-env.d.ts` is the only trusted exact path. Hand-authored code hidden under generated paths is classified normally and can fail.

### Hard exceptions

`shape-exceptions.json` is versioned and currently empty. A record requires path, role, owner, rationale, cohesion, maximum code lines, and review date. The gate rejects stale/missing/mismatched/expired records, dates beyond 180 days, and a maximum above `ceil(max(current lines, review threshold) * 1.25)`. The proportional envelope limits temporary growth; it does not declare a large file architecturally sound.

### Soft-warning reviews

`soft-warning-reviews.json` is adjudication, not suppression. Every warning record contains exact path/role/reviewed code lines, owner, single-responsibility judgment, decision, rationale, trigger, and review date. Any code-line change forces re-review.

Current decisions:

- `useRootLifecycle.ts`: accepted cohesive root lifecycle orchestrator; re-review before any growth/new lifecycle family.
- `styles.css`: split before meaningful extension; no additional selector responsibility.
- Discord preview TSX/CSS: temporary and frozen; delete or replace when preview review closes.
- `WorkspaceCreateFlow.tsx`: split stable flow logic before another step/effect/validation responsibility.
- legacy Python `run/registry.py`: freeze responsibilities/growth during Rust/Electron transition.
- legacy current-code Tauri `runtime.rs`: freeze responsibilities/growth during direct Electron migration; any transition-period lifecycle fix requires the legacy owner and focused tests, and does not define target Electron architecture.

## Frontend Gates

- TypeScript remains `strict`, with `noImplicitOverride`, `useUnknownInCatchVariables`, and consistent-casing enforcement.
- ESLint fails on warnings and enforces explicit-any, complexity 30, depth 4, parameters 4, parameter reassignment, function-size ceilings, Hooks, and Fast Refresh.
- Prettier 3.9.6 checks 69 TS/TSX files. Thirty-nine files received behavior-preserving initial formatting; CSS was not reformatted.
- Four dirty visual preview files remain exact SHA-256-bound formatter debt through 2026-12-31. New differences, content changes, stale records, or overlong review dates fail.
- Coverage is deferred until stable Domain/Logic roles and honest instrumentation exist; a token threshold or broad exclusion is forbidden.

## Python Gates

- Python 3.12.3, uv 0.11.21, Ruff 0.14.14, pytest-asyncio 1.3.0, and PyYAML 6.0.3 are locked.
- `quality:python` performs locked sync, Ruff check/format across 29 service/Runner files plus quality Python scripts, and explicit warnings-as-errors pytest over `services/runtime/tests`, `runners/mock`, and `runners/pi`.
- Two `E402` annotations in `test_pi_runner_via_repo.py` are narrow because repo-root injection must precede Runner imports.
- The only warning filter matches message ``Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.``, category `StarletteDeprecationWarning`, and attribution module `fastapi.testclient`. Remove it when the locked stack no longer falls back to deprecated `httpx`, or after a reviewed `httpx2` migration preserves the API tests.
- Mypy is not a current gate because a permissive baseline over largely untyped transition code would be theater.

## Rust Gates

The current aggregate runs format, production Clippy restrictions, all-target Clippy with `-D warnings`, and locked tests for both `crates/ensemble-runtime` and the executable legacy `src-tauri` code. `rust-toolchain.toml` pins Rust 1.95.0 with Clippy and rustfmt. The legacy Shell gate remains required until Electron cutover; it is current-code coverage, not target-architecture approval.

## Required Future Electron Gates

These gates are requirements, not current commands or green evidence. The Electron implementation slice must add them to manifests, scripts, CI, and this SSoT together:

- exact pinned Electron, `electron-builder`, and compatible `@electron/fuses` versions in manifest/lockfile, with exact bundled Chromium and security evidence;
- strict Main/Preload TypeScript build, lint, unit and integration tests with no unresolved imports/identifiers;
- BrowserWindow Security-factory assertions for `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`, `webSecurity=true`, `webviewTag=false`, no `remote`, no Node in worker/subframe, and architecture tests proving Lifecycle cannot construct/configure windows;
- packaged `app://ensemble` load and CSP tests proving no arbitrary production URL/env redirect, `unsafe-eval`, remote content, navigation, window-open, or permission fallback;
- frozen Preload exact `ShellMethod`/`ShellErrorCode` allowlist and Main rejection tests for wrong webContents, subframe, origin, method/key, prototype pollution, depth/bytes/rate/request identity and stale generation;
- shell protocol schema tests under `packages/protocol/src/shell/**`, including Workspace-create immutable `commandId`, Client registry, query-before-resubmit lost-response flow, selection `bound(commandId)`, Main-restart reconciliation, and Renderer absence of raw path/bootstrap values;
- MessagePort exact encoded byte-credit tests: `grantBytes`, `frameByteLength`, debit-before-send, contiguous monotonic ack, 256KiB frame, 4MiB outstanding, 8MiB queue, 30s pause, no lifetime cap, cancellation/stale/slow and Terminal lease;
- Security-owned external-link tests for compile-time exact HTTPS targets, rejection matrix, 3/10s rate limit, Main native Cancel/Open and one-shot Platform execution; closed second-instance ActivationIntent/ID/512-byte/source/reconciliation/log tests; exact signed sidecar resolution;
- post-package pre-sign fuse flip/readback and final installed-binary readback on three platforms for RunAsNode=false, NODE_OPTIONS=false, CLI inspect=false, embedded ASAR integrity=true, only-ASAR app=true and cookie encryption when supported; electron-builder ASAR/extraResources/signing/notarization/update/install/uninstall evidence;
- architecture boundary tests preventing Electron Main/Preload from owning Node business Runtime/SQLite/PTY/Runner/Domain/save; packaged Windows/macOS/Linux CJK IME forms+Terminal, keyboard/focus/Escape/return-focus, forced-colors/high-contrast/a11y tree, Narrator/VoiceOver/Orca-equivalent, locales/themes/DPI/reduced-motion evidence. Browser/component evidence cannot substitute.

The direct transition condition is conjunctive: future F0-A2 implementation and its separate independent implementation Critical review pass; F0-A3 Windows/macOS/Linux package/lifecycle proof passes; the new Electron commands run inside the exact `pnpm quality` CI aggregate; and the owner accepts removal of the legacy production Shell gate/code. The same cutover slice must remove, not retain in parallel, legacy production-shell commands and CI paths. Until then, current Tauri checks remain mandatory and no Electron gate may be reported as existing or green.

## Repository And CI Hardening

- `.node-version`, package engines, and CI pin Node 22.22.0. pnpm remains 9.15.0.
- GitHub actions are pinned to immutable commit SHAs with version comments.
- Workflow/config validation uses locked PyYAML and verifies manifests, tool versions, action pins, and the exact `pnpm quality` CI command.
- Repository hygiene scans tracked plus nonignored untracked content for conflict markers and trailing whitespace. Exact two-space Markdown hard breaks remain valid syntax.
- Markdown links exclude runtime `data/**` and tool caches, not authored documentation.

## Commands

```bash
pnpm quality
pnpm quality:scripts:test
pnpm quality:hygiene
pnpm quality:config
pnpm quality:shape
pnpm quality:boundaries
pnpm quality:boundaries:python
pnpm quality:boundaries:rust
pnpm quality:links
pnpm quality:format
pnpm quality:frontend
pnpm quality:python
pnpm quality:rust:runtime
pnpm verify:f0-a1
pnpm smoke:f0-a1
pnpm quality:rust:tauri  # current legacy Shell gate until accepted Electron cutover
```

GitHub Actions installs the pinned toolchains and runs only the same `pnpm quality` aggregate. CI does not publish, deploy, or implement product behavior.

## Definition Of Done

1. Responsibility, naming, dependency direction, public/private surfaces, and state ownership are coherent.
2. Tests prove behavior/contracts rather than implementation shape alone.
3. All hard errors are fixed; every soft/debt decision is exact, current, bounded, and reviewable.
4. Source, SSoT, commands, lockfiles, and CI remain aligned.
5. Runtime evidence appropriate to async, persistence, permissions, lifecycle, performance, or semantic visuals is recorded.

## Current Evidence

Verified on the current Linux environment:

- Self-tests: **53** total, comprising 42 Node adversarial tests and 11 Python unittest cases.
- Repository hygiene: **265 files / 251 text files**, zero errors.
- Config/workflow validation: zero errors; immutable actions and pinned tools confirmed.
- Source shape: **147 files**, 1 trusted/provenance-generated file, **7 reviewed soft warnings**, 0 hard errors, 0 hard exceptions.
- TypeScript graph: **68 files / 144 edges**, 19 bounded debt edges, zero errors.
- Python graph: **29 files / 45 edges**, including service and Runner tests, zero errors.
- Rust direction: 0 active layered files, explicitly N/A; ten crate/self/super adversarial tests pass.
- Markdown: **72 authored files / 453 local links**, zero missing (`pnpm quality:links`, 2026-08-21 F0-A1 implementation evidence).
- Frontend formatter: **69 files**, four exact frozen preview debts, zero unlisted differences.
- Canvas: zero-warning lint, strict typecheck, **42/42 tests**, production build passed.
- Python Runtime/Runners: Ruff/format passed; **28/28 tests** passed.
- Rust Runtime F0-A1: fmt/production+all-target Clippy passed; **28/28 tests** passed (10 unit, 16 black-box process integration, 2 in-process owned-server integration); sanitized WSL/Linux smoke passed. See [Rust Runtime Bootstrap](runtime-bootstrap.md) and [F0-A1 evidence](../specs/evidence/f0-a1/wsl-linux-2026-08-21.md). Independent Critical implementation review and owner acceptance are ACCEPT; F0-A1 is OWNER ACCEPTED. F0-A2 is the active authorized next phase and may start now while retaining all its own gates.
- Legacy current-code Tauri: frontend prerequisite, fmt/Clippy passed; **4/4 tests** passed. This is transition evidence only, not Electron acceptance.
- Electron documentation architecture: **ACCEPT**. Electron executable implementation/gates: **not implemented and not green**; security/package and three-platform evidence remain pending.

Linux process/lifecycle evidence does not close Windows/macOS packaging, signing, or platform smoke gates. Those remain future owner-gated work.
