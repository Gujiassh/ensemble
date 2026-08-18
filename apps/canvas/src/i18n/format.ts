import type { UiLocale } from "../preferences/schema";
import { CATALOGS, expandPseudoLocale, type MessageKey } from "./catalog";

export type TranslateOptions = {
  params?: Record<string, string | number>;
  pseudo?: boolean;
};

export function createTranslator(locale: UiLocale, options: { pseudo?: boolean } = {}) {
  const catalog = CATALOGS[locale];

  function t(key: MessageKey, translateOptions: TranslateOptions = {}): string {
    const raw = catalog[key];
    if (typeof raw !== "string") {
      throw new Error(`Missing translation key: ${key}`);
    }
    let text = raw;
    if (translateOptions.params) {
      for (const [name, value] of Object.entries(translateOptions.params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    if (options.pseudo || translateOptions.pseudo) {
      return expandPseudoLocale(text);
    }
    return text;
  }

  return {
    t,
    locale,
    formatDate(value: Date | string | number, opts?: Intl.DateTimeFormatOptions): string {
      return new Intl.DateTimeFormat(locale, opts).format(
        value instanceof Date ? value : new Date(value),
      );
    },
    formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
      return new Intl.NumberFormat(locale, opts).format(value);
    },
    formatRelativeTime(
      value: number,
      unit: Intl.RelativeTimeFormatUnit,
      opts?: Intl.RelativeTimeFormatOptions,
    ): string {
      return new Intl.RelativeTimeFormat(locale, opts).format(value, unit);
    },
    formatFileSize(bytes: number): string {
      const units = ["B", "KB", "MB", "GB", "TB"] as const;
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
      }
      return `${new Intl.NumberFormat(locale, {
        maximumFractionDigits: size < 10 && unitIndex > 0 ? 1 : 0,
      }).format(size)} ${units[unitIndex]}`;
    },
  };
}

export type Translator = ReturnType<typeof createTranslator>;
