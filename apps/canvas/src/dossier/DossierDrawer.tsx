import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { findNode } from "@ensemble/protocol";
import { fetchArtifact } from "../api/client";
import { useCanvasStore } from "../store/canvasStore";
import { useLiveStore } from "../store/liveStore";

export function DossierDrawer() {
  const selectedSeatId = useCanvasStore((s) => s.selectedSeatId);
  const org = useCanvasStore((s) => s.org);
  const getSeatRuntime = useCanvasStore((s) => s.getSeatRuntime);
  const setPrompt = useCanvasStore((s) => s.setPrompt);
  const selectSeat = useCanvasStore((s) => s.selectSeat);
  const source = useLiveStore((s) => s.source);
  const workspaceId = useLiveStore((s) => s.workspaceId);
  const runId = useLiveStore((s) => s.runId);
  const injectLivePrompt = useLiveStore((s) => s.injectLivePrompt);

  const seat = selectedSeatId ? findNode(org.root, selectedSeatId) : null;
  const rt = selectedSeatId ? getSeatRuntime(selectedSeatId) : null;
  const [tab, setTab] = useState<"now" | "history" | "outputs" | "prompt">(
    "now",
  );
  const [draft, setDraft] = useState("");
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [artifactText, setArtifactText] = useState<string>("");
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [injectBusy, setInjectBusy] = useState(false);

  useEffect(() => {
    if (rt?.prompt != null) setDraft(rt.prompt);
  }, [selectedSeatId, rt?.prompt]);

  useEffect(() => {
    setSelectedOutput(null);
    setArtifactText("");
    setArtifactError(null);
  }, [selectedSeatId]);

  useEffect(() => {
    if (!selectedOutput) return;
    if (source !== "live" || !workspaceId || !runId) {
      setArtifactText(`(mock) ${selectedOutput}`);
      setArtifactError(null);
      return;
    }
    let cancelled = false;
    setArtifactText("");
    setArtifactError(null);
    fetchArtifact(workspaceId, runId, selectedOutput)
      .then((text) => {
        if (!cancelled) setArtifactText(text);
      })
      .catch((e) => {
        if (!cancelled) {
          setArtifactError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOutput, source, workspaceId, runId]);

  if (!selectedSeatId || !seat || seat.kind !== "seat" || !rt) return null;

  const onInject = async () => {
    if (source === "live") {
      setInjectBusy(true);
      try {
        await injectLivePrompt(selectedSeatId, draft, "prompt_replace");
      } finally {
        setInjectBusy(false);
      }
    } else {
      setPrompt(selectedSeatId, draft);
    }
  };

  return (
    <aside className="dossier" aria-label="Seat dossier">
      <header className="dossier-head">
        <div>
          <div className="dossier-title">{seat.name}</div>
          <div className="dossier-sub">
            {seat.role_template ?? "seat"} · {rt.status}
            {seat.runner ? ` · runner=${seat.runner}` : ""}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => selectSeat(null)}
          aria-label="Close dossier"
        >
          <X size={16} />
        </button>
      </header>

      <nav className="dossier-tabs">
        {(["now", "history", "outputs", "prompt"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="dossier-body">
        {tab === "now" ? (
          <div className="stack">
            <Field label="Goal" value={rt.goal ?? seat.goal ?? "—"} />
            <Field
              label="Action"
              value={rt.current_action ?? seat.current_action ?? "—"}
            />
            <Field label="Status" value={rt.status} />
          </div>
        ) : null}
        {tab === "history" ? (
          <ul className="log">
            {rt.history.length === 0 ? (
              <li className="muted">No history yet</li>
            ) : (
              rt.history.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)
            )}
          </ul>
        ) : null}
        {tab === "outputs" ? (
          <div className="stack">
            <ul className="log">
              {rt.outputs.length === 0 ? (
                <li className="muted">No outputs yet</li>
              ) : (
                rt.outputs.map((o) => (
                  <li key={o}>
                    <button
                      type="button"
                      className="mono linkish"
                      onClick={() => setSelectedOutput(o)}
                    >
                      {o}
                    </button>
                  </li>
                ))
              )}
            </ul>
            {selectedOutput ? (
              <pre className="mono artifact-preview" aria-label="Artifact text">
                {artifactError
                  ? `error: ${artifactError}`
                  : artifactText || "Loading…"}
              </pre>
            ) : null}
          </div>
        ) : null}
        {tab === "prompt" ? (
          <div className="stack">
            <textarea
              className="prompt-box"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
            />
            <button
              type="button"
              className="primary"
              disabled={injectBusy}
              onClick={() => void onInject()}
            >
              {source === "live"
                ? injectBusy
                  ? "Injecting…"
                  : "Inject prompt (live)"
                : "Inject prompt (local mock)"}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  );
}
