# F1 Spec: Desktop Shell, Design System, and Workspace Entry

**Status**: Current Renderer reacceptance and Electron integration specification, revised 2026-08-21; implementation paused
**Owner**: F1-A frontend lane, followed by an F1-B desktop integration lane
**Depends on**: [m6-product-rebuild.md](m6-product-rebuild.md), [m6-architecture.md](m6-architecture.md), [m6-domain-model.md](m6-domain-model.md), [m6-orchestration-interaction.md](m6-orchestration-interaction.md), [../08-design-language.md](../08-design-language.md), [../ssot/design-system.md](../ssot/design-system.md), [../ssot/i18n.md](../ssot/i18n.md), [m6-electron-shell.md](m6-electron-shell.md)
**Review rule**: This specification is the implementation source for F1. Existing M0-M5 code, fixtures, API routes, and visual patterns are not requirements.

## 1. Outcome

F1 produces the first usable desktop-facing product surface. It is delivered in two lanes:

- **F1-A Renderer Reacceptance** covers the React shell, design system, preferences, i18n, Workspace entry flow, typed gateway seam, opaque native-directory DTO, root reconciliation, and absence of Electron/Runtime bootstrap leakage. Existing visual evidence remains partial evidence only for unchanged surfaces. F1-A does not resume until the product owner authorizes the required implementation stage.
- **F1-B Electron Integration** starts only after F0-A3 proves the selected Electron + Rust Runtime sidecar on Windows, macOS, and Linux. It binds platform preferences, opaque directory selection, tray lifecycle, Runtime supervision, MessagePort streams, and the real Canvas gateway through the frozen Preload bridge.

The combined phase delivers:

1. A quiet, canvas-first shell with a narrow navigation rail and an on-demand inspector.
2. A semantic design-token layer that supports light, dark, system, density, motion, contrast, and locale independently.
3. A first-start path that handles boot, backend unavailable, no Workspace, and Workspace creation.
4. A Workspace creation flow for name, project directory, Runner profile, permissions, and Agent output locale.
5. A typed boundary between the client and future Runtime services. F1 must not invent a second persistence or business-state protocol.
6. A verification surface that can be run in a browser and inside the Electron shell without old development controls; browser evidence never substitutes for packaged Electron proof.

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
- Workspace creation form, validation, Runner probe presentation, permission profile/path selection, and output-locale selection.
- Backend gateway interfaces and explicit unavailable/error states.
- Keyboard navigation, focus management, screen-reader names, reduced-motion behavior, and locale expansion checks.
- Unit tests, component tests, and screenshots for the F1 states.

### 2.2 Included in F1-B after F0

- Electron-backed device preference adapter through the frozen typed bridge.
- Platform directory picker capability returning opaque `selectionRef/displayName/access/expiresAt`, never a structured raw path.
- `apps/canvas/src/runtime-gateway/electron-gateway.ts` consuming the frozen bridge selected by F0.
- Desktop startup, retry, diagnostics, quit, and clean shutdown wiring.
- A desktop build that loads bundled frontend assets without Vite.

### 2.3 Excluded from all of F1

- Runtime sidecar implementation.
- Runtime authentication, port allocation, sidecar supervision, Electron security, or platform packaging; these belong to F0-A2/F0-A3.
- Real Runner probing or `pi`/Codex CLI/Claude Code execution. F1 uses typed probe results supplied by a gateway or test fixture.
- Organization and Workflow editing, task dependencies, gates, joins, rework, or Run Snapshot creation.
- Run status, Handoff, Attention, Artifact, SSE, or command/event persistence.
- Migration of M0-M5 fixtures or old API routes.
- Cloud accounts, sync, mobile layout, or production Web delivery.

Anything in the excluded list must be represented by an interface or an unavailable state, not by mock business logic that can be mistaken for production behavior. F1-A also treats every F1-B capability as unavailable until a real desktop adapter is injected.

## 3. Non-negotiable decisions

