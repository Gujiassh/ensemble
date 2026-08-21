# Ensemble Engineering Rules

These rules govern implementation and review; they do not themselves authorize a phase, product behavior, persistence contract, or platform migration. The owner separately authorized only F0-A1 Rust Runtime Bootstrap. F0-A1 is independently reviewed and owner-accepted. The owner-acceptance/delivery status is pushed; F0-A2 is the active authorized next phase and may start now. Standing owner authorization permits later phases only after each required technical, evidence, quality, review, and delivery gate closes; no gate is waived or skipped. The Electron direction remains documentation-only until its owning phase is explicitly authorized.

## Sources Of Truth

- Current product and architecture contracts are indexed by `docs/00-overview.md` and `docs/specs/README.md`.
- Enforceable engineering policy is `docs/ssot/code-quality.md`; versioned gate configuration and review/debt ledgers live in `scripts/quality/`.
- A contract, boundary, persistence meaning, or quality-policy change updates its SSoT and executable verification in the same slice.

## Responsibilities And Boundaries

- Every module has one primary responsibility; name, public API, tests, and owning directory must agree with it.
- Domain code does not depend on UI, Shell, persistence implementations, platform code, or concrete Runner adapters. Composition/application depend on stable Domain ports; infrastructure/adapters implement them.
- Public entry points stay small. Cross-feature private imports fail unless an exact, bounded architecture-debt record exists. Once a feature has a public entry, private imports fail even if an old debt record exists.
- `packages/protocol` never imports applications. Design-system code never imports business features. Production code never imports tests, previews, fixtures, mocks, or test support through relative, alias, baseUrl, re-export, require, import-equals, or dynamic-import syntax.
- The target production Shell is Electron. `apps/desktop` owns only Main/Preload/platform/security/supervision/transport/update concerns; it MUST NOT own Node business Runtime, Node PTY, Node SQLite, Runner lifecycle, Domain/save decisions, or a second state source.
- Shell bridge contracts live only in `packages/protocol/src/shell/**`; `apps/canvas/src/runtime-gateway/electron-gateway.ts` is the sole Canvas Electron bridge consumer. Renderer structured DTOs never expose Runtime token/port/PID/ready path/process/env or raw absolute paths; native directory selection uses opaque source/purpose/access/expiry refs bound to one immutable Domain commandId; retry/reconciliation queries that command before resubmit.
- Rust Runtime remains the sole owner of Domain, Command/Event, SQLite, queue/schedule/permission, Runner, PTY/ConPTY, process trees, safe quit and recovery. Shell migration MUST preserve Runtime API, persistence fields and save meaning.
- Runtime-only UI state stays out of persisted Domain models. Names, labels, list order, first-available values, fallback chains, and silent coercion are not identity or business semantics.
- Use View/Logic/Domain/Adapter separation only where those responsibilities exist; do not force trivial features into ceremonial files.

## Source Shape And Reviews

- `pnpm quality:shape` uses language/role-aware code-line thresholds; there is no universal 2000-line rule. Python `#` comments are excluded and docstrings count conservatively.
- Soft warnings are nonblocking size signals but require exact records in `soft-warning-reviews.json`. Path, role, code lines, responsibility, decision, trigger, and review date must remain current; unreviewed or stale warnings fail.
- Hard review-threshold exceptions require the empty-by-default `shape-exceptions.json`, expire within 180 days, and may grant only the configured proportional growth envelope. They never replace architecture judgment.
- Files under `generated/` or `gen/` are generated only when a recognized provenance marker appears in the configured header window. Only narrowly trusted exact paths may omit the marker.
- Responsibility density, dependency shape, branching, and testability can require a split below thresholds. Do not split cohesive files mechanically just to satisfy a number.

## Python

- `services/runtime` and `runners/**` remain active while current legacy Tauri/M3/M4 paths invoke them. The selected Electron/Rust target does not exempt executable transition code from current gates; legacy evidence does not authorize target Shell architecture.
- Use Python 3.12.3 and `services/runtime/uv.lock`. Ruff check/format covers service, Runner, and quality Python files. Pytest explicitly collects service/mock/pi test roots and treats warnings as errors except the one exact Starlette filter documented in SSoT.
- The Python AST boundary graph is mandatory: Runners cannot import `ensemble_runtime`; lower layers cannot import API/composition; local cycles and unresolved imports fail.
- Do not broaden warning filters or Ruff suppressions. A narrow `noqa` requires a local structural reason.

## Rust

- Rust compiler/module resolution owns cycle rejection. `quality:boundaries:rust` separately enforces planned Domain/Application/Infrastructure/Adapter path direction when those directories exist; the current flat bootstrap is explicitly N/A.
- Production library/bin code propagates errors instead of `unwrap()`. Clippy denies `unwrap_used`, blocking lock guards across await, undocumented unsafe blocks, and all warnings.
- Every task, process, listener, file, temporary directory, lease, channel, and platform handle needs a tested owner and shutdown/cancellation/drop story. `unsafe` requires adjacent `SAFETY:` invariants and focused review/tests.

## Definition Of Done

- Run `pnpm quality`; CI runs that exact command and no parallel YAML implementation.
- The aggregate includes self-tests, repository hygiene, config/workflow syntax, source shape, TS/Python/Rust boundaries, Markdown links, frontend format/static/tests/build, locked Python, and both Rust crates.
- Coverage becomes blocking only with honest stable Domain/Logic instrumentation; do not manufacture a low global threshold or broad exclusions.
- A change is not done while a required review/debt ledger is missing, stale, expired, disproportionate, or silently bypassed.
