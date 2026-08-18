import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";
import type { CanvasObject } from "../canvas/types";

export type InspectorSection = {
  id: string;
  titleKey: "inspector.section.overview" | "inspector.section.details";
  body: string;
};

type InspectorShellProps = {
  open: boolean;
  mode: "docked" | "overlay";
  object: CanvasObject | null;
  sections: InspectorSection[];
  onClose: () => void;
  returnFocusTarget?: HTMLElement | null;
};

export function InspectorShell({
  open,
  mode,
  object,
  sections,
  onClose,
  returnFocusTarget,
}: InspectorShellProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      returnFocusTarget?.focus();
    };
  }, [open, onClose, returnFocusTarget]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className={mode === "overlay" ? "inspector is-overlay" : "inspector"}
      aria-label={t("inspector.title")}
    >
      <header className="inspector__header">
        <h2 className="inspector__title">
          {object ? object.label : t("inspector.title")}
        </h2>
        <IconButton
          ref={closeRef}
          label={t("inspector.close")}
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      </header>
      <div className="inspector__body">
        {!object ? (
          <p>{t("inspector.empty")}</p>
        ) : (
          sections.map((section) => (
            <section key={section.id}>
              <h3 className="inspector__section-title">{t(section.titleKey)}</h3>
              <p>{section.body}</p>
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
