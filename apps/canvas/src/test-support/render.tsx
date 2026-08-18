import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import type { PreferenceAdapter } from "../preferences/adapter";
import type { DevicePreferences } from "../preferences/schema";
import { TestProviders } from "./TestProviders";

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & {
    preferences?: Partial<DevicePreferences>;
    adapter?: PreferenceAdapter;
  },
) {
  const { preferences, adapter, ...rest } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders preferences={preferences} adapter={adapter}>
        {children}
      </TestProviders>
    ),
    ...rest,
  });
}