| Area | F1 decision |
|---|---|
| Primary composition | Narrow navigation rail + full canvas + on-demand inspector; no permanent three-column layout |
| Visual reference | Discord-like compact density, selection, and surface hierarchy only; never copy server/channel structure or replace the canvas with chat columns |
| Default appearance | Light theme, cool white canvas, charcoal text, vermilion primary signal |
| Surface language | Seat and Group are spatial objects, not nested cards; page sections are unframed layouts |
| Business state | Client view state is separate from Workspace, Workflow, Snapshot, and Runtime state |
| Locale | UI locale and Agent output locale are separate values |
| Theme | Components read semantic tokens, never raw color literals or theme names |
| Platform | OS differences come through shell capabilities, not component-level user-agent branches |
| Runtime seam | Client calls a typed gateway backed by one frozen Preload allowlist; unavailable Runtime is a first-class state |
| Existing code | Old components and data may be removed; compatibility wrappers are prohibited |

## 4. User-visible states

The application root owns a finite state machine. A state transition must replace the previous state rather than briefly render stale Workspace content.

```text
booting -> restoring_preferences -> checking_backend
checking_backend -> startup_error | runtime_reconciling
runtime_reconciling -> startup_error | no_workspace | workspace_loading
workspace_loading -> ready | startup_error
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

### 4.4 `runtime_reconciling`

- Enter only after the gateway is authenticated and reports that Runtime ledger/projection reconciliation is required before product state can be trusted.
- Render a stable Shell-level progress surface with localized phase and diagnostics access. A known Workspace identity may be shown, but no previous business projection, editable Canvas, Run action, or stale selection may render as current.
- Reconciliation applies persisted events and a typed Snapshot before deciding `no_workspace`, `workspace_loading`, or `ready`. UI animation, connection availability, and cached Client state cannot complete this state.
- A recoverable interruption retries the same reconciliation identity. A terminal reconciliation failure enters `startup_error` with a stable diagnostic code; it must not bypass reconciliation and open a half-connected Workspace.
- F1-A must model and render the state even when its injected test gateway completes reconciliation immediately. F1-B binds it to the selected Runtime startup contract.

### 4.5 `startup_error`

Show:

- a stable error title and localized explanation,
- **Retry**,
- **Open diagnostics**,
- and a non-destructive **Quit** action when the shell exposes it.

Retry repeats the failed backend check or Runtime reconciliation with the same preferences and stable request identity. It must not reset the form or create a new Workspace.

### 4.6 `no_workspace`

- Show the Workspace entry action and a quiet empty canvas background.
- The primary action is **Create Workspace**.
- Do not show a fake recent Run, sample Organization, fixture switcher, or Runner mode toggle.

### 4.7 `workspace_loading` and `ready`

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
  runtime-gateway/  Electron bridge consumer; production file is electron-gateway.ts
  inspector/       selection-driven panel shell and object-section contract
  settings/        device settings surface
  test-support/    typed fixtures and render helpers only
```

Ownership rules:

- `app-shell` coordinates regions and root state; it does not validate Runner profiles or mutate Workspace data.
- `design-system` owns visual tokens and primitive interaction states; it does not know Organization or Run semantics.
- `preferences` owns device settings only; it never writes Workspace or Run data.
- `workspace` owns form state and commands to the gateway; it does not invent a persistence result or inspect raw paths.
- `runtime-gateway/electron-gateway.ts` consumes only `window.ensemble` typed methods; it does not import Electron, access `ipcRenderer`, or learn Runtime token/port/PID/ready path.
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
--color-text-navigation
--color-text-on-primary
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
| Primary signal | `#C93626` |
| Active work | `#2F6FDB` |
| Waiting | `#95600C` |
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
| `>=1440px` | Inspector docks at `--inspector-width`; canvas remains usable |
| `1024-1439px` | Inspector overlays the canvas as a sheet; it does not shrink the main canvas below usability |
| `<1024px` | Compact fallback for development and accessibility testing; not the primary release size |
| Minimum target | `1024x680` |

Target values:

