import type { CanvasMode, FixtureId } from "@ensemble/protocol";
import { Play, Square, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCanvasStore } from "../store/canvasStore";
import { useLiveStore } from "../store/liveStore";

const FIXTURE_OPTIONS: { id: FixtureId; label: string }[] = [
  { id: "single_agent", label: "Single agent" },
  { id: "four_crew", label: "Four crew" },
  { id: "nested", label: "Nested" },
  { id: "deep", label: "Deep nest" },
];

const MODES: CanvasMode[] = ["stage", "work", "debug"];

export function TopBar() {
  const fixtureId = useCanvasStore((s) => s.fixtureId);
  const mode = useCanvasStore((s) => s.mode);
  const runName = useCanvasStore((s) => s.runName);
  const playing = useCanvasStore((s) => s.playing);
  const lastPacketLabels = useCanvasStore((s) => s.lastPacketLabels);
  const loadFixture = useCanvasStore((s) => s.loadFixture);
  const setMode = useCanvasStore((s) => s.setMode);
  const playHandoff = useCanvasStore((s) => s.playHandoff);
  const stopPlayback = useCanvasStore((s) => s.stopPlayback);
  const advancePlaybackTick = useCanvasStore((s) => s.advancePlaybackTick);
  const focusRootId = useCanvasStore((s) => s.focusRootId);
  const focusUp = useCanvasStore((s) => s.focusUp);
  const setReducedMotion = useCanvasStore((s) => s.setReducedMotion);
  const reducedMotion = useCanvasStore((s) => s.reducedMotion);
  const playStep = useCanvasStore((s) => s.playStep);
  const org = useCanvasStore((s) => s.org);
  const lod = useCanvasStore((s) => s.lod);

  const source = useLiveStore((s) => s.source);
  const workspaces = useLiveStore((s) => s.workspaces);
  const workspaceId = useLiveStore((s) => s.workspaceId);
  const groupFilter = useLiveStore((s) => s.groupFilter);
  const error = useLiveStore((s) => s.error);
  const bootstrapLive = useLiveStore((s) => s.bootstrapLive);
  const selectWorkspace = useLiveStore((s) => s.selectWorkspace);
  const setGroupFilter = useLiveStore((s) => s.setGroupFilter);
  const startLiveRun = useLiveStore((s) => s.startLiveRun);
  const switchToMock = useLiveStore((s) => s.switchToMock);

  const groups = useMemo(() => {
    const root = org.root;
    const kids = root.children ?? [];
    return kids.filter((c) => c.kind === "group");
  }, [org]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setReducedMotion]);

  useEffect(() => {
    if (source === "live") return; // SSE drives live mode
    if (!playing) return;
    const ms = reducedMotion ? 80 : mode === "work" ? 900 : 650;
    const timer = window.setTimeout(() => advancePlaybackTick(), ms);
    return () => window.clearTimeout(timer);
  }, [playing, playStep, mode, reducedMotion, advancePlaybackTick, source]);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">Ensemble</span>
        <span className="brand-sub">
          Living Org Canvas · {source === "live" ? "live" : "mock"} · LOD {lod.tier}
        </span>
      </div>

      <div className="topbar-center">
        <label className="field-inline">
          Source
          <select
            value={source}
            onChange={(e) => {
              if (e.target.value === "live") void bootstrapLive();
              else switchToMock();
            }}
          >
            <option value="mock">Mock fixtures</option>
            <option value="live">Live runtime</option>
          </select>
        </label>

        {source === "live" ? (
          <label className="field-inline">
            Workspace
            <select
              value={workspaceId ?? ""}
              onChange={(e) => void selectWorkspace(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field-inline">
            Fixture
            <select
              value={fixtureId}
              onChange={(e) => loadFixture(e.target.value as FixtureId)}
            >
              {FIXTURE_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {groups.length >= 2 ? (
          <label className="field-inline">
            Group
            <select
              value={groupFilter}
              onChange={(e) =>
                setGroupFilter(e.target.value as string | "all")
              }
            >
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field-inline">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CanvasMode)}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <div className="run-chip" title="Run name">
          {runName}
        </div>

        {focusRootId ? (
          <button type="button" onClick={focusUp}>
            ← Up from {focusRootId}
          </button>
        ) : null}

        {error ? <span className="live-error">{error}</span> : null}
      </div>

      <div className="topbar-right">
        {source === "live" ? (
          <span className="live-pill" title="SSE">
            <Wifi size={14} /> live
          </span>
        ) : (
          <span className="live-pill muted">
            <WifiOff size={14} /> mock
          </span>
        )}
        {lastPacketLabels.length > 0 ? (
          <div className="label-chain" title="Handoff label order">
            {lastPacketLabels.join(" → ")}
          </div>
        ) : null}
        {source === "live" ? (
          <button
            type="button"
            className="primary"
            onClick={() =>
              void startLiveRun(
                workspaceId === "ws_beta" ? "single_agent" : "four_crew",
              )
            }
          >
            <Play size={14} /> Start run
          </button>
        ) : playing ? (
          <button type="button" onClick={stopPlayback}>
            <Square size={14} /> Stop
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={playHandoff}
            title="Play four-crew handoff brief→research→patch→review"
          >
            <Play size={14} /> Play handoff
          </button>
        )}
      </div>
    </header>
  );
}
