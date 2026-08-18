import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

export type StatusTone =
  | "neutral"
  | "active"
  | "waiting"
  | "success"
  | "danger"
  | "unavailable"
  | "info";

type StatusMarkProps = {
  tone: StatusTone;
  label: string;
  busy?: boolean;
};

const ICONS: Record<StatusTone, ReactNode> = {
  neutral: <Circle size={14} aria-hidden="true" />,
  active: <LoaderCircle size={14} aria-hidden="true" />,
  waiting: <AlertTriangle size={14} aria-hidden="true" />,
  success: <CheckCircle2 size={14} aria-hidden="true" />,
  danger: <XCircle size={14} aria-hidden="true" />,
  unavailable: <XCircle size={14} aria-hidden="true" />,
  info: <Info size={14} aria-hidden="true" />,
};

export function StatusMark({ tone, label, busy = false }: StatusMarkProps) {
  return (
    <span
      className={`ds-status ds-status--${tone}`}
      data-busy={busy || undefined}
      role="status"
    >
      <span className="ds-status__icon" aria-hidden="true">
        {ICONS[tone]}
      </span>
      <span className="ds-status__label">{label}</span>
    </span>
  );
}