- Navigation rail: `56px` default, temporary `208px` overlay when expanded.
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
- The `1024-1439px` overlay is non-modal: it has no backdrop or focus trap, does not resize the central surface, and closes on explicit Close or the topmost-layer Escape action. Pointer interaction outside closes it only when no form is dirty.
- Crossing the dock/overlay breakpoint preserves the target object, active section, scroll anchor, and logical focus.
- Escape closes it and returns focus to the invoking object.
- It must not show raw protocol payloads, internal IDs, or Runner secrets in default sections.

## 8. Workspace creation contract

The creation flow is a reversible five-step form:

```text
name -> project directory -> Runner profile -> permissions -> Agent output locale -> review/create
```

### 8.1 Form state

```ts
type NativeDirectorySelection = {
  selectionRef: string;
  displayName: string;
  access: "read" | "write";
  expiresAt: string;
};

type WorkspaceCreateDraft = {
  name: string;
  projectDirectory: NativeDirectorySelection | null;
  runnerProfileId: string | null;
  permissionProfile: "read_only" | "workspace_write" | "selected_paths" | "full_access";
  pathGrantSelections: Array<NativeDirectorySelection & { scope: "workspace" }>;
  capabilityPolicies: WorkspaceCapabilityPolicies;
  outputLocale: "zh-CN" | "en-US";
  step: "name" | "project" | "runner" | "permissions" | "output-locale" | "review";
  dirty: boolean;
};

type WorkspaceCapabilityPolicies = {
  networkAccess: "allow" | "ask" | "deny";
  externalProcessExecution: "allow" | "ask" | "deny";
  writesOutsideWorkspace: "allow" | "ask" | "deny";
  destructiveCommands: "allow" | "ask" | "deny";
  externalPublish: "allow" | "ask" | "deny";
};
```

This draft is transient. It must not be serialized as `WorkspaceConfig` before the gateway confirms creation.

### 8.2 Name validation

- Required after trimming.
- Validate against platform filename restrictions without using the display name as a path.
- Preserve the typed value while showing the error.
- Closing a dirty form asks to continue editing or discard. An untouched form closes directly.

### 8.3 Project directory

- Use a named shell directory-picker method through the frozen capability interface.
- The Renderer receives only `selectionRef`, `displayName`, requested `access`, and `expiresAt`; it never receives or reconstructs a structured absolute path.
- Treat `displayName` as a non-authoritative label. It is not identity, cannot be submitted as a path, and must not become a full-path tooltip.
- Before returning the picker DTO, Main creates an unbound ref bound only to source `webContents`, main frame, purpose, access, expiry, and the validated real path.
- The Client allocates and persists the immutable Domain `commandId` before create dispatch; during create validation, Main atomically transitions each matching ref from `unbound` to `bound(commandId)`.
- Distinguish missing, unreadable, unwritable, expired, already-consumed, wrong-purpose, and picker-denied outcomes with stable codes.
- Runtime-local path normalization and persistence remain unchanged; the Electron boundary only hides the structured raw path from Renderer.

### 8.4 Runner profile

The UI consumes this typed result:

```ts
type RunnerProbeResult = {
  id: string;
  displayName: string;
  status:
    | "probing"
    | "available"
    | "not_installed"
    | "installed_incompatible"
    | "missing_configuration"
    | "unsupported_platform"
    | "probe_failed";
  version?: string;
  adapterVersion: string;
  supportedVersionRange: string;
  authenticationStatus: "signed_in" | "signed_out" | "unknown" | "not_applicable";
  capabilities: string[];
  messageKey?: string;
};
```

Rules:

- `pi` is the recommended default when its result is `available`; the first release also requires Codex CLI and Claude Code as official profiles. All three CLI installations and native logins are managed by the user.
- Only `available` profiles can be selected for creation.
- A probe failure is not silently converted to `not_installed`.
- Results can resolve independently; a slow profile must not block completed profiles.
- Secrets are never rendered or stored in the client form.
- A profile is `available` only when it reports Session, Terminal, Context delivery, and the enforcement capabilities required by the current permission draft. Missing capability names appear in diagnostics, not as a selectable profile.
- The draft starts with the documented permission defaults before the Runner step. Changing permissions later re-evaluates the selected Runner; if it no longer qualifies, keep the draft, clear only the Runner selection, and return the user to the Runner step with the exact missing capability.

