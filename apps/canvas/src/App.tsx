import { AppShell } from "./app-shell/AppShell";
import { I18nProvider } from "./i18n/I18nProvider";
import { createLocalStoragePreferenceAdapter } from "./preferences/adapter";
import { PreferenceProvider } from "./preferences/PreferenceProvider";
import { createUnavailableGateway } from "./workspace/gateway";

/**
 * Production entry.
 * Preference adapter: localStorage until F1-B binds the platform config directory.
 * Gateway: explicit unavailable implementation until Runtime is injected by F1-B.
 * Test/demo adapters must never be selected here.
 */
const preferenceAdapter = createLocalStoragePreferenceAdapter();
const gateway = createUnavailableGateway();

export default function App() {
  return (
    <div className="app-root">
      <PreferenceProvider adapter={preferenceAdapter}>
        <I18nProvider>
          <AppShell gateway={gateway} />
        </I18nProvider>
      </PreferenceProvider>
    </div>
  );
}
