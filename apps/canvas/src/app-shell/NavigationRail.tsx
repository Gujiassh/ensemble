import {
  AlertCircle,
  FolderKanban,
  PanelLeft,
  PlayCircle,
  Settings,
} from "lucide-react";
import { IconButton } from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";

export type ShellDestination = "workspaces" | "runs" | "attention" | "settings";

type NavigationRailProps = {
  expanded: boolean;
  onToggleExpanded: () => void;
  active: ShellDestination;
  onNavigate: (destination: ShellDestination) => void;
  attentionCount: number;
  workspaceLabel: string;
};

export function NavigationRail({
  expanded,
  onToggleExpanded,
  active,
  onNavigate,
  attentionCount,
  workspaceLabel,
}: NavigationRailProps) {
  const { t } = useI18n();

  const items: Array<{
    id: ShellDestination;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "workspaces",
      label: t("app.navigation.workspaces"),
      icon: <FolderKanban size={18} aria-hidden="true" />,
    },
    {
      id: "runs",
      label: t("app.navigation.runs"),
      icon: <PlayCircle size={18} aria-hidden="true" />,
    },
    {
      id: "attention",
      label: t("app.navigation.attention"),
      icon: <AlertCircle size={18} aria-hidden="true" />,
    },
    {
      id: "settings",
      label: t("app.navigation.settings"),
      icon: <Settings size={18} aria-hidden="true" />,
    },
  ];

  return (
    <nav
      className={expanded ? "nav-rail is-expanded" : "nav-rail"}
      aria-label={t("app.navigation.workspaces")}
    >
      <div className="nav-rail__brand" title={workspaceLabel}>
        <span aria-hidden="true">E</span>
        {expanded ? <span className="nav-rail__label">{workspaceLabel}</span> : null}
      </div>
      <div className="nav-rail__items">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? "nav-rail__item is-active" : "nav-rail__item"}
            aria-label={item.label}
            title={item.label}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span className="nav-rail__label">{item.label}</span>
            {item.id === "attention" && attentionCount > 0 ? (
              <span className="nav-rail__badge" aria-label={String(attentionCount)}>
                {attentionCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <IconButton
        label={expanded ? t("app.navigation.collapse") : t("app.navigation.expand")}
        onClick={onToggleExpanded}
      >
        <PanelLeft size={18} aria-hidden="true" />
      </IconButton>
    </nav>
  );
}
