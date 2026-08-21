import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter((node) => !node.hasAttribute("disabled"));
}

export function Dialog({
  open,
  title,
  closeLabel,
  onClose,
  children,
  footer,
  initialFocusRef,
  returnFocusRef,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current =
      returnFocusRef?.current ?? (document.activeElement as HTMLElement | null);

    const panel = panelRef.current;
    const focusTarget = initialFocusRef?.current ?? getFocusable(panel ?? document.body)[0];
    focusTarget?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open, initialFocusRef, returnFocusRef]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) {
      return;
    }
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="ds-dialog-root" role="presentation" onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="ds-dialog__backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="ds-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ds-dialog__header">
          <h2 id={titleId} className="ds-dialog__title">
            {title}
          </h2>
        </header>
        <div className="ds-dialog__body">{children}</div>
        {footer ? <footer className="ds-dialog__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