### 8.5 Permissions

- The default profile is `workspace_write`.
- The user can choose `read_only`, `selected_paths`, or `full_access`.
- `selected_paths` uses the native directory picker and keeps separate opaque read/write selections in the Renderer. Workspace creation uses `workspace` scope; Main binds and resolves each ref only for its immutable Domain commandId, and Runtime persists the same path grants as before. Later Session/Run controls can add Attempt- or Run-scoped grants through the same boundary.
- Network, external process execution, writes outside the Workspace, destructive commands, and external publishing each use `allow | ask | deny`.
- Full access is visibly marked and does not disable secret redaction or attachment warnings.
- The review step shows the resolved profile, selected paths, and capability policies without rendering secret values.

The persistence and secret rules are defined in [m6-execution-workspace-security.md](m6-execution-workspace-security.md).

### 8.6 Output locale

- Show `zh-CN` and `en-US` with localized names.
- Initial value may follow UI locale, but changing UI locale later does not mutate this draft.
- The selected value becomes `defaultOutputLocale` only in the gateway command payload.

### 8.7 Create command boundary

```ts
type ConnectionState =
  | { kind: "checking" }
  | { kind: "unavailable"; code: string; retryable: boolean }
  | { kind: "runtime_reconciling"; reconciliationId: string; phaseKey: string }
  | { kind: "ready"; protocolVersion: number; capabilities: string[] };

type NativeDirectorySelection = {
  selectionRef: string;
  displayName: string;
  access: "read" | "write";
  expiresAt: string;
};

type WorkspaceCapabilityPolicies = {
  networkAccess: "allow" | "ask" | "deny";
  externalProcessExecution: "allow" | "ask" | "deny";
  writesOutsideWorkspace: "allow" | "ask" | "deny";
  destructiveCommands: "allow" | "ask" | "deny";
  externalPublish: "allow" | "ask" | "deny";
};

type RunnerProbeResult = {
  id: string;
  displayName: string;
  status:
    | "probing"
    | "available"
    | "not_installed"
    | "installed_incompatible"
    | "missing_configuration"
    | "unsupported_platform"
    | "probe_failed";
  version?: string;
  adapterVersion: string;
  supportedVersionRange: string;
  authenticationStatus: "signed_in" | "signed_out" | "unknown" | "not_applicable";
  capabilities: string[];
  messageKey?: string;
};

type WorkspaceCreateBridgeInput = {
  commandId: string;
  name: string;
  projectSelectionRef: string;
  runnerProfileId: string;
  permissionProfile: "read_only" | "workspace_write" | "selected_paths" | "full_access";
  pathGrantSelections: Array<{
    selectionRef: string;
    access: "read" | "write";
    scope: "workspace";
  }>;
  capabilityPolicies: WorkspaceCapabilityPolicies;
  defaultOutputLocale: "zh-CN" | "en-US";
};

type WorkspaceCreateState =
  | {
      kind: "selection_required";
      commandId: string;
      missingSelectionPurposes: Array<"project" | "path_grant">;
      messageKey: string;
    }
  | { kind: "sending"; commandId: string }
  | { kind: "accepted"; commandId: string }
  | { kind: "reconciling"; commandId: string }
  | { kind: "created"; commandId: string; workspaceId: string }
  | { kind: "rejected"; commandId: string; code: string; messageKey: string }
  | { kind: "conflict"; commandId: string; code: string; messageKey: string }
  | { kind: "outcome_unknown"; commandId: string; messageKey: string };

type WorkspaceSummary = {
  id: string;
  name: string;
  projectDirectoryLabel: string;
  runnerProfileId: string;
  defaultOutputLocale: "zh-CN" | "en-US";
};

type WorkspaceGateway = {
  getConnectionState(): Promise<ConnectionState>;
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  probeRunnerProfiles(
    onResult: (result: RunnerProbeResult) => void,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  selectProjectDirectory(options?: { signal?: AbortSignal }): Promise<
    | { ok: true; selection: NativeDirectorySelection }
    | { ok: false; code: string; messageKey: string }
  >;
  selectPathGrantDirectory(
    access: "read" | "write",
    options?: { signal?: AbortSignal },
  ): Promise<
    | { ok: true; selection: NativeDirectorySelection }
    | { ok: false; code: string; messageKey: string }
  >;
  createWorkspace(
    input: WorkspaceCreateBridgeInput,
    options?: { signal?: AbortSignal },
  ): Promise<WorkspaceCreateState>;
  reconcileWorkspaceCreate(
    commandId: string,
    options?: { signal?: AbortSignal },
  ): Promise<WorkspaceCreateState>;
  openDiagnostics?(): Promise<void>;
  requestQuit?(): Promise<void>;
};
```

