import type {
  ContrastPreference,
  DensityPreference,
  MotionPreference,
  ThemePreference,
} from "../design-system/tokens/types";

export type UiLocale = "zh-CN" | "en-US";

export type DevicePreferences = {
  schemaVersion: 1;
  theme: ThemePreference;
  density: DensityPreference;
  motion: MotionPreference;
  contrast: ContrastPreference;
  uiLocale: UiLocale;
  lastWorkspaceId: string | null;
};

export type PreferenceDiagnostic = {
  field: string;
  code:
    | "invalid_type"
    | "invalid_value"
    | "unknown_field"
    | "unsupported_version"
    | "adapter_read_failed"
    | "adapter_write_failed";
};

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  schemaVersion: 1,
  theme: "light",
  density: "comfortable",
  motion: "system",
  contrast: "system",
  uiLocale: "zh-CN",
  lastWorkspaceId: null,
};

const THEMES = new Set<ThemePreference>(["light", "dark", "system"]);
const DENSITIES = new Set<DensityPreference>(["comfortable", "compact"]);
const MOTIONS = new Set<MotionPreference>(["full", "reduced", "system"]);
const CONTRASTS = new Set<ContrastPreference>(["normal", "high", "system"]);
const LOCALES = new Set<UiLocale>(["zh-CN", "en-US"]);

const DEVICE_PREFERENCE_FIELDS = new Set([
  "schemaVersion",
  "theme",
  "density",
  "motion",
  "contrast",
  "uiLocale",
  "lastWorkspaceId",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateDevicePreferences(input: unknown): {
  preferences: DevicePreferences;
  diagnostics: PreferenceDiagnostic[];
} {
  const diagnostics: PreferenceDiagnostic[] = [];
  const preferences: DevicePreferences = { ...DEFAULT_DEVICE_PREFERENCES };

  if (!isPlainObject(input)) {
    diagnostics.push({ field: "$", code: "invalid_type" });
    return { preferences, diagnostics };
  }

  for (const field of Object.keys(input)) {
    if (!DEVICE_PREFERENCE_FIELDS.has(field)) {
      diagnostics.push({ field, code: "unknown_field" });
    }
  }

  if (input.schemaVersion !== 1) {
    diagnostics.push({ field: "schemaVersion", code: "unsupported_version" });
  } else {
    preferences.schemaVersion = 1;
  }

  if (typeof input.theme === "string" && THEMES.has(input.theme as ThemePreference)) {
    preferences.theme = input.theme as ThemePreference;
  } else if ("theme" in input) {
    diagnostics.push({ field: "theme", code: "invalid_value" });
  }

  if (
    typeof input.density === "string" &&
    DENSITIES.has(input.density as DensityPreference)
  ) {
    preferences.density = input.density as DensityPreference;
  } else if ("density" in input) {
    diagnostics.push({ field: "density", code: "invalid_value" });
  }

  if (typeof input.motion === "string" && MOTIONS.has(input.motion as MotionPreference)) {
    preferences.motion = input.motion as MotionPreference;
  } else if ("motion" in input) {
    diagnostics.push({ field: "motion", code: "invalid_value" });
  }

  if (
    typeof input.contrast === "string" &&
    CONTRASTS.has(input.contrast as ContrastPreference)
  ) {
    preferences.contrast = input.contrast as ContrastPreference;
  } else if ("contrast" in input) {
    diagnostics.push({ field: "contrast", code: "invalid_value" });
  }

  if (typeof input.uiLocale === "string" && LOCALES.has(input.uiLocale as UiLocale)) {
    preferences.uiLocale = input.uiLocale as UiLocale;
  } else if ("uiLocale" in input) {
    diagnostics.push({ field: "uiLocale", code: "invalid_value" });
  }

  if (input.lastWorkspaceId === null) {
    preferences.lastWorkspaceId = null;
  } else if (typeof input.lastWorkspaceId === "string") {
    preferences.lastWorkspaceId = input.lastWorkspaceId;
  } else if ("lastWorkspaceId" in input) {
    diagnostics.push({ field: "lastWorkspaceId", code: "invalid_type" });
  }

  return { preferences, diagnostics };
}

export function assertDeviceOnlyPayload(payload: DevicePreferences): DevicePreferences {
  const keys = Object.keys(payload);
  for (const field of keys) {
    if (!DEVICE_PREFERENCE_FIELDS.has(field)) {
      throw new Error(`Device preferences must not include ${field}`);
    }
  }
  return payload;
}
