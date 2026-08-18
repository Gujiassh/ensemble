# F1 Spec: Desktop Shell, Design System, and Workspace Entry

**Status**: Current implementation specification (2026-08-18)
**Owner**: F1-A frontend lane, followed by an F1-B desktop integration lane
**Depends on**: [m6-product-rebuild.md](m6-product-rebuild.md), [m6-architecture.md](m6-architecture.md), [m6-domain-model.md](m6-domain-model.md), [m6-orchestration-interaction.md](m6-orchestration-interaction.md), [../08-design-language.md](../08-design-language.md), [../ssot/design-system.md](../ssot/design-system.md), [../ssot/i18n.md](../ssot/i18n.md)
**Review rule**: This specification is the implementation source for F1. Existing M0-M5 code, fixtures, API routes, and visual patterns are not requirements.

## 1. Outcome

F1 produces the first usable desktop-facing product surface. It is delivered in two lanes:

- **F1-A Client Foundation** can start after this specification is accepted. It covers the React shell, design system, preferences, i18n, Workspace entry flow, and typed gateway seam.
- **F1-B Desktop Integration** starts only after F0 selects the Backend process shape. It binds platform preferences, directory selection, Runtime lifecycle, and the real gateway in Tauri.

The combined phase delivers:

1. A quiet, canvas-first shell with a narrow navigation rail and an on-demand inspector.
2. A semantic design-token layer that supports light, dark, system, density, motion, contrast, and locale independently.
3. A first-start path that handles boot, backend unavailable, no Workspace, and Workspace creation.
4. A Workspace creation flow for name, project directory, Runner profile, and Agent output locale.
5. A typed boundary between the client and future Runtime services. F1 must not invent a second persistence or business-state protocol.
6. A verification surface that can be run in a browser and inside the Tauri shell without old development controls.

F1-A is a product-surface slice. It does not claim that a Workspace has been persisted or that a Run can execute. F1-B supplies the selected Runtime connection, but Workspace business persistence and Run execution remain F2/F3 responsibilities.

## 2. Scope

### 2.1 Included in F1-A

- React application bootstrap and desktop shell layout.
- Navigation rail, context bar, canvas viewport, inspector surface, settings surface, and modal/drawer primitives.
- Semantic token implementation and built-in light, dark, and system themes.
- Comfortable and compact density.
- Full, reduced, and system motion settings.
- Normal, high, and system contrast settings where the platform exposes them.
- `zh-CN` and `en-US` UI locales.
- Device preference persistence through a replaceable adapter.
- Workspace creation form, validation, Runner probe presentation, and output-locale selection.
- Backend gateway interfaces and explicit unavailable/error states.
- Keyboard navigation, focus management, screen-reader names, reduced-motion behavior, and locale expansion checks.
- Unit tests, component tests, and screenshots for the F1 states.

### 2.2 Included in F1-B after F0

- Tauri-backed device preference adapter.
- Platform directory picker capability.
- Runtime connection and startup status adapter selected by F0.
- Desktop startup, retry, diagnostics, quit, and clean shutdown wiring.
- A desktop build that loads bundled frontend assets without Vite.

### 2.3 Excluded from all of F1

- Runtime sidecar or in-process Backend implementation.
- Runtime authentication, port allocation, process supervision, or platform packaging.
- Real Runner probing or `pi` execution. F1 uses typed probe results supplied by a gateway or test fixture.
- Organization and Workflow editing, task dependencies, gates, joins, rework, or Run Snapshot creation.
- Run status, Handoff, Attention, Artifact, SSE, or command/event persistence.
- Migration of M0-M5 fixtures or old API routes.
- Cloud accounts, sync, mobile layout, or production Web delivery.

Anything in the excluded list must be represented by an interface or an unavailable state, not by mock business logic that can be mistaken for production behavior. F1-A also treats every F1-B capability as unavailable until a real desktop adapter is injected.

## 3. Non-negotiable decisions

