import { describe, expect, it } from "vitest";
import { assertCatalogCoverage, CATALOGS, expandPseudoLocale } from "./catalog";
import { createTranslator } from "./format";
import { enUS } from "./locales/en-US";

describe("i18n catalog", () => {
  it("covers every en-US key in zh-CN", () => {
    expect(() => assertCatalogCoverage()).not.toThrow();
    expect(Object.keys(CATALOGS["zh-CN"]).sort()).toEqual(Object.keys(enUS).sort());
  });

  it("fails loudly for missing keys at translate time", () => {
    const { t } = createTranslator("en-US");
    expect(() => t("app.boot.loading")).not.toThrow();
    const unsafe = t as (key: string) => string;
    expect(() => unsafe("does.not.exist")).toThrow(/Missing translation key/);
  });

  it("supports pseudo-locale expansion", () => {
    expect(expandPseudoLocale("Settings")).toBe("⟦Settings···⟧");
    const { t } = createTranslator("en-US", { pseudo: true });
    expect(t("app.settings.title")).toContain("⟦");
  });

  it("formats numbers with Intl", () => {
    const zh = createTranslator("zh-CN");
    const en = createTranslator("en-US");
    expect(zh.formatNumber(1234.5)).toMatch(/1,?234/);
    expect(en.formatFileSize(2048)).toContain("KB");
  });
});