F1 must provide a production gateway interface and an explicit unavailable implementation. The production implementation is `apps/canvas/src/runtime-gateway/electron-gateway.ts`; it consumes the frozen Preload bridge and never imports Electron APIs. A local test adapter may return deterministic opaque selections, but it must be injected and must never be used by the production entry point.

Before first dispatch, the Client allocates one immutable Domain `commandId` through the shared ID generator and durably writes a Workspace-create entry to the device Client request/recovery registry. The entry freezes non-directory form fields, current opaque selection refs, and `WorkspaceCreateState`; it contains no raw path. A Shell `requestId`, React operation ID, retry click, reload, or Main restart never allocates a replacement `commandId` for the same intent.

Electron Main validates `projectSelectionRef` and every `pathGrantSelections[].selectionRef`, resolves raw paths only inside Main, and constructs the unchanged Rust Runtime `WorkspaceCreateInput`. Each selection transitions atomically from unbound to `bound(commandId)`; it can be retried/reconciled only for that command and is never valid for a new command. The bridge type is deliberately named `WorkspaceCreateBridgeInput`; it does not rename or reshape the Runtime type.

Both `createWorkspace` and `reconcileWorkspaceCreate` first query the original Runtime `commandId`. If Runtime has an accepted/full payload, no raw selection is needed to observe final `workspace.created`, rejected, or conflict. If Runtime confirms `not_recorded`, the same `commandId` may retry only with valid existing or reselected refs; a new command needs new refs. Main restart invalidates in-memory refs but cannot duplicate an accepted create because query-by-commandId precedes resubmission. Main erases raw paths after accepted/full payload, keeps only a no-path bound tombstone until terminal outcome, then deletes all mappings; it persists no business state.

