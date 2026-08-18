import { enUS, type MessageCatalog, type MessageKey } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";
import type { UiLocale } from "../preferences/schema";

export type { MessageKey, MessageCatalog };

export const SUPPORTED_LOCALES: readonly UiLocale[] = ["zh-CN", "en-US"] as const;

export const CATALOGS: Record<UiLocale, MessageCatalog> = {
  "en-US": enUS,
  "zh-CN": zhCN,
};

export function assertCatalogCoverage(): void {
  const keys = Object.keys(enUS) as MessageKey[];
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = CATALOGS[locale];
    for (const key of keys) {
      const value = catalog[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Missing translation for ${locale}:${key}`);
      }
    }
  }
}

export function expandPseudoLocale(text: string): string {
  return `⟦${text}···⟧`;
}
