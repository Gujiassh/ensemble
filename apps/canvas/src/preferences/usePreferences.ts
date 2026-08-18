import { useContext } from "react";
import { PreferenceContext, type PreferenceContextValue } from "./context";
import type { UiLocale } from "./schema";

export function usePreferences(): PreferenceContextValue {
  const value = useContext(PreferenceContext);
  if (!value) {
    throw new Error("usePreferences must be used within PreferenceProvider");
  }
  return value;
}

export function useUiLocale(): UiLocale {
  return usePreferences().preferences.uiLocale;
}
