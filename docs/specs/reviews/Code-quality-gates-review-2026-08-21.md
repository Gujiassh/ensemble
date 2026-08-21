# Code Quality Gates Critical/Standard Review

**Date**: 2026-08-21
**Risk class**: Critical/Standard hybrid
**Status**: **ACCEPT**

## 1. Scope and Authorization Boundary

This record accepts Ensemble's current code-quality governance, executable gates, bounded review/debt ledgers, and CI contract.

The review treated architecture direction, dependency enforcement, generated-source provenance, unsafe process ownership, and CI reproducibility as Critical concerns. Source-shape thresholds, linting, formatting, tests, links, and documentation consistency were reviewed as Standard concerns, with escalation where a bypass could defeat a Critical invariant.

This acceptance does not authorize F0, F0-A1, Electron implementation, product behavior, persistence-contract changes, commit, push, merge, deployment, or release. Electron remains a documentation-only direction. F0 and all product implementation remain paused until explicitly authorized through their owning phase gates.

Canonical policy and implementation references:

- [Code quality and maintainability SSoT](../../ssot/code-quality.md)
- [Repository engineering rules](../../../AGENTS.md)
- [Quality configuration](../../../scripts/quality/quality.config.json)
- [Aggregate quality command](../../../package.json)
- [Quality CI workflow](../../../.github/workflows/quality.yml)

## 2. User Goal and Semantic Oracle

The accepted governance serves the user's explicit requirement: Ensemble code must remain high quality, maintainable, reviewable, and resistant to blob modules, components, hooks, services, and stylesheets.

The semantic oracle was:

| Invariant | Acceptance condition | Result |
| --- | --- | --- |
| No universal LOC rule | `2000` lines, or any other single number, is not a universal hard rule or architectural permission. | pass |
| Language- and role-aware timing | React components, hooks, TypeScript logic, Python modules/tests, Rust modules, CSS, tests/previews, localization, and declarative data use different soft/review thresholds. | pass |
| Responsibility before size | Mixed ownership, branching, dependency shape, poor testability, or misleading naming can require a split below every threshold. | pass |
| No mechanical over-splitting | A cohesive file is not split merely to satisfy a count; separation follows stable responsibility boundaries. | pass |
| No ceremonial five-file template | View, Logic, Domain, and Adapter are responsibilities, not a mandatory physical template for trivial work. | pass |
| No checklist-only suppression | Every active warning/debt is exact, bounded, current, stale-detecting, and tied to a concrete owner and decision. | pass |
| Executable architecture | TypeScript, Python, and planned Rust dependency directions have adversarially tested gates rather than prose-only rules. | pass |
| Honest exceptions | Hard source-shape exceptions are empty by default, expire within 180 days, and cannot grant disproportionate growth. | pass |
| Reproducible delivery | Local and CI toolchains, dependency graphs, formatter, hygiene, workflow validation, tests, builds, and platform-safety checks use one aggregate gate. | pass |

**Future-blob judgment**: **yes**. The accepted structure prevents unreviewed size growth and newly introduced private/dependency edges while retaining explicit human responsibility judgment. It reports and blocks governance drift without turning any line count into permission to keep mixing concerns.

## 3. Final Adaptive Policies

### 3.1 Source-shape thresholds

Thresholds use code lines, not physical lines. Blank and language-specific comment-only lines are excluded; Python docstrings count conservatively as code.

| Role | Soft review trigger | Hard review gate |
| --- | ---: | ---: |
| React component | 250 | 450 |
| React hook | 160 | 320 |
| TypeScript/JavaScript logic | 300 | 600 |
| Python module | 300 | 600 |
| Python test | 400 | 800 |
| Rust module | 220 | 500 |
| CSS stylesheet | 500 | 1000 |
| Tests, previews, fixtures, test support | 350 | 750 |
| Localization catalog | 600 | 1200 |
| Explicit declarative data | 600 | 1200 |

A soft exceedance is nonblocking only after an exact record in `soft-warning-reviews.json` validates the current path, role, code-line count, owner, responsibility, decision, rationale, trigger, and review date. Missing, stale, expired, role-mismatched, or size-changed records fail.

