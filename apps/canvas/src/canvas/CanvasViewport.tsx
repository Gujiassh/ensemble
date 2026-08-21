import { Button } from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";
import type { CanvasObject, CanvasViewportState } from "./types";

type CanvasViewportProps = {
  state: CanvasViewportState;
  selectedObjectId: string | null;
  onSelectObject: (object: CanvasObject | null, trigger?: HTMLElement) => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
};

export function CanvasViewport({
  state,
  selectedObjectId,
  onSelectObject,
  primaryAction,
}: CanvasViewportProps) {
  const { t } = useI18n();

  if (state.status === "loading") {
    return (
      <section className="canvas-viewport" aria-busy="true" aria-live="polite">
        <div className="canvas-viewport__state">
          <div className="canvas-viewport__state-card">
            <div className="app-boot__indicator" aria-hidden="true" />
            <h2 className="canvas-viewport__title">{t("canvas.loading.title")}</h2>
          </div>
        </div>
      </section>
    );
  }

  if (state.status === "unavailable") {
    return (
      <section className="canvas-viewport" aria-live="polite">
        <div className="canvas-viewport__state">
          <div className="canvas-viewport__state-card">
            <h2 className="canvas-viewport__title">{t("canvas.unavailable.title")}</h2>
            <p className="canvas-viewport__body">{t(state.reasonKey)}</p>
          </div>
        </div>
      </section>
    );
  }

  if (state.status === "empty") {
    return (
      <section className="canvas-viewport" aria-live="polite">
        <div className="canvas-viewport__state">
          <div className="canvas-viewport__state-card">
            <h2 className="canvas-viewport__title">{t("workspace.create.emptyTitle")}</h2>
            {primaryAction ? (
              <Button variant="primary" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="canvas-viewport"
      aria-label={t("app.context.viewCanvas")}
      onClick={() => onSelectObject(null)}
    >
      <div className="canvas-projection">
        {state.projection.objects.length === 0 ? (
          <div className="canvas-viewport__state">
            <div className="canvas-viewport__state-card">
              <h2 className="canvas-viewport__title">{t("canvas.empty.title")}</h2>
              <p className="canvas-viewport__body">{t("canvas.empty.body")}</p>
            </div>
          </div>
        ) : (
          <div role="list" aria-label={t("app.context.viewCanvas")}>
            {state.projection.objects.map((object) => {
              const selected = object.id === selectedObjectId;
              return (
                <div key={object.id} role="listitem" className="canvas-object-slot">
                  <button
                    type="button"
                    className={selected ? "canvas-object is-selected" : "canvas-object"}
                    aria-pressed={selected}
                    aria-label={object.label}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectObject(object, event.currentTarget);
                    }}
                  >
                    <span>{object.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
