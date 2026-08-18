import {
  assertDeviceOnlyPayload,
  DEFAULT_DEVICE_PREFERENCES,
  type DevicePreferences,
  validateDevicePreferences,
  type PreferenceDiagnostic,
} from "./schema";

export type PreferenceAdapter = {
  read(): Promise<{
    preferences: DevicePreferences;
    diagnostics: PreferenceDiagnostic[];
  }>;
  write(preferences: DevicePreferences): Promise<void>;
  reset(): Promise<void>;
};

const STORAGE_KEY = "ensemble.devicePreferences.v1";

export function createMemoryPreferenceAdapter(
  initial: DevicePreferences = DEFAULT_DEVICE_PREFERENCES,
): PreferenceAdapter {
  let stored: DevicePreferences = { ...initial };

  return {
    async read() {
      return validateDevicePreferences(stored);
    },
    async write(preferences) {
      stored = assertDeviceOnlyPayload({ ...preferences });
    },
    async reset() {
      stored = { ...DEFAULT_DEVICE_PREFERENCES };
    },
  };
}

export function createLocalStoragePreferenceAdapter(
  storage: Storage = globalThis.localStorage,
): PreferenceAdapter {
  return {
    async read() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
          return validateDevicePreferences(DEFAULT_DEVICE_PREFERENCES);
        }
        return validateDevicePreferences(JSON.parse(raw) as unknown);
      } catch {
        return {
          preferences: { ...DEFAULT_DEVICE_PREFERENCES },
          diagnostics: [{ field: "$", code: "adapter_read_failed" }],
        };
      }
    },
    async write(preferences) {
      const safe = assertDeviceOnlyPayload({ ...preferences });
      storage.setItem(STORAGE_KEY, JSON.stringify(safe));
    },
    async reset() {
      storage.removeItem(STORAGE_KEY);
    },
  };
}
