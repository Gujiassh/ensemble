import type { ReactNode } from "react";
import { I18nProvider } from "../i18n/I18nProvider";
import { createMemoryPreferenceAdapter, type PreferenceAdapter } from "../preferences/adapter";
import { PreferenceProvider } from "../preferences/PreferenceProvider";
import { DEFAULT_DEVICE_PREFERENCES, type DevicePreferences } from "../preferences/schema";

type TestProvidersProps = {
  children: ReactNode;
  preferences?: Partial<DevicePreferences>;
  adapter?: PreferenceAdapter;
};

export function TestProviders({ children, preferences, adapter }: TestProvidersProps) {
  const preferenceAdapter =
    adapter ??
    createMemoryPreferenceAdapter({
      ...DEFAULT_DEVICE_PREFERENCES,
      ...preferences,
    });

  return (
    <PreferenceProvider adapter={preferenceAdapter}>
      <I18nProvider>{children}</I18nProvider>
    </PreferenceProvider>
  );
}