| Area | F1 decision |
|---|---|
| Primary composition | Narrow navigation rail + full canvas + on-demand inspector; no permanent three-column layout |
| Default appearance | Light theme, cool white canvas, charcoal text, vermilion primary signal |
| Surface language | Seat and Group are spatial objects, not nested cards; page sections are unframed layouts |
| Business state | Client view state is separate from Workspace, Workflow, Snapshot, and Runtime state |
| Locale | UI locale and Agent output locale are separate values |
| Theme | Components read semantic tokens, never raw color literals or theme names |
| Platform | OS differences come through shell capabilities, not component-level user-agent branches |
| Runtime seam | Client calls a typed gateway; unavailable Runtime is a first-class state |
| Existing code | Old components and data may be removed; compatibility wrappers are prohibited |

## 4. User-visible states

The application root owns a finite state machine. A state transition must replace the previous state rather than briefly render stale Workspace content.

```text
booting
  -> restoring_preferences
  -> checking_backend
  -> startup_error
  -> no_workspace
  -> workspace_loading
  -> ready
```

### 4.1 `booting`

- Render only the application background and a compact progress indicator.
- Do not render old fixture content, an empty Organization, or editable controls.
- The state must have a stable minimum height and must not cause a layout jump when replaced.

### 4.2 `restoring_preferences`

- Load the device preference adapter.
- Apply theme, density, motion, contrast, and UI locale before rendering product copy.
- If a preference is invalid, discard only that field and record a diagnostic code; do not fail the whole app.

### 4.3 `checking_backend`

- Ask the gateway for connection status and capability metadata.
- Show a connection state that is useful to a person, not a raw URL, PID, port, or Python error.
- Do not allow Workspace submission while the gateway is unknown.

### 4.4 `startup_error`

Show:

- a stable error title and localized explanation,
- **Retry**,
- **Open diagnostics**,
- and a non-destructive **Quit** action when the shell exposes it.

Retry repeats the check with the same preferences. It must not reset the form or create a new Workspace.

### 4.5 `no_workspace`

- Show the Workspace entry action and a quiet empty canvas background.
- The primary action is **Create Workspace**.
- Do not show a fake recent Run, sample Organization, fixture switcher, or Runner mode toggle.

### 4.6 `workspace_loading` and `ready`

- Show Workspace identity before loading the full projection.
- Keep the canvas non-editable until its typed projection is ready.
- In `ready`, the inspector is closed until an object is selected.

## 5. Component and module ownership

The implementation may reorganize files, but each responsibility must remain in one module.

```text
apps/canvas/src/
  app-shell/       root state machine, rail, context bar, layout regions
  canvas/          viewport, empty state, projection boundary, viewport state
  design-system/   tokens, theme resolver, primitives, status and focus styles
  preferences/     schema, validation, adapter, preference store
  i18n/            locale resources, formatter, locale store
  workspace/       creation flow, form state, Runner probe view, gateway port
  inspector/       selection-driven panel shell and object-section contract
  settings/        device settings surface
  test-support/    typed fixtures and render helpers only
```

Ownership rules:

- `app-shell` coordinates regions and root state; it does not validate Runner profiles or mutate Workspace data.
- `design-system` owns visual tokens and primitive interaction states; it does not know Organization or Run semantics.
- `preferences` owns device settings only; it never writes Workspace or Run data.
- `workspace` owns form state and commands to the gateway; it does not invent a persistence result.
- `canvas` owns viewport and selection state only; it does not derive business status from labels or timing.
- `inspector` renders typed sections supplied by the selected projection; it does not become a second router.

The existing `TopBar`, `TodoTray`, `DossierDrawer`, old fixture selectors, and old Stage/Edge/Bubble state may be deleted instead of adapted.

## 6. Design-token contract

### 6.1 Token layers

Use the three layers from [Design System SSoT](../ssot/design-system.md):

```text
primitive -> semantic -> component
```

Components may consume semantic and approved component tokens only. A raw hex value in a component stylesheet is a review failure.

Required semantic tokens:

```text
--color-app-background
--color-canvas-background
--color-navigation-background
--color-surface
--color-surface-raised
--color-text-primary
--color-text-secondary
--color-text-inverse
--color-border-subtle
--color-border-strong
--color-action-primary
--color-action-primary-hover
--color-focus
--color-selection
--color-status-active
--color-status-waiting
--color-status-danger
--color-status-success
--color-status-neutral
```

