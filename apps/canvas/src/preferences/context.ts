import { createContext } from "react";
import type { ResolvedAppearance } from "../design-system/tokens/types";
import type { DevicePreferences, PreferenceDiagnostic } from "./schema";

export type PreferenceContextValue = {
  preferences: DevicePreferences;
  diagnostics: PreferenceDiagnostic[];
  appearance: ResolvedAppearance;
  ready: boolean;
  setPreferences: (patch: Partial<DevicePreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
};

export const PreferenceContext = createContext<PreferenceContextValue | null>(null);
