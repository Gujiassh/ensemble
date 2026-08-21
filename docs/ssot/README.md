# Ensemble SSoT

This directory is the aggregation root for Ensemble's current, enforceable invariants. It records what must be true now; rationale and proposals belong in decisions or specs.

## Decision Priority

1. `docs/ssot/**`, excluding any future handbook material.
2. Source behavior plus tests and CI. A conflict with SSoT is drift that must be repaired, not an implicit override.
3. Current specs and decisions indexed by [the V2 overview](../00-overview.md) and [spec index](../specs/README.md).
4. Archived M0-M5 documents, examples, and previews.

## Independent Acceptance Evidence

- [Code Quality Gates Critical/Standard Review (2026-08-21)](../specs/reviews/Code-quality-gates-review-2026-08-21.md): **ACCEPT** for the current quality tooling, governance, bounded review/debt ledgers, and CI contract only. It does not authorize F0, F0-A1, Electron implementation, product behavior, persistence changes, commit, push, merge, deployment, or release.
- [F0-A1 Runtime Implementation Critical Review (2026-08-21)](../specs/reviews/F0-A1-runtime-implementation-review-2026-08-21.md): **ACCEPT** for the F0-A1 Linux/WSL implementation.
- [F0-A1 Owner Acceptance (2026-08-21)](../specs/reviews/F0-A1-owner-acceptance-2026-08-21.md): **OWNER ACCEPT / F0-A1 ACCEPTED**; the acceptance/delivery status is pushed and F0-A2 is authorized to start now, with all later gates still mandatory.

## Current Domains

- [Code quality and maintainability](code-quality.md)
- [Rust Runtime bootstrap](runtime-bootstrap.md)
- [Design system](design-system.md)
- [Internationalization](i18n.md)
- [Platform adaptation](platform-adaptation.md)
- [CrewAI history and current status](crewai.md)
- [Historical stack record](stack.md)

A code change that alters an invariant, boundary, or verification command must update the owning SSoT in the same work slice. A proposed SSoT change that has no corresponding implementation or verification must remain a proposal instead.