On `selection_required`, keep all non-directory draft values and reselect only missing purposes. On `outcome_unknown`, show reconciliation and call `reconcileWorkspaceCreate(commandId)`; never submit a new command. Only terminal `created` clears the draft and transitions to `workspace_loading`; `rejected` or `conflict` preserves the form and stable command evidence. Transport accepted alone never claims that a Workspace exists.

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
| F1-02 | Add typed root state machine | F1-01 | Boot, preference restore, backend check, Runtime reconciliation, error, no Workspace, loading, and ready states are explicit; stale content cannot bypass reconciliation |
| F1-03 | Implement token registry and theme resolver | F1-01 | Semantic tokens, built-in themes, density, motion, contrast, and system listeners work without business-store recreation |
| F1-04 | Implement design primitives | F1-03 | Button, IconButton, TextField, Select/Menu, SegmentedControl, Dialog/Sheet, StatusMark, and Notice have complete states |
| F1-05 | Implement i18n resources and formatter | F1-01 | `zh-CN`/`en-US`, missing-key test, pseudo-locale helper, and `Intl` formatting are wired |
| F1-06 | Implement preference adapter/store | F1-03, F1-05 | Device preference schema validates, reads/writes/resets, and never receives Workspace/Run fields |
| F1-07 | Implement shell regions | F1-02, F1-04 | Rail, context bar, canvas region, and conditional inspector meet dimensions and breakpoints |
| F1-08 | Implement canvas viewport boundary | F1-07 | Loading, empty, unavailable, and injected projection states exist; viewport/selection are view-only |
| F1-09 | Implement inspector shell | F1-07, F1-08 | Selection and Attention destinations open a stable inspector; close restores focus |
| F1-10 | Implement Workspace creation flow | F1-04, F1-05 | Five-step validation flow with permissions, dirty-close confirmation, keyboard path, and locale expansion pass |
| F1-11 | Implement Runner probe presentation | F1-10 | All probe statuses, retry, partial completion, and no-secret display are covered |
| F1-12 | Implement gateway seam | F1-02, F1-10 | Production entry uses unavailable gateway until Runtime is supplied; immutable commandId registry, create/reconcile state union and lost-response idempotency are contract-tested |
| F1-13 | Implement settings surface | F1-03, F1-05 | Theme, density, motion, contrast, and UI locale can change independently and persist |
| F1-14 | Add accessibility and responsive verification | F1-04, F1-07, F1-10 | Keyboard, reduced motion, forced colors, 1024/1280/1440 widths, and both locales have evidence |
| F1-15 | Complete F1-A review package | F1-01 through F1-14 | Typecheck, lint, unit/component tests, build, screenshots, diff review, and Workbench checkpoint are recorded |
| F1-16 | Bind platform preferences | F0-A3, F1-06 | Electron bridge reads/writes the platform app-config directory and preserves the device-only schema |
| F1-17 | Bind opaque directory selection | F0-A3, F1-10 | Native picker returns source/purpose/access/expiry/immutable-commandId-bound refs; Renderer has no structured raw path |
| F1-18 | Bind Electron Runtime gateway | F0-A3, F1-12 | `electron-gateway.ts` consumes frozen bridge; create/reconcile query original commandId, status/diagnostics/streams use typed proxy with no fixed port/bootstrap leak |
| F1-19 | Wire desktop startup, tray, and shutdown | F1-16 through F1-18 | Closing the window keeps the supervised Runtime running in the tray; explicit quit safely pauses and exits without unowned child processes |
| F1-20 | Complete F1-B Electron review | F1-19 | Packaged Electron security, bundled app://ensemble startup, MessagePort, opaque picker, preference path, safe quit and three-platform evidence are recorded |

### 12.1 Implementation status

This table is the delivery ledger for the current F1 implementation. “Complete” means the client-side code, focused tests, and required evidence exist. It does not imply that the blocked desktop/backend work is available.

| ID | Status | Evidence |
|---|---|---|
| F1-01 | complete | Prototype entry and fixture modules removed; production boundary test passes |
| F1-02 | revision required | Existing lifecycle tests cover the earlier state set; `runtime_reconciling`, its legal transitions, no-stale-content surface, stable retry identity, and AppShell evidence are missing |
| F1-03 | complete | Semantic token resolver, light/dark themes, forced contrast/motion handling, raw-color scan, and WCAG contrast tests |
| F1-04 | complete | Button, IconButton, TextField, Select, SegmentedControl, Dialog, StatusMark, and Notice primitives; Dialog and IME tests |
| F1-05 | complete | `zh-CN`/`en-US` catalog coverage, pseudo-locale helper, and `Intl` formatter tests |
| F1-06 | complete | Device-only schema, serialized preference writes, reset, rapid-update, and payload rejection tests |
| F1-07 | complete | [1024 empty](evidence/f1-a/no-workspace-zh-light-1024.png), [1280 overlay](evidence/f1-a/inspector-overlay-en-dark-1280.png), and [1440 docked](evidence/f1-a/inspector-docked-zh-light-1440.png) screenshots |
| F1-08 | complete | Typed Canvas viewport states, injected projection harness, and [ready Canvas](evidence/f1-a/workspace-created-en-light-1280.png) screenshot |
| F1-09 | complete | Inspector selection/focus tests and overlay/docked screenshots |
| F1-10 | revision required | Earlier entry flow evidence remains; permission profile, selected-path, and five-capability controls are not implemented yet |
| F1-11 | revision required | Earlier probe evidence remains; Session + Terminal + Context package supported-Runner qualification is not implemented yet |
| F1-12 | revision required | Earlier seam is partial evidence; immutable Workspace-create commandId registry, reconcile method/state union, selection binding, frozen bridge, byte-credit ports and bootstrap-leak rejection require reacceptance |
| F1-13 | complete | Preference provider tests plus [live settings switch](evidence/f1-a/settings-zh-dark-compact-1280.png) |
| F1-14 | complete | Playwright keyboard/focus smoke, reduced-motion runs, forced-colors styling, contrast tests, both locales, and 1024/1280/1440 screenshots |
| F1-15 | revision required | The 2026-08-18 [F1-A implementation audit](reviews/F1-A-implementation-review-2026-08-18.md) remains partial evidence for unchanged visuals only; Runtime reconciliation, opaque selection DTO, Electron gateway, permission selection, bootstrap-leak rejection and supported-Runner qualification require reacceptance |
| F1-16 | pending F0 verification | Requires F0-selected platform preference location and desktop adapter |
| F1-17 | pending F0 verification | Requires F0-selected native directory picker capability |
| F1-18 | pending F0 verification | Requires F0-selected authenticated Runtime transport |
| F1-19 | blocked | Requires F1-16 through F1-18 |
| F1-20 | blocked | Requires F1-B implementation and real Windows/macOS/Linux package evidence |

