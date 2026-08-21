import type { ReactNode } from "react";
import { StatusMark, type StatusTone } from "./StatusMark";

export type NoticeTone = "info" | "warning" | "danger" | "unavailable";

type NoticeProps = {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

const TONE_MAP: Record<NoticeTone, StatusTone> = {
  info: "info",
  warning: "waiting",
  danger: "danger",
  unavailable: "unavailable",
};

export function Notice({ tone, title, children, action }: NoticeProps) {
  return (
    <div className={`ds-notice ds-notice--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <div className="ds-notice__header">
        <StatusMark tone={TONE_MAP[tone]} label={title} />
      </div>
      {children ? <div className="ds-notice__body">{children}</div> : null}
      {action ? <div className="ds-notice__action">{action}</div> : null}
    </div>
  );
}
