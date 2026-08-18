import { useContext } from "react";
import type { MessageKey } from "./catalog";
import { I18nContext } from "./context";
import type { Translator } from "./format";

export function useI18n(): Translator {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
}

export function useT(): (key: MessageKey) => string {
  return useI18n().t;
}
