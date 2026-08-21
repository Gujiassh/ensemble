import { Button, StatusMark } from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";
import type { ConnectionState } from "../workspace/gateway";
import { summarizePath } from "../workspace/draft";

type ContextBarProps = {
  workspaceName: string | null;
  projectPath: string | null;
  connection: ConnectionState;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
};

function connectionTone(
  connection: ConnectionState,
): "active" | "success" | "unavailable" | "danger" | "neutral" {
  switch (connection.status) {
    case "checking":
    case "unknown":
      return "active";
    case "available":
      return "success";
    case "unavailable":
      return "unavailable";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

export function ContextBar({
  workspaceName,
  projectPath,
  connection,
  primaryActionLabel,
  onPrimaryAction,
  primaryDisabled,
}: ContextBarProps) {
  const { t } = useI18n();

  const connectionLabel =
    connection.status === "available"
      ? t("app.connection.connected")
      : connection.status === "checking" || connection.status === "unknown"
        ? t("app.connection.checking")
        : connection.status === "error"
          ? t("common.status.error")
          : t("app.connection.unavailable");

  return (
    <header className="context-bar">
      <div className="context-bar__identity">
        <h1 className="context-bar__title">{workspaceName ?? t("app.context.noWorkspace")}</h1>
        <div className="context-bar__meta">
          <span>{t("app.context.viewCanvas")}</span>
          <span aria-hidden="true"> · </span>
          <span title={projectPath ?? undefined}>
            {projectPath ? summarizePath(projectPath) : t("app.context.directoryUnavailable")}
          </span>
        </div>
      </div>
      <div className="context-bar__actions">
        <StatusMark
          tone={connectionTone(connection)}
          label={`${t("app.context.connectionState")}: ${connectionLabel}`}
          busy={connection.status === "checking"}
        />
        {primaryActionLabel && onPrimaryAction ? (
          <Button variant="primary" onClick={onPrimaryAction} disabled={primaryDisabled}>
            {primaryActionLabel}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