Required component tokens:

```text
--navigation-rail-width
--context-bar-height
--inspector-width
--inspector-max-width
--control-height
--seat-size
--handoff-duration
```

### 6.2 Built-in themes

Implement `light`, `dark`, and `system` as resolver values. `system` follows the platform preference and must not change the stored user selection. The default light theme uses these reference semantics:

| Semantic role | Light reference |
|---|---|
| Canvas background | `#F7F8F9` |
| App background | `#ECEFF1` |
| Surface | `#FFFFFF` |
| Navigation background | `#1A1D21` |
| Primary text | `#17191C` |
| Secondary text | `#676E76` |
| Subtle border | `#D9DEE3` |
| Primary signal | `#E94B35` |
| Active work | `#2F6FDB` |
| Waiting | `#B97816` |
| Danger | `#C33F39` |
| Success | `#287658` |

These values belong in theme definitions, not component code. Dark theme must be designed as a separate hierarchy. Do not invert the light palette.

### 6.3 Density, motion, contrast

- Comfortable and compact change spacing, control height, line height, and list row height only.
- Full, reduced, and system motion change transitions and Handoff presentation without delaying state changes.
- High contrast keeps borders, focus, text, icons, and status shapes distinguishable without relying on subtle background shades.
- `prefers-reduced-motion` and forced-colors platform signals override ordinary user settings when required by accessibility policy.

### 6.4 Primitive requirements

Implement and test these primitives before composing screens:

- `IconButton`: Lucide icon, accessible name, tooltip, disabled/loading/pressed/focus states.
- `Button`: primary, secondary, quiet, danger; one primary action per context.
- `TextField`: label, hint, error, invalid, focus, IME-safe input.
- `Select` or `Menu`: keyboard navigation, selected state, long-label handling.
- `SegmentedControl`: mutually exclusive theme/motion/density values.
- `Dialog` or `Sheet`: focus trap, escape behavior, return focus, compact viewport behavior.
- `StatusMark`: icon and text semantics; color is supplemental.
- `Notice`: informational, warning, danger, and unavailable states.

Do not add a general-purpose component library beyond these primitives in F1.

## 7. Shell layout contract

### 7.1 Regions