The seven current soft records cover `useRootLifecycle.ts`, `styles.css`, the Discord preview TSX/CSS, `WorkspaceCreateFlow.tsx`, the legacy Python Registry, and the Tauri runtime supervisor. Their decisions include accepted cohesion, split-before-extension, temporary freeze, and no-growth freeze. All seven expire on **2026-12-31**.

The hard exception ledger contains **0** records. If used later, a record must remain within 180 days and may set `maxCodeLines` no higher than `ceil(max(currentCodeLines, reviewThreshold) * 1.25)`.

### 3.2 Generated-source provenance

A generated candidate is ignored only when its configured header window contains an anchored, comment-only language directive such as `// @generated`, `# @generated`, `/* @generated */`, or a canonical `Code generated ... DO NOT EDIT.` header.

A string literal containing `@generated`, a marker-free file under `generated/` or `gen/`, or a similarly named untrusted file remains authored source and is enforced normally. `apps/canvas/src/vite-env.d.ts` is the only trusted exact path that does not require a directive.

### 3.3 Dependency direction

The TypeScript AST graph covers imports, re-exports, `import = require`, `require`, ImportType nodes, one- and two-argument literal dynamic imports, configured aliases, and Canvas `baseUrl` imports. It rejects unresolved local paths, cycles, production-to-test imports, Protocol-to-app imports, design-system-to-business imports, and private cross-feature edges.

All nonliteral dynamic imports fail. `import.meta.glob` and `import.meta.globEager` fail for both literal and nonliteral patterns until a dedicated static pattern expander exists.

Nineteen current cross-feature private edges have exact architecture-debt records with owner, reason, public-entry plan, and review date. New edges fail; missing, stale, duplicate, overlong, or post-public-entry debts fail. All 19 records expire on **2026-12-31**.

The Python stdlib-AST graph scans production Runtime code, all service tests, Runner production code, and Runner tests. It rejects unresolved local imports, cycles, production-to-either-test-tree imports, Runner-to-Runtime imports, and forbidden layer directions. Tests may depend on production code.

The Rust path-direction gate is intentionally N/A for the current flat bootstrap. When planned `domain/`, `application/`, `infrastructure/`, or `adapter/` directories exist, it resolves `crate`, `self`, single/multiple `super`, grouped imports with aliases, and qualified paths outside `use` declarations. Above-root relative paths fail conservatively. Cargo/rustc remains the source of truth for module resolution and cycle rejection.

### 3.4 Frontend format and static checks

Prettier 3.9.6 checks 69 TS/TSX files. Thirty-nine tracked files were mechanically formatted; each current file was independently proven byte-for-byte equal to applying the pinned Prettier version to its `HEAD` content. Only `main.tsx` and `VisualHarness.tsx` contain separately reviewed semantic changes.

Four pre-existing dirty preview files remain exact SHA-256-bound formatter debt. Content changes, new unlisted differences, stale records, duplicates, or overlong dates fail. All four formatter records expire on **2026-12-31**.

ESLint fails on every warning and enforces explicit-any, complexity, nesting depth, parameter count, parameter reassignment, function-size ceilings, Hooks, and Fast Refresh. TypeScript remains strict with the adopted additional flags. Unit tests, raw-color ownership, typecheck, and production build are blocking. Coverage remains deferred until stable Domain/Logic roles and honest instrumentation exist.

## 4. Audit and Repair Trace

### 4.1 Initial clean-room REJECT

The first Critical/Standard clean-room audit rejected the initial green gate for material bypasses and checklist-only evidence:

1. The TypeScript graph missed two-argument dynamic imports, Canvas `baseUrl` paths, and `tests/` directories.
2. Cross-feature private-import enforcement was dormant when a target lacked a public entry.
3. Soft source-shape warnings were only listed; existing responsibility-heavy files had no durable decision.
4. Files could become generated merely by living below `generated/` or `gen/`, and hard exception ceilings were not proportionally bounded.
5. Python and planned Rust architecture directions were prose-only.
6. The Tauri process test killed only a group leader and did not prove descendant termination.
7. CI lacked committed-content hygiene, exact local Node/Rust pins, immutable action SHAs, workflow/config validation, and a bounded frontend formatter migration.

### 4.2 First repair round

