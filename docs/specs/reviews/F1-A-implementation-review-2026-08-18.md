# F1-A Implementation Review

> **HISTORICAL · PARTIAL EVIDENCE · NOT CURRENT AUTHORIZATION**
>
> 本文件原样保留当时的审查正文、结论和证据，仅可用于未变化范围的历史参考。当前状态以 [Ensemble Specs Index](../README.md) 为准；下文任何 PASS、ACCEPT、ready、commit/push 或 next-lane 表述均为历史陈述，不能授权 F0/F0-A1、重新打开的 F1 合同或任何产品实现。

**Date**: 2026-08-18
**Scope**: F1-01 through F1-15 in `apps/canvas`, the F1 design-system/i18n SSoT updates, and the F1 evidence package
**Risk level**: Critical. The slice changes the production entry, device preference ownership, asynchronous gateway operations, accessibility semantics, and the user-visible shell.

## Review Oracle

- The production entry renders the new canvas-first shell and never selects a deterministic test adapter.
- Device preferences remain separate from Workspace, Runner, Run, and Agent output data.
- UI locale and Agent output locale remain independent.
- Runner probes, directory selection, and Workspace creation are cancellable and request-identified; stale results cannot mutate a discarded flow.
- The Canvas remains the dominant surface; the Inspector is conditional, overlays at 1280px, and docks at 1440px.
- Seat-like objects are flat spatial marks rather than nested cards.
- Theme, density, motion, contrast, and locale are semantic configuration axes; no component reads raw colors or platform names.
- F1-A does not claim native preferences, native directory selection, a real Runtime transport, or desktop packaging. Those remain F1-B/F0 work.

## Result

**ACCEPT** after the fixes recorded below. F1-01 through F1-14 have implementation and evidence. F1-15 closes with this report and the final verification matrix. F1-16 through F1-20 remain pending F0 Backend and packaging verification.

## Findings Resolved

1. **Test isolation**: the jsdom test setup did not call Testing Library cleanup, causing dialogs and buttons to leak between tests. Added an `afterEach(cleanup)` hook and corrected an array assertion in `AppShell.test.tsx`.
2. **Async discard coverage**: the stale-create test used a fixed timer and raced with `user-event`. Replaced it with a manually resolved Promise and asserted that a late success after discard cannot call `onCreated`.
3. **Production build target**: the development-only visual harness initially used top-level `await`, which failed the configured browser target. The entry now starts through a normal async render function; the production build excludes the harness chunk and its test adapter.
4. **Contrast semantics**: light primary text (`3.58:1`) and waiting text (`3.65:1`) failed WCAG AA. Dark navigation also reused the primary-button inverse text token and became unreadable. Deepened the light vermilion/waiting references, split `textNavigation` from `textOnPrimary`, and added light/dark contrast tests.
5. **Lifecycle guard**: React 18 batching can collapse the transient `checking_backend` render. The legal transition table now allows the corresponding restoring-to-result transitions while continuing to reject invalid business jumps such as `ready -> startup_error`.
6. **Browser evidence noise**: Chromium requested an undeclared favicon and produced a 404. Reused the existing 32px application icon as `apps/canvas/public/favicon.png` and set the product title to `Ensemble`.
7. **Dead dependencies**: removed the unused prototype dependencies `@xyflow/react`, `zustand`, and `@ensemble/protocol` from the Canvas package and lockfile.

No unresolved implementation findings remain for F1-A.

The root `.gitignore` is the only scope exception to the F1-A file-ownership list. It excludes local agent/audit output directories (`artifacts/`, `.artifacts/`, and `.gstack/`) and does not change Runtime persistence, product data locations, or a public contract. The controller reviewed and accepted this repository-hygiene change.

## Review Matrix