```text
┌──────┬──────────────────────────────────────────────┐
│ rail │ context bar                                 │
│      ├──────────────────────────────────────────────┤
│      │                                              │
│      │ canvas viewport                              │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

The inspector is a conditional fourth surface. It must not reserve width when closed.

### 7.2 Dimensions and breakpoints

| Window | Required behavior |
|---|---|
| `>=1440px` | Inspector may dock at `--inspector-width`; canvas remains usable |
| `1024-1439px` | Inspector overlays the canvas as a sheet; it does not shrink the main canvas below usability |
| `<1024px` | Compact fallback for development and accessibility testing; not the primary release size |
| Minimum target | `1024x680` |

Target values:

- Navigation rail: `56px` default, `64px` expanded.
- Context bar: `52px` target.
- Inspector: `320px` target, `360px` maximum.
- Base spacing: multiples of `4px`.

Text must wrap or truncate inside its parent. No control may resize the canvas because a translated label is longer.

### 7.3 Navigation rail

Entries are **Workspaces**, **Runs**, **Attention**, and **Settings**. The rail shows the current Workspace identity and an Attention count only when the count is non-zero. Labels appear in a temporary expanded rail or tooltip; the collapsed rail is not a collection of unlabeled mystery icons.

### 7.4 Context bar

Show current Workspace, project directory summary, current view, save/connection state, and one primary action. Do not place Runner mode, fixture, LOD, event source, or debug switches here.

### 7.5 Canvas viewport

F1 supplies the viewport boundary and empty/loading/error states. A typed projection may be injected by test support, but no old fixture is rendered in production startup. Pan, zoom, selection, and viewport persistence are view state. They do not emit domain commands.

### 7.6 Inspector

- Closed by default.
- Opens from a selected object or Attention destination.
- Uses a stable shell with typed sections.
- Docked on wide windows and overlaid on ordinary windows.
- Escape closes it and returns focus to the invoking object.
- It must not show raw protocol payloads, internal IDs, or Runner secrets in default sections.

## 8. Workspace creation contract

The creation flow is a reversible four-step form:

```text
name -> project directory -> Runner profile -> Agent output locale -> review/create
```

### 8.1 Form state

```ts
type WorkspaceCreateDraft = {
  name: string;
  projectPath: string | null;
  runnerProfileId: string | null;
  outputLocale: "zh-CN" | "en-US";
  step: "name" | "project" | "runner" | "output-locale" | "review";
  dirty: boolean;
};
```

This draft is transient. It must not be serialized as `WorkspaceConfig` before the gateway confirms creation.

### 8.2 Name validation

- Required after trimming.
- Validate against platform filename restrictions without using the display name as a path.
- Preserve the typed value while showing the error.
- Closing a dirty form asks to continue editing or discard. An untouched form closes directly.

### 8.3 Project directory

- Use a shell directory picker through a capability interface.
- Accept only an existing readable directory at this stage.
- Preserve the platform path as supplied; do not replace separators manually.
- Display an understandable path summary and provide the full value through accessible text or tooltip.
- Distinguish missing, unreadable, unwritable, and picker-denied outcomes.

### 8.4 Runner profile

The UI consumes this typed result:

```ts
type RunnerProbeResult = {
  id: string;
  displayName: string;
  status:
    | "probing"
    | "available"
    | "missing"
    | "incompatible"
    | "needs_configuration"
    | "unsupported_platform"
    | "probe_failed";
  version?: string;
  capabilities: string[];
  messageKey?: string;
};
```

Rules:

- `pi` is the recommended default when its result is `available`.
- Only `available` profiles can be selected for creation.
- A probe failure is not silently converted to `missing`.
- Results can resolve independently; a slow profile must not block completed profiles.
- Secrets are never rendered or stored in the client form.

### 8.5 Output locale

- Show `zh-CN` and `en-US` with localized names.
- Initial value may follow UI locale, but changing UI locale later does not mutate this draft.
- The selected value becomes `defaultOutputLocale` only in the gateway command payload.

### 8.6 Create command boundary

```ts
type WorkspaceCreateInput = {
  name: string;
  projectPath: string;
  runnerProfileId: string;
  defaultOutputLocale: "zh-CN" | "en-US";
};

