# Code Quality And Maintainability SSoT

**Status:** active quality policy and CI contract (2026-08-21)

## Scope And Phase Boundary

**Independent acceptance evidence:** [Code Quality Gates Critical/Standard Review (2026-08-21)](../specs/reviews/Code-quality-gates-review-2026-08-21.md) is **ACCEPT** for this quality tooling/governance and CI contract. It does not authorize F0, F0-A1, Electron implementation, product behavior, persistence changes, commit, push, merge, deployment, or release.

Ensemble quality gates are active now. They do not authorize F0, F0-A1, product behavior, persistence contracts, or a desktop-platform migration. F0 remains paused. Electron is the current documentation direction only; existing executable Tauri/Python paths remain gated until their owners authorize and implement a transition.

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
- Tauri `runtime.rs`: freeze responsibilities/growth; lifecycle fixes require its owner and focused tests.

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

Both `crates/ensemble-runtime` and `src-tauri` run format, production Clippy restrictions, all-target Clippy with `-D warnings`, and locked tests. `rust-toolchain.toml` pins Rust 1.95.0 with Clippy and rustfmt.

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
pnpm quality:rust:tauri
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
- Repository hygiene: **249 files / 235 text files**, zero errors.
- Config/workflow validation: zero errors; immutable actions and pinned tools confirmed.
- Source shape: **138 files**, 1 trusted/provenance-generated file, **7 reviewed soft warnings**, 0 hard errors, 0 hard exceptions.
- TypeScript graph: **68 files / 144 edges**, 19 bounded debt edges, zero errors.
- Python graph: **29 files / 45 edges**, including service and Runner tests, zero errors.
- Rust direction: 0 active layered files, explicitly N/A; ten crate/self/super adversarial tests pass.
- Markdown: **66 authored files / 344 local targets**, zero missing.
- Frontend formatter: **69 files**, four exact frozen preview debts, zero unlisted differences.
- Canvas: zero-warning lint, strict typecheck, **42/42 tests**, production build passed.
- Python Runtime/Runners: Ruff/format passed; **28/28 tests** passed.
- Rust Runtime: fmt/Clippy passed; **6/6 tests** passed.
- Tauri: frontend prerequisite, fmt/Clippy passed; **4/4 tests** passed.

Linux process/lifecycle evidence does not close Windows/macOS packaging, signing, or platform smoke gates. Those remain future owner-gated work.