F1-02 was completed against a root lifecycle that moved directly from backend check to Workspace/error states. The mandatory `runtime_reconciling` state reopens its implementation and product acceptance. F1-10/F1-12 now also require opaque native-directory DTOs and the frozen Electron bridge; F1-11 still requires the Session/Terminal/Context Runner qualification. Prior visual evidence remains valid only for unchanged surfaces and cannot accept Electron security or transport.

### 12.2 File ownership for implementation

The sole current ownership source is [m6-interaction-implementation-slices.md](m6-interaction-implementation-slices.md) section 9. F1 uses these non-overlapping owners:

- F1-A Renderer owner: `apps/canvas/src/app-shell/**`, `workspace/**`, `preferences/**`, `i18n/**`, `design-system/**`, `canvas/**`, `inspector/**`, `settings/**`, and focused tests assigned by the owner table.
- Canvas gateway owner: exactly `apps/canvas/src/runtime-gateway/electron-gateway.ts` for production bridge consumption.
- Shared Shell protocol owner: `packages/protocol/src/shell/**` for pure typed bridge contracts and closed-schema validation; no second Shell-contract package.
- Electron F1-B owners: the non-overlapping `apps/desktop/src/main/{lifecycle,platform,runtime-supervisor,runtime-client,ipc-router,stream-bridge,security,updater}/**`, `src/preload/**`, `test/**`, and electron-builder configuration listed in the owner table. Security exclusively constructs/configures BrowserWindow and external confirmation; Lifecycle only consumes its factory and holds references; Platform only executes already-authorized named primitives.

F1 owners must not edit Rust Runtime Domain/Event/save/Runner contracts, old M0-M5 specs, or legacy shell code to make Electron tests pass. Shell-specific work cannot add Node business Runtime/PTY/SQLite or duplicate persistence. Changes outside the active owner's exact set require controller serialization and review.

## 13. Verification matrix

| Risk | Required evidence | Failure condition |
|---|---|---|
| Root lifecycle | State-machine tests for every legal transition, including `runtime_reconciling`, plus startup/reconciliation screenshots | Stale Workspace or editable controls appear before reconciliation and readiness |
| Token semantics | Theme snapshot + raw-color scan | Component reads hex or branches on theme name |
| Preference ownership | Schema test + persisted payload inspection | Workspace, Runner secret, or Run field enters device preferences |
| Locale separation | Two-locale screenshots + payload assertion | UI locale changes output locale or business state |
| Form correctness | Validation and async race tests | Stale probe overwrites current selection or failed create clears input |
| Layout | 1024/1280/1440 screenshots | Inspector permanently compresses canvas or text overflows |
| Accessibility | Keyboard smoke + reduced-motion/forced-colors checks | Focus lost, color-only status, or motion setting ignored |
| Packaged CJK IME | Windows/macOS/Linux forms + Terminal composition evidence | Enter during composition submits/sends, or compositionend duplicates text/bytes |
| Packaged accessibility | keyboard/focus/Escape/return-focus, forced colors/high contrast, accessibility tree, Narrator/VoiceOver/Orca-equivalent | Browser/component evidence is used instead of installed-app proof |
| Runtime boundary | Gateway/Preload contract tests plus packaged Electron evidence | Production entry uses in-memory business state, generic IPC, fixed port, bootstrap raw value or old API route |
| Workspace create idempotency | lost-response/Main-restart tests over persisted commandId registry and Runtime query | retry allocates new commandId, selection crosses command, or duplicate Workspace appears |
| Native directory boundary | DTO/schema/source-purpose-expiry-commandId-binding/lost-response tests | Renderer receives raw path, label becomes identity, or ref crosses window/purpose/command |
| Electron stream boundary | exact byte-credit, ack monotonic/contiguous, budgets/cancel/stale/slow tests | frame-count grant, future/stale ack, over-credit send, lifetime cap, stale port or Main-side Terminal authorization |
| Prototype removal | `rg` scan for fixture/debug controls + review | Old fixture selector, Stage/Edge/Bubble command, or development control remains in entry |

