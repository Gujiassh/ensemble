import { useMemo, type ReactNode } from "react";
import { usePreferences } from "../preferences/usePreferences";
import { I18nContext } from "./context";
import { createTranslator } from "./format";

export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const translator = useMemo(() => createTranslator(preferences.uiLocale), [preferences.uiLocale]);

  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}
