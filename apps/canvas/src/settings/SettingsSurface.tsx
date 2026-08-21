import { Button, Dialog, SegmentedControl } from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";
import { usePreferences } from "../preferences/usePreferences";
import type {
  ContrastPreference,
  DensityPreference,
  MotionPreference,
  ThemePreference,
} from "../design-system/tokens/types";
import type { UiLocale } from "../preferences/schema";

type SettingsSurfaceProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsSurface({ open, onClose }: SettingsSurfaceProps) {
  const { t } = useI18n();
  const { preferences, setPreferences, resetPreferences } = usePreferences();

  return (
    <Dialog
      open={open}
      title={t("app.settings.title")}
      onClose={onClose}
      closeLabel={t("common.action.close")}
      footer={
        <>
          <Button variant="quiet" onClick={() => void resetPreferences()}>
            {t("app.settings.reset")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("app.settings.close")}
          </Button>
        </>
      }
    >
      <div className="settings-panel">
        <SegmentedControl<ThemePreference>
          label={t("app.settings.theme")}
          value={preferences.theme}
          onValueChange={(theme) => void setPreferences({ theme })}
          options={[
            { value: "light", label: t("theme.light") },
            { value: "dark", label: t("theme.dark") },
            { value: "system", label: t("theme.system") },
          ]}
        />
        <SegmentedControl<DensityPreference>
          label={t("app.settings.density")}
          value={preferences.density}
          onValueChange={(density) => void setPreferences({ density })}
          options={[
            { value: "comfortable", label: t("theme.density.comfortable") },
            { value: "compact", label: t("theme.density.compact") },
          ]}
        />
        <SegmentedControl<MotionPreference>
          label={t("app.settings.motion")}
          value={preferences.motion}
          onValueChange={(motion) => void setPreferences({ motion })}
          options={[
            { value: "full", label: t("theme.motion.full") },
            { value: "reduced", label: t("theme.motion.reduced") },
            { value: "system", label: t("theme.motion.system") },
          ]}
        />
        <SegmentedControl<ContrastPreference>
          label={t("app.settings.contrast")}
          value={preferences.contrast}
          onValueChange={(contrast) => void setPreferences({ contrast })}
          options={[
            { value: "normal", label: t("theme.contrast.normal") },
            { value: "high", label: t("theme.contrast.high") },
            { value: "system", label: t("theme.contrast.system") },
          ]}
        />
        <SegmentedControl<UiLocale>
          label={t("app.settings.uiLocale")}
          value={preferences.uiLocale}
          onValueChange={(uiLocale) => void setPreferences({ uiLocale })}
          options={[
            { value: "zh-CN", label: t("locale.zh-CN") },
            { value: "en-US", label: t("locale.en-US") },
          ]}
        />
      </div>
    </Dialog>
  );
}