type WorkspaceGateway = {
  getConnectionState(): Promise<ConnectionState>;
  listRunnerProfiles(): Promise<RunnerProbeResult[]>;
  selectProjectDirectory(): Promise<string | null>;
  createWorkspace(input: WorkspaceCreateInput): Promise<
    | { ok: true; workspaceId: string }
    | { ok: false; code: string; messageKey: string }
  >;
};
```

F1 must provide a production gateway interface and an explicit unavailable implementation. A local test adapter may return deterministic data, but it must be injected and must never be used by the production entry point.

On a failed create command, keep the draft and show Retry. On success, clear the transient draft, transition to `workspace_loading`, and wait for the Workspace projection. Do not optimistically claim that a Workspace exists.

## 9. Preferences and locale contract

### 9.1 Device preference schema

```ts
type DevicePreferences = {
  schemaVersion: 1;
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  motion: "full" | "reduced" | "system";
  contrast: "normal" | "high" | "system";
  uiLocale: "zh-CN" | "en-US";
  lastWorkspaceId: string | null;
};
```

The adapter must support `read`, `write`, and `reset`. Writes are atomic from the store's perspective and must not include Workspace path, Runner secrets, Run state, or Agent output.

### 9.2 Locale resources

- Every visible F1 string uses a stable key.
- Missing translations fail tests/build checks; they do not render the key in a release path.
- Runtime codes and message keys are not translated in the gateway layer.
- Dates, numbers, file sizes, and relative times use `Intl`.
- Pseudo-locale expansion must be part of the test support.

Required key groups:

```text
app.boot.*
app.navigation.*
app.settings.*
app.connection.*
workspace.create.*
workspace.validation.*
runner.probe.*
locale.*
theme.*
common.action.*
common.status.*
```

## 10. Interaction rules

- `Escape`: close the topmost dialog/sheet/inspector; return focus to its opener.
- `Tab` / `Shift+Tab`: traverse only visible, enabled controls.
- `Enter`: submit the current valid form step; never submit while an IME composition is active.
- `Space`: toggle focused toggle/checkbox/segmented option.
- Pointer selection and keyboard selection produce the same selected object and inspector state.
- A busy state disables only the command that is in flight; it must not freeze navigation or discard input.
- Async results are applied only if they belong to the current request identity. A stale Runner probe cannot overwrite a newer result.
- Theme and locale changes apply immediately without resetting selection, viewport, form data, or stores.

## 11. Accessibility and platform checks

F1 must verify:

- WCAG AA text and control contrast in light, dark, and high contrast modes.
- Visible focus for every primary path.
- Accessible names for icon buttons and canvas objects.
- No business state expressed by color alone.
- Reduced motion removes path translation and continuous pulses.
- Forced colors preserve text, borders, focus, and state icons.
- Chinese and English labels fit without horizontal scrolling.
- `Ctrl` is used on Windows/Linux and `Cmd` on macOS when shortcuts are introduced.
- Project directory selection is exposed as a platform capability, not a browser-only path input.

## 12. Task breakdown

Tasks are intentionally ordered. A task is not complete until its code, test, and acceptance evidence exist.

| ID | Task | Depends on | Required result |
|---|---|---|---|
| F1-01 | Remove prototype entry surface | none | Old TopBar/TodoTray/Dossier/fixture switches are gone from the product entry; no compatibility wrapper remains |
| F1-02 | Add typed root state machine | F1-01 | Boot, preference restore, backend check, error, no Workspace, loading, and ready states are explicit and tested |
| F1-03 | Implement token registry and theme resolver | F1-01 | Semantic tokens, built-in themes, density, motion, contrast, and system listeners work without business-store recreation |
| F1-04 | Implement design primitives | F1-03 | Button, IconButton, TextField, Select/Menu, SegmentedControl, Dialog/Sheet, StatusMark, and Notice have complete states |
| F1-05 | Implement i18n resources and formatter | F1-01 | `zh-CN`/`en-US`, missing-key test, pseudo-locale helper, and `Intl` formatting are wired |
| F1-06 | Implement preference adapter/store | F1-03, F1-05 | Device preference schema validates, reads/writes/resets, and never receives Workspace/Run fields |
| F1-07 | Implement shell regions | F1-02, F1-04 | Rail, context bar, canvas region, and conditional inspector meet dimensions and breakpoints |
| F1-08 | Implement canvas viewport boundary | F1-07 | Loading, empty, unavailable, and injected projection states exist; viewport/selection are view-only |
| F1-09 | Implement inspector shell | F1-07, F1-08 | Selection and Attention destinations open a stable inspector; close restores focus |
| F1-10 | Implement Workspace creation flow | F1-04, F1-05 | Four-step validation flow, dirty-close confirmation, keyboard path, and locale expansion pass |
| F1-11 | Implement Runner probe presentation | F1-10 | All probe statuses, retry, partial completion, and no-secret display are covered |
| F1-12 | Implement gateway seam | F1-02, F1-10 | Production entry uses an unavailable gateway until Runtime is supplied; test adapter is injected only in tests |
| F1-13 | Implement settings surface | F1-03, F1-05 | Theme, density, motion, contrast, and UI locale can change independently and persist |
| F1-14 | Add accessibility and responsive verification | F1-04, F1-07, F1-10 | Keyboard, reduced motion, forced colors, 1024/1280/1440 widths, and both locales have evidence |
| F1-15 | Complete F1-A review package | F1-01 through F1-14 | Typecheck, lint, unit/component tests, build, screenshots, diff review, and Workbench checkpoint are recorded |
| F1-16 | Bind platform preferences | F0 decision, F1-06 | Tauri adapter reads/writes the platform app-config directory and preserves the device-only schema |
| F1-17 | Bind project directory selection | F0 decision, F1-10 | Native picker and path diagnostics implement the client capability without browser path workarounds |
| F1-18 | Bind the selected Runtime gateway | F0 decision, F1-12 | Connection status, retry, diagnostics, and create command use the selected authenticated transport; no fixed port or old API route |
| F1-19 | Wire desktop startup and shutdown | F1-16 through F1-18 | Bundled frontend follows the root state machine, owns only its Runtime process, and exits without stale child processes |
| F1-20 | Complete F1-B desktop review | F1-19 | Tauri build/check, bundled-asset startup, failure/retry, preference path, directory picker, and shutdown evidence are recorded |

### 12.1 File ownership for implementation

The F1-A implementation lane owns:

- `apps/canvas/src/**`
- `apps/canvas/package.json` only when a dependency is required by this spec
- `packages/protocol/src/**` only for client-facing F1 types that are explicitly not business event/schema types
- `docs/specs/f1-shell-design-system.md` task checkboxes and evidence links

The implementation lane must not edit:

- `services/runtime/**`
- `src-tauri/src/runtime.rs`
- `docs/specs/m6-events-commands.md`
- `docs/specs/m6-domain-model.md`
- old M0-M5 specs to make tests pass

The F1-B lane owns the relevant `src-tauri/**` and gateway adapter files after F0 documents the selected process and transport. Changes outside the active lane's owned set require a written reason and controller review before merge.

## 13. Verification matrix

| Risk | Required evidence | Failure condition |
|---|---|---|
| Root lifecycle | State-machine tests + startup screenshots | Stale Workspace or editable controls appear before readiness |
| Token semantics | Theme snapshot + raw-color scan | Component reads hex or branches on theme name |
| Preference ownership | Schema test + persisted payload inspection | Workspace, Runner secret, or Run field enters device preferences |
| Locale separation | Two-locale screenshots + payload assertion | UI locale changes output locale or business state |
| Form correctness | Validation and async race tests | Stale probe overwrites current selection or failed create clears input |
| Layout | 1024/1280/1440 screenshots | Inspector permanently compresses canvas or text overflows |
| Accessibility | Keyboard smoke + reduced-motion/forced-colors checks | Focus lost, color-only status, or motion setting ignored |
| Runtime boundary | Gateway contract tests | Production entry uses an in-memory business store or old API route |
| Prototype removal | `rg` scan for fixture/debug controls + review | Old fixture selector, Stage/Edge/Bubble command, or development control remains in entry |

Required commands for the lane, adjusted only for the final package manager:

```text
pnpm typecheck:canvas
pnpm lint:canvas
pnpm build:canvas
pnpm --filter @ensemble/canvas test -- --run
```

Add browser screenshots or Playwright evidence for the state and layout rows above. A green build without those artifacts does not close F1.

## 14. Exit gates

### 14.1 F1-A client foundation

F1-A passes only when all of the following are true:

- The first screen is the new shell, not the prototype.
- The shell can render every root state without stale business content.
- Theme, density, motion, contrast, and UI locale are independent and persistent.
- Workspace creation validates all four fields, preserves failed input, and never claims a Backend result it did not receive.
- The Runtime gateway is typed and replaceable; no F1 code depends on old M2-M5 routes.
- The canvas remains the dominant surface and the inspector is conditional.
- `zh-CN` and `en-US` pass expansion, no mixed-language, and keyboard checks.
- The implementation has unit/component tests, build/lint/typecheck output, and screenshots.
- An independent audit confirms goal alignment, data ownership, architecture boundaries, and the absence of raw-color/platform/locale leakage.

Passing this gate allows F1-A to merge. It does not mark F1 complete.

### 14.2 F1 complete

F1 closes only after F1-A passes and F1-B also proves:

- Device preferences use the platform app-config directory.
- Project directory selection uses the native capability and returns actionable path failures.
- Startup status and retry are driven by the Runtime shape selected in F0.
- Production startup uses bundled frontend assets rather than a Vite server.
- Shutdown terminates only the owned Runtime process tree and leaves no residual process.
- No fixed development port, repository path, `.venv`, or old M2-M5 API route appears in the production connection path.

F1 closes the product shell and desktop connection foundation only. It does not close Backend packaging, Workflow editing, Run execution, or three-platform release.
