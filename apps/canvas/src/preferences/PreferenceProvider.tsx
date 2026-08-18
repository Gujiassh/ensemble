import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyAppearanceToElement } from "../design-system/tokens/applyAppearance";
import {
  readPlatformSignals,
  resolveAppearance,
} from "../design-system/tokens/resolveAppearance";
import type { PreferenceAdapter } from "./adapter";
import { PreferenceContext } from "./context";
import {
  DEFAULT_DEVICE_PREFERENCES,
  type DevicePreferences,
  type PreferenceDiagnostic,
} from "./schema";

type PreferenceProviderProps = {
  adapter: PreferenceAdapter;
  children: ReactNode;
  rootElement?: HTMLElement | null;
};

export function PreferenceProvider({
  adapter,
  children,
  rootElement,
}: PreferenceProviderProps) {
  const [preferences, setPreferencesState] = useState<DevicePreferences>(
    DEFAULT_DEVICE_PREFERENCES,
  );
  const [diagnostics, setDiagnostics] = useState<PreferenceDiagnostic[]>([]);
  const [ready, setReady] = useState(false);
  const [signals, setSignals] = useState(() => readPlatformSignals());
  const preferencesRef = useRef(preferences);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  preferencesRef.current = preferences;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void (async () => {
      try {
        const result = await adapter.read();
        if (cancelled) {
          return;
        }
        preferencesRef.current = result.preferences;
        setPreferencesState(result.preferences);
        setDiagnostics(result.diagnostics);
      } catch {
        if (cancelled) {
          return;
        }
        preferencesRef.current = { ...DEFAULT_DEVICE_PREFERENCES };
        setPreferencesState({ ...DEFAULT_DEVICE_PREFERENCES });
        setDiagnostics([{ field: "$", code: "adapter_read_failed" }]);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const queries = [
      window.matchMedia("(prefers-color-scheme: dark)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(prefers-contrast: more)"),
      window.matchMedia("(forced-colors: active)"),
    ];
    const sync = () => setSignals(readPlatformSignals());
    for (const query of queries) {
      query.addEventListener("change", sync);
    }
    return () => {
      for (const query of queries) {
        query.removeEventListener("change", sync);
      }
    };
  }, []);

  const appearance = useMemo(
    () =>
      resolveAppearance(
        {
          theme: preferences.theme,
          density: preferences.density,
          motion: preferences.motion,
          contrast: preferences.contrast,
        },
        signals,
      ),
    [preferences, signals],
  );

  useEffect(() => {
    const target = rootElement ?? document.documentElement;
    applyAppearanceToElement(target, appearance);
    target.lang = preferences.uiLocale;
  }, [appearance, preferences.uiLocale, rootElement]);

  const setPreferences = useCallback(
    async (patch: Partial<DevicePreferences>) => {
      const next: DevicePreferences = {
        ...preferencesRef.current,
        ...patch,
        schemaVersion: 1,
      };
      preferencesRef.current = next;
      setPreferencesState(next);
      const write = writeQueueRef.current.then(() => adapter.write(next));
      writeQueueRef.current = write.catch(() => undefined);
      try {
        await write;
      } catch {
        setDiagnostics((current) => [
          ...current.filter((item) => item.code !== "adapter_write_failed"),
          { field: "$", code: "adapter_write_failed" },
        ]);
      }
    },
    [adapter],
  );

  const resetPreferences = useCallback(async () => {
    const defaults = { ...DEFAULT_DEVICE_PREFERENCES };
    preferencesRef.current = defaults;
    setPreferencesState(defaults);
    const reset = writeQueueRef.current.then(() => adapter.reset());
    writeQueueRef.current = reset.catch(() => undefined);
    try {
      await reset;
      setDiagnostics([]);
    } catch {
      setDiagnostics([{ field: "$", code: "adapter_write_failed" }]);
    }
  }, [adapter]);

  const value = useMemo(
    () => ({
      preferences,
      diagnostics,
      appearance,
      ready,
      setPreferences,
      resetPreferences,
    }),
    [preferences, diagnostics, appearance, ready, setPreferences, resetPreferences],
  );

  return (
    <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>
  );
}
