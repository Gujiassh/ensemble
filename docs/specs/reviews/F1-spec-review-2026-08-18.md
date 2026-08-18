# F1 Specification Review

**Date**: 2026-08-18
**Scope**: `f1-shell-design-system.md`, F1 entry in `12-dev-plan.md`, and links from the M6 product spec
**Risk level**: Standard. This review covers the client foundation but does not approve Runtime persistence or packaging.

## Review oracle

- The first screen is a canvas-first product surface, not a prototype dashboard.
- Device preferences never become Workspace or Run data.
- UI locale and Agent output locale remain independent.
- The client has one replaceable gateway boundary and does not invent business persistence.
- Theme, platform, and locale decisions remain outside business components.
- Inspector visibility is selection-driven and does not permanently consume canvas space.
- Failed async work preserves user input and cannot apply stale results.
- F1 does not claim Backend, Runner, Workflow, Run, or packaging behavior it cannot verify.

## Review result

| Area | Result | Evidence |
|---|---|---|
| Goal alignment | pass | F1 outcome and exit gate describe the agreed simple canvas-first surface and flexible future orchestration without reviving old UI |
| Scope control | pass | Runtime sidecar, real Runner, Workflow editing, Run operations, and release packaging are explicit non-goals |
| Architecture boundaries | pass | Module ownership separates shell, design system, preferences, i18n, workspace form, canvas view state, inspector, and gateway |
| Data contracts | pass | Device preferences, transient creation draft, probe result, and gateway input are typed and kept distinct from domain persistence |
| Interaction coverage | pass | Boot/error/no-workspace, dirty close, async probe races, failed create, inspector focus return, and responsive surfaces are specified |
| Internationalization | pass | `zh-CN`/`en-US`, key groups, pseudo-locale expansion, and output-locale separation are explicit |
| Accessibility | pass | keyboard, focus, reduced motion, forced colors, color-independent status, and canvas accessible names are acceptance items |
| Verification | pass | Each risk has a concrete evidence artifact; build success alone is explicitly insufficient |
| Backend readiness | not applicable | F1 uses a gateway seam; F0 process selection remains a separate gate |

## Findings resolved while writing

1. The previous F1 plan did not say whether Workspace creation could persist without a Backend. The new spec makes the form transient and requires a gateway result before claiming creation.
2. The previous plan did not distinguish a real Runner probe from UI states. F1 now consumes typed probe results and excludes probing implementation.
3. The previous plan did not assign files or forbid edits to Runtime/protocol contracts. F1 now has an ownership table and escalation rule.
4. The previous plan did not define evidence for locale expansion, reduced motion, raw colors, or stale async results. These are now explicit verification rows.

## Decision

**ACCEPT** for the F1-A frontend implementation lane. Grok may implement F1-01 through F1-15 against this specification. The main controller must audit the resulting diff and evidence before committing. F1-16 through F1-20 remain blocked by F0 Backend/Packaging and must not be silently implemented or marked complete by F1-A code.