The repair added exact soft-review, architecture-debt, and formatter-debt ledgers; generated provenance; proportional hard exceptions; TypeScript `baseUrl` and test-directory handling; Python/Rust direction gates; repository hygiene; configuration/workflow validation; immutable action pins; exact toolchain files; Prettier adoption; and a bounded Tauri leader-plus-descendant fixture.

The next targeted review confirmed these repairs but issued a second **REJECT** for four remaining bypasses:

1. TypeScript template/expression dynamic imports and ImportType nodes could still disappear from the graph.
2. Legal Rust `super::super` paths bypassed a tokenizer that recognized only `crate::layer`.
3. `services/runtime/tests` was outside the Python graph, so production could import service tests undetected.
4. Generated provenance accepted an ordinary source string containing `@generated`.

### 4.3 Final repair and ACCEPT

The final repair added ImportType edges, hard rejection for every nonliteral dynamic import, conservative rejection for both glob APIs, module-depth-aware Rust relative-path resolution, service-test Python roots, and anchored comment-only generated directives.

Independent final adversarial fixtures verified:

- A previously Vite-bundled variable dynamic import now fails with `nonliteral_dynamic_import`.
- A previously `tsc`-valid ImportType dependency on test support now fails the production-to-test boundary.
- Literal two-argument dynamic imports receive normal edge and cycle checks.
- Literal/nonliteral `import.meta.glob` and `globEager` calls fail under the current policy.
- A Cargo-valid nested Domain `super::super` dependency on Infrastructure now fails `domain->infrastructure`.
- `crate`, `self`, multi-`super`, grouped aliases, qualified expressions, and above-root ambiguity produce the expected allow/fail results.
- Production imports into service and Runner test trees fail; test-to-production passes; test cycles fail.
- Anchored generated directives and canonical headers pass; string literals, marker-free generated paths, and untrusted similar paths fail.

No blocking finding remained.

## 5. Final Pass Matrix

| Review area | Risk | Result | Final judgment |
| --- | --- | --- | --- |
| Goal alignment and proportionality | Critical | pass | Adaptive per-role policy; no universal 2000-line rule; no mechanical or ceremonial splitting. |
| Source shape and provenance | Critical | pass | 138 files, seven exact soft reviews, zero hard exceptions, narrow generated provenance. |
| TypeScript dependency graph | Critical | pass | 68 files, 144 edges, 19 exact debts; all reviewed import forms and bypass fixtures enforced. |
| Python dependency graph | Critical | pass | 29 files, 45 edges; production/tests/Runners included; directions and cycles enforced. |
| Rust dependency direction | Critical | pass / current N/A | Ten path adversarial tests pass; current flat bootstrap has zero active layered files. |
| Frontend static and format gates | Standard | pass | Warning-free lint, strict typecheck, raw-color ownership, exact formatter migration, tests, and build. |
| Python lint, format, and tests | Standard | pass | Locked Ruff/pytest stack covers Runtime, service tests, Runners, and quality Python scripts. |
| Rust fmt, Clippy, tests, and unsafe review | Critical | pass | Production/all-target Clippy, locked tests, no production unwrap, no lock-across-await, documented unsafe. |
| Tauri process ownership | Critical | pass | Distinct descendant termination proven with bounded cleanup and no PID-reuse query. |
| Repository hygiene and links | Standard | pass | Tracked/nonignored content whitespace/conflict scan and authored Markdown link validation. |
| CI/local parity and reproducibility | Critical | pass | One aggregate command, exact toolchains, locked dependencies, immutable actions, no deploy. |
| Documentation and phase boundary | Critical | pass | Commands/evidence current; Electron documentation-only; F0/product implementation paused. |
| Dirty worktree and scope | Critical | pass | Formatter changes are mechanical; preview work preserved; no data/save/business-contract change attributed to quality gates. |

There are no blocked final review areas.

## 6. Exact Final Evidence

The final independent run of `pnpm quality` passed with:

- Quality self/adversarial tests: **53 total**, comprising **42 Node tests** and **11 Python unittest cases**.
- Repository hygiene: **249 files / 235 text files**, zero errors.
- Config/workflow validation: zero errors.
- Source shape: **138 files**, **7 reviewed soft warnings**, **0 hard errors**, **0 hard exceptions**, and one trusted/provenance-generated file.
- TypeScript graph: **68 files / 144 edges**, **19 bounded debt edges**, zero errors.
- Python graph: **29 files / 45 edges**, zero errors.
- Rust direction: current tree explicitly N/A; **10 adversarial path tests** pass.
- Markdown links: **65 authored Markdown files / 337 local targets** before this review artifact, zero missing targets.
- Frontend formatter: **69 files / 4 exact formatter debts**, zero unlisted differences.
- Canvas: **42/42 tests**, zero-warning ESLint, strict typecheck, raw-color ownership, and production build pass.
- Python Runtime/Runners: **28/28 tests**, locked Ruff check/format pass.
- Rust Runtime: **6/6 tests**, fmt and production/all-target Clippy pass.
- Tauri: **4/4 tests**, fmt and production/all-target Clippy pass.
- Aggregate: `pnpm quality` exit `0`.
- Production bundle: VisualHarness/Discord preview scenario code absent.
- Review worktree: no review-authored source, contract, persistence, or business-data changes.

## 7. Tauri Descendant and Unsafe Evidence

The Unix process-group fixture launches a group leader and a distinct descendant PID. The descendant writes a readiness marker and inherits a pipe across `exec`. The fixture verifies that the pipe remains open before shutdown, signals the owned process group before reaping the leader, waits within a two-second budget, and requires pipe EOF after shutdown. EOF proves that the exact descendant exited without querying a PID after it could be reused.

Drop cleanup signals the group before waiting, uses a bounded fallback kill/reap path, and removes only the fixture-owned temporary directory. The zero-PGID test proves the caller's group cannot be selected accidentally.

The production `pre_exec`, `setpgid`, and `killpg` unsafe blocks retain adjacent `SAFETY:` invariants. PGID conversion requires a positive value, the still-owned child prevents PID/PGID reuse before reap, the signal values are fixed POSIX constants, and no Rust memory is dereferenced by the FFI calls.

Linux evidence does not close Windows/macOS packaging, signing, native lifecycle, or platform smoke gates.

## 8. CI and Toolchain Contract

The accepted toolchain is:

| Tool | Pin |
| --- | --- |
| Node | 22.22.0 via `.node-version`, package engines, and CI |
| pnpm | 9.15.0 via `packageManager` and CI Corepack activation |
| Python | 3.12.3 |
| uv | 0.11.21 |
| Rust | 1.95.0 via `rust-toolchain.toml` and CI |
| Prettier | 3.9.6 |
| Ruff | 0.14.14 |
| pytest-asyncio | 1.3.0 |
| PyYAML | 6.0.3 |

JavaScript, Python, and Rust dependency graphs are locked. GitHub Actions uses immutable commit SHAs for checkout, Node setup, and Python setup. Workflow/config validation rejects mutable action tags, invalid YAML, missing aggregate execution, and toolchain mismatch.

CI runs on Ubuntu 24.04 with the Linux desktop build dependencies, read-only repository permission, a 45-minute timeout, and concurrency cancellation. Its only quality entry is `pnpm quality`. It does not publish, deploy, rewrite source, or implement product behavior.

## 9. Bounded Residuals and Delivery State

Accepted bounded residuals:

- Rust path enforcement is a reviewed path tokenizer, not a replacement for rustc. The compiler remains authoritative for module resolution and cycles.
- TypeScript glob APIs remain forbidden until a static expander can enumerate and boundary-check every matched module.
- Coverage remains deferred until stable Domain/Logic roles and honest instrumentation exist.
- Linux process evidence does not substitute for required Windows/macOS platform evidence.
- Seven soft reviews, 19 architecture debts, and four formatter debts all expire on **2026-12-31**. They must be removed, renewed through review, or resolved before that date.

**Final decision**: **ACCEPT**.

**Future-blob judgment**: **yes**. Within the governed roots and current architecture, new blob growth, unreviewed responsibility warnings, private cross-feature edges, generated-source hiding, formatter drift, and the adversarial dependency bypasses exercised in this review are blocked or require an exact time-bounded decision.

**Delivery state**: this review created only this artifact. No commit, push, merge, release, deployment, or dev-workbench update was performed. F0 and product implementation remain paused.