| Area | Result | Evidence |
|---|---|---|
| Goal alignment | pass | Production `App.tsx` now owns only the canvas-first shell; old prototype entry modules are deleted and the public title is `Ensemble`. |
| User-visible flow and timing | pass | Playwright covered startup error/retry/diagnostics, empty Workspace, full creation, failed creation with draft preservation, settings, Inspector overlay, and Inspector docked. |
| Architecture and boundaries | pass | Shell, design-system, i18n, preferences, workspace, canvas, inspector, and gateway ownership remain separate; the visual harness is development-only and not imported by `App.tsx`. |
| Data contracts and types | pass | TypeScript gateway types cover incremental Runner results, abort signals, directory outcomes, and create payloads; device schema rejects Workspace/Run fields. |
| Async failure paths | pass | Request identity and AbortController checks cover Runner probes, directory selection, Workspace creation, close/discard, and failed create retry. |
| Accessibility semantics | pass | Dialog focus trap/Escape/return focus, IME-safe Enter, accessible Canvas object buttons, status icons plus text, forced-colors override, and WCAG AA token tests are covered. |
| Responsive layout | pass | Exact viewport evidence exists for 1024, 1280, and 1440; Inspector mode is asserted and horizontal overflow is checked in every browser scenario. |
| Internationalization | pass | Catalog coverage, pseudo-locale helper, `Intl` formatter tests, English and Chinese browser flows, and independent output-locale assertions pass. |
| Raw color/platform leakage | pass | Raw-color scan passes; only theme definitions contain hex values; no platform sniffing or Runtime URL is present in Canvas source. |
| Production boundary | pass | `App.entry.test.ts` and production bundle scan confirm no fixtures, test gateway, or visual harness in the production entry/bundle. |
| F1-B desktop/runtime binding | pending F0 verification | Native preference path, directory picker, authenticated Runtime gateway, sidecar lifecycle, and package evidence require F0 decisions. |

## Verification Evidence

Commands run from `/home/cc/code1/ensemble`:

```text
pnpm typecheck:canvas                         # pass
pnpm lint:canvas                              # pass, zero warnings
pnpm build:canvas                             # pass
pnpm --filter @ensemble/canvas test -- --run  # 14 files, 39 tests passed
git diff --check                              # pass
```

Browser verification used the system Chromium executable through the Playwright runner:

```text
node /home/cc/.cache/playwright-system-runner/ensemble-f1-audit.cjs  # pass
```

The script asserted no browser errors, no horizontal overflow, focus return, create-failure draft preservation, 1280px overlay, 1440px docking, theme/settings state, and forced-colors/reduced-motion platform overrides.

Representative screenshots:

| Scenario | Artifact |
|---|---|
| Startup error, diagnostics, English/light, 1280 | [startup-error-diagnostics-en-light-1280.png](../evidence/f1-a/startup-error-diagnostics-en-light-1280.png) |
| No Workspace, Chinese/light, 1024 | [no-workspace-zh-light-1024.png](../evidence/f1-a/no-workspace-zh-light-1024.png) |
| Workspace created, English/light, 1280 | [workspace-created-en-light-1280.png](../evidence/f1-a/workspace-created-en-light-1280.png) |
| Failed create with preserved draft, English/light, 1280 | [workspace-create-failure-en-light-1280.png](../evidence/f1-a/workspace-create-failure-en-light-1280.png) |
| Settings switched to Chinese/dark/compact/reduced/high contrast, 1280 | [settings-zh-dark-compact-1280.png](../evidence/f1-a/settings-zh-dark-compact-1280.png) |
| Inspector overlay, English/dark, 1280 | [inspector-overlay-en-dark-1280.png](../evidence/f1-a/inspector-overlay-en-dark-1280.png) |
| Inspector docked, Chinese/light, 1440 | [inspector-docked-zh-light-1440.png](../evidence/f1-a/inspector-docked-zh-light-1440.png) |

## Boundary and Follow-up

F1-A is ready for commit and push. The next implementation lane must first consume the F0 decision for Backend process/transport and platform app-data paths. It may then implement only F1-16 through F1-20; it must not replace the unavailable gateway with a fixed development port or reintroduce prototype event vocabulary.