Required commands for the lane, adjusted only for the final package manager:

```text
pnpm typecheck:canvas
pnpm lint:canvas
pnpm build:canvas
pnpm --filter @ensemble/canvas test -- --run
```

Add browser screenshots or Playwright evidence for state/layout rows, but browser/component evidence cannot close packaged IME/accessibility rows. F1-B requires installed Windows/macOS/Linux Electron evidence with exact Electron/Chromium/OS versions. A green build without those artifacts does not close F1.

## 14. Exit gates

### 14.1 F1-A client foundation

F1-A passes only when all of the following are true:

- The first screen is the new shell, not the prototype.
- The shell can render every root state, including Runtime reconciliation, without stale business content; only a typed reconciliation result may advance to Workspace/no-Workspace readiness.
- Theme, density, motion, contrast, and UI locale are independent and persistent.
- Workspace creation validates name, opaque directory selections, Runner, permissions and output locale; Client persists immutable commandId before dispatch, lost responses reconcile the original Runtime command, and no retry can create a duplicate Workspace.
- The Runtime gateway is typed and replaceable; production `electron-gateway.ts` consumes only the frozen bridge, and no F1 code depends on old M2-M5 routes or raw Electron IPC.
- The canvas remains the dominant surface and the inspector is conditional.
- `zh-CN` and `en-US` pass expansion, no mixed-language, and keyboard checks.
- The implementation has unit/component tests, build/lint/typecheck output, and screenshots.
- An independent audit confirms goal alignment, data ownership, architecture boundaries, opaque directory DTOs, and absence of raw-color/platform/locale/bootstrap leakage.

Passing this gate allows F1-A to merge. It does not mark F1 complete.

### 14.2 F1 complete

F1 closes only after F1-A passes and F1-B also proves:

- Device preferences use the platform app-config directory.
- Project/path-grant selection uses opaque refs with display/access/expiry; Main alone resolves raw paths and returns actionable stable failures.
- Startup status, Event/Terminal ports and retry are driven by the Electron+Runtime shape selected in F0, with Runtime as final business/Terminal authority.
- Production startup uses only bundled `app://ensemble` assets rather than a Vite server or arbitrary URL/env redirect.
- Closing the window keeps the owned Runtime, active Runs, queue, and schedules alive in the system tray.
- Explicit quit waits for Runtime-authored safe pause; Main terminates only the signed Rust sidecar after acknowledgement or writes marker/diagnostics on Force, never enumerating Runner children.
- No fixed development port, repository path, `.venv`, raw path DTO, Runtime bootstrap value, generic IPC, or old M2-M5 API route appears in the production connection path.
- Installed Windows/macOS/Linux packages pass forms/Terminal CJK IME, keyboard/focus/Escape/return-focus, forced colors/high contrast/accessibility tree, Narrator/VoiceOver/Orca-equivalent, both locales/themes/DPI and reduced motion; browser evidence cannot substitute.

F1 closes the product shell and desktop connection foundation only. It does not close Backend packaging, Workflow editing, Run execution, or three-platform release.
