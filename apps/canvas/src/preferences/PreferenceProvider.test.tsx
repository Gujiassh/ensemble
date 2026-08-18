import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createMemoryPreferenceAdapter } from "./adapter";
import { PreferenceProvider } from "./PreferenceProvider";
import { usePreferences } from "./usePreferences";

function RapidUpdateHarness() {
  const { ready, setPreferences } = usePreferences();
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => {
        void setPreferences({ theme: "dark" });
        void setPreferences({ uiLocale: "en-US" });
      }}
    >
      Update
    </button>
  );
}

describe("PreferenceProvider", () => {
  it("merges rapid independent updates against the latest snapshot", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryPreferenceAdapter();
    render(
      <PreferenceProvider adapter={adapter}>
        <RapidUpdateHarness />
      </PreferenceProvider>,
    );

    const button = await screen.findByRole("button", { name: "Update" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(async () => {
      const stored = await adapter.read();
      expect(stored.preferences.theme).toBe("dark");
      expect(stored.preferences.uiLocale).toBe("en-US");
    });
  });
});
