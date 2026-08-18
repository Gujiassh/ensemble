import { useState } from "react";
import { Button, Dialog, Notice } from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";

type StartupErrorSurfaceProps = {
  onRetry: () => Promise<void>;
  onOpenDiagnostics?: () => Promise<void>;
  onQuit?: () => Promise<void>;
};

export function StartupErrorSurface({
  onRetry,
  onOpenDiagnostics,
  onQuit,
}: StartupErrorSurfaceProps) {
  const { t } = useI18n();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  async function handleOpenDiagnostics() {
    if (!onOpenDiagnostics) {
      setDiagnosticsOpen(true);
      return;
    }
    try {
      await onOpenDiagnostics();
    } catch {
      setDiagnosticsOpen(true);
    }
  }

  return (
    <>
      <div className="startup-error">
        <div className="startup-error__panel">
          <Notice tone="unavailable" title={t("app.connection.unavailable")}>
            {t("app.connection.unavailableDetail")}
          </Notice>
          <div className="startup-error__actions">
            <Button variant="primary" onClick={() => void onRetry()}>
              {t("app.connection.retry")}
            </Button>
            <Button variant="secondary" onClick={() => void handleOpenDiagnostics()}>
              {t("app.connection.diagnostics")}
            </Button>
            {onQuit ? (
              <Button variant="quiet" onClick={() => void onQuit()}>
                {t("app.connection.quit")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog
        open={diagnosticsOpen}
        title={t("app.diagnostics.title")}
        closeLabel={t("common.action.close")}
        onClose={() => setDiagnosticsOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setDiagnosticsOpen(false)}>
            {t("common.action.close")}
          </Button>
        }
      >
        <Notice tone="unavailable" title={t("app.connection.unavailable")}>
          {t("app.diagnostics.connectionUnavailable")}
        </Notice>
      </Dialog>
    </>
  );
}
