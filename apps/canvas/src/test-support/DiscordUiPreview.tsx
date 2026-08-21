import {
  Activity,
  AlertCircle,
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronsLeft,
  CircleHelp,
  FileCode2,
  FileOutput,
  FileText,
  GitCompareArrows,
  GitBranch,
  LayoutDashboard,
  Maximize2,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { usePreferences } from "../preferences/usePreferences";
import type { ThemePreference } from "../design-system/tokens/types";
import { AgentSessionPreview } from "./AgentSessionPreview";
import { OutputInspectionPreview } from "./OutputInspectionPreview";
import "./discord-ui-preview.css";

type PreviewView = "canvas" | "runs" | "attention" | "files" | "artifacts" | "session";
type DetailTab = "overview" | "activity" | "changes" | "artifacts";
type ThemeMode = Extract<ThemePreference, "light" | "dark">;

type PreviewSeat = {
  id: string;
  name: string;
  role: string;
  initials: string;
  tone: "active" | "waiting" | "success" | "neutral";
  activity: string;
  position: { left: string; top: string };
};

const WORKSPACES = [
  { id: "ensemble", label: "Ensemble", initials: "E", tone: "vermillion" },
  { id: "atlas", label: "Atlas", initials: "A", tone: "blue" },
  { id: "studio", label: "Studio", initials: "S", tone: "green" },
] as const;

const SEATS: PreviewSeat[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "Coordinates the workspace",
    initials: "O",
    tone: "active",
    activity: "Routing the next handoff",
    position: { left: "50%", top: "25%" },
  },
  {
    id: "research",
    name: "Research",
    role: "Finds and checks sources",
    initials: "R",
    tone: "success",
    activity: "Source review complete",
    position: { left: "15%", top: "54%" },
  },
  {
    id: "implementation",
    name: "Implementation",
    role: "Owns the active code change",
    initials: "I",
    tone: "active",
    activity: "Editing the client shell",
    position: { left: "50%", top: "54%" },
  },
  {
    id: "review",
    name: "Review",
    role: "Checks the delivery",
    initials: "V",
    tone: "waiting",
    activity: "Waiting for your decision",
    position: { left: "85%", top: "54%" },
  },
];

const NAV_ITEMS: Array<{
  id: PreviewView;
  label: string;
  icon: ReactNode;
  badge?: string;
}> = [
  { id: "canvas", label: "Organization", icon: <LayoutDashboard size={17} /> },
  { id: "runs", label: "Runs", icon: <Activity size={17} />, badge: "3" },
  { id: "attention", label: "Attention", icon: <AlertCircle size={17} />, badge: "1" },
  { id: "files", label: "Files", icon: <FileCode2 size={17} /> },
  { id: "artifacts", label: "Artifacts", icon: <FileOutput size={17} /> },
];

const RUNS = [
  { id: "run-221", title: "Rebuild client foundation", state: "Running", time: "Just now", tone: "active" },
  { id: "run-220", title: "Review interaction spec", state: "Waiting", time: "12 min ago", tone: "waiting" },
  { id: "run-219", title: "Index source inventory", state: "Succeeded", time: "Yesterday", tone: "success" },
];

function ToneMark({ tone }: { tone: PreviewSeat["tone"] | "danger" }) {
  return <span className={`dui-tone dui-tone--${tone}`} aria-hidden="true" />;
}

function Avatar({ initials, tone, small = false }: { initials: string; tone: string; small?: boolean }) {
  return (
    <span className={`dui-avatar dui-avatar--${tone}${small ? " dui-avatar--small" : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}

function WorkspaceRail({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <aside className="dui-workspace-rail" aria-label="Workspaces">
      <div className="dui-rail-stack">
        <button className="dui-brand-mark" type="button" aria-label="Ensemble home" title="Ensemble home">
          E
        </button>
        <span className="dui-rail-divider" aria-hidden="true" />
        {WORKSPACES.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            className={`dui-workspace-mark dui-workspace-mark--${workspace.tone}${active === workspace.id ? " is-active" : ""}`}
            aria-label={workspace.label}
            aria-pressed={active === workspace.id}
            title={workspace.label}
            onClick={() => onSelect(workspace.id)}
          >
            {workspace.initials}
          </button>
        ))}
        <button className="dui-workspace-add" type="button" aria-label="Create workspace" title="Create workspace">
          <Plus size={18} />
        </button>
      </div>
      <div className="dui-rail-stack dui-rail-stack--bottom">
        <button className="dui-rail-icon" type="button" aria-label="Help" title="Help">
          <CircleHelp size={18} />
        </button>
        <button className="dui-user-mark" type="button" aria-label="Profile" title="Profile">
          <Avatar initials="G" tone="vermillion" small />
          <span className="dui-online-dot" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function WorkspaceSidebar({
  workspace,
  view,
  sidebarOpen,
  onView,
  selectedSeatId,
  onSeat,
  onClose,
}: {
  workspace: (typeof WORKSPACES)[number];
  view: PreviewView;
  sidebarOpen: boolean;
  onView: (view: PreviewView) => void;
  selectedSeatId: string;
  onSeat: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className={`dui-sidebar${sidebarOpen ? " is-open" : ""}`} aria-label="Workspace navigation">
      <header className="dui-sidebar-header">
        <button className="dui-workspace-switcher" type="button" aria-label="Switch workspace">
          <span>
            <strong>{workspace.label}</strong>
            <small>Workspace</small>
          </span>
          <ChevronDown size={16} />
        </button>
        <button className="dui-sidebar-close" type="button" aria-label="Close navigation" onClick={onClose}>
          <ChevronsLeft size={17} />
        </button>
      </header>
      <div className="dui-sidebar-content">
        <button className="dui-search-button" type="button">
          <Search size={15} />
          <span>Find anything</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="dui-sidebar-section">
          <div className="dui-section-label"><span>Workspace</span><button type="button" aria-label="Add workspace view" title="Add workspace view"><Plus size={14} /></button></div>
          <nav className="dui-nav-list" aria-label="Workspace views">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`dui-nav-item${view === item.id ? " is-active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => onView(item.id)}
              >
                <span className="dui-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge ? <span className={`dui-nav-badge${item.id === "attention" ? " is-attention" : ""}`}>{item.badge}</span> : null}
              </button>
            ))}
          </nav>
        </div>
        <div className="dui-sidebar-section">
          <div className="dui-section-label"><span>Active Seats</span><button type="button" aria-label="Add Seat" title="Add Seat"><Plus size={14} /></button></div>
          <div className="dui-channel-list">
            {SEATS.map((seat) => <button key={seat.id} className={`dui-channel-item${view === "session" && selectedSeatId === seat.id ? " is-current" : ""}`} type="button" onClick={() => onSeat(seat.id)}><Avatar initials={seat.initials} tone={seat.tone} small /><span>{seat.name}</span>{seat.id === "review" ? <span className="dui-channel-count">1</span> : <ToneMark tone={seat.tone} />}</button>)}
          </div>
        </div>
        <div className="dui-sidebar-section dui-sidebar-section--status">
          <div className="dui-section-label"><span>Runtime</span><MoreHorizontal size={14} /></div>
          <div className="dui-runtime-status"><span className="dui-runtime-dot" /><span>Local runtime</span><small>Connected</small></div>
        </div>
      </div>
      <footer className="dui-sidebar-footer">
        <div className="dui-profile-row"><Avatar initials="G" tone="vermillion" small /><span><strong>gujishh</strong><small>Online</small></span><button type="button" aria-label="User settings" title="User settings"><Settings size={15} /></button></div>
      </footer>
    </aside>
  );
}

function TopBar({
  title,
  theme,
  onToggleTheme,
  onToggleSidebar,
  inspectorAvailable,
  inspectorOpen,
  onToggleInspector,
}: {
  title: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  inspectorAvailable: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  return (
    <header className="dui-topbar">
      <div className="dui-topbar-title"><Users size={18} /><strong>{title}</strong><span className="dui-topbar-divider" /><span className="dui-topbar-subtitle">Live workspace</span></div>
      <div className="dui-topbar-actions">
        <button className="dui-topbar-action dui-topbar-search" type="button" aria-label="Search" title="Search"><Search size={16} /><span>Search</span><kbd>⌘ K</kbd></button>
        <button className="dui-topbar-action" type="button" aria-label="Notifications" title="Notifications"><Bell size={17} /><span className="dui-notification-dot" /></button>
        <button className="dui-topbar-action" type="button" aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} onClick={onToggleTheme}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button className="dui-topbar-action dui-mobile-nav" type="button" aria-label="Toggle navigation" title="Toggle navigation" onClick={onToggleSidebar}><PanelRightOpen size={17} /></button>
        {inspectorAvailable ? <button className={`dui-topbar-action${inspectorOpen ? " is-active" : ""}`} type="button" aria-label="Toggle details" title="Toggle details" onClick={onToggleInspector}>{inspectorOpen ? <PanelRightClose size={17} /> : <Users size={17} />}</button> : null}
      </div>
    </header>
  );
}

function CanvasView({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="dui-main-body dui-canvas-view">
      <div className="dui-view-toolbar">
        <div><span className="dui-live-indicator"><span />Live</span><span className="dui-toolbar-note">Updated a moment ago</span></div>
        <div className="dui-view-actions"><button type="button" aria-label="Fit organization" title="Fit organization"><Maximize2 size={15} /></button><button type="button" aria-label="More canvas actions" title="More canvas actions"><MoreHorizontal size={16} /></button></div>
      </div>
      <div className="dui-canvas-stage">
        <div className="dui-canvas-caption"><span className="dui-caption-kicker">ORGANIZATION MAP</span><h2>Coordination</h2><p>Four Seats are moving work through the active run.</p></div>
        <svg className="dui-connections" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
          <path className="dui-connection" d="M500 176 C500 260 150 278 150 365" />
          <path className="dui-connection dui-connection--active" d="M500 176 C500 260 500 278 500 365" />
          <path className="dui-connection" d="M500 176 C500 260 850 278 850 365" />
          <path className="dui-connection dui-connection--active" d="M500 365 C575 418 675 430 850 365" />
        </svg>
        {SEATS.map((seat) => (
          <button
            key={seat.id}
            type="button"
            className={`dui-seat dui-seat--${seat.id}${selected === seat.id ? " is-selected" : ""}`}
            style={{ "--seat-left": seat.position.left, "--seat-top": seat.position.top } as CSSProperties}
            aria-pressed={selected === seat.id}
            onClick={() => onSelect(seat.id)}
          >
            <Avatar initials={seat.initials} tone={seat.tone} />
            <span className="dui-seat-copy"><strong>{seat.name}</strong><small>{seat.role}</small><em><ToneMark tone={seat.tone} />{seat.activity}</em></span>
            <span className="dui-seat-menu" aria-hidden="true"><MoreHorizontal size={15} /></span>
          </button>
        ))}
        <div className="dui-pulse dui-pulse--one" aria-hidden="true" />
        <div className="dui-pulse dui-pulse--two" aria-hidden="true" />
        <div className="dui-canvas-footer"><span><GitBranch size={14} /> main</span><span><Bot size={14} /> pi runner</span><span><Users size={14} /> 4 Seats</span></div>
      </div>
    </div>
  );
}

function RunsView() {
  return (
    <div className="dui-main-body dui-list-view">
      <div className="dui-list-intro"><div><span className="dui-caption-kicker">RUN HISTORY</span><h2>Runs</h2><p>Execution snapshots stay in the workspace context.</p></div><button className="dui-primary-action" type="button"><Play size={15} /> Start a run</button></div>
      <div className="dui-data-list" role="list">
        {RUNS.map((run) => <button type="button" className="dui-data-row" key={run.id} role="listitem"><span className="dui-row-icon"><Activity size={16} /></span><span className="dui-row-main"><strong>{run.title}</strong><small>{run.id} · {run.time}</small></span><span className="dui-row-state"><ToneMark tone={run.tone as PreviewSeat["tone"]} />{run.state}</span><MoreHorizontal size={16} /></button>)}
      </div>
    </div>
  );
}

function AttentionView({ onOpenEvidence }: { onOpenEvidence: () => void }) {
  return (
    <div className="dui-main-body dui-list-view">
      <div className="dui-list-intro"><div><span className="dui-caption-kicker">REQUIRES YOUR INPUT</span><h2>Attention</h2><p>Decisions and exceptions are collected here.</p></div><span className="dui-attention-count">1 open</span></div>
      <div className="dui-data-list" role="list"><button className="dui-data-row dui-data-row--attention" type="button" role="listitem" onClick={onOpenEvidence}><span className="dui-row-icon"><AlertCircle size={16} /></span><span className="dui-row-main"><strong>Review is waiting for a decision</strong><small>Review · 2 minutes ago · Implementation handoff</small></span><span className="dui-row-state"><ToneMark tone="danger" />Open evidence</span><ChevronDown size={16} /></button></div>
      <div className="dui-empty-note"><Check size={17} /> Everything else is moving normally.</div>
    </div>
  );
}

function DetailsPanel({
  selected,
  tab,
  onTab,
  onOpenChanges,
  onOpenArtifacts,
  onOpenSession,
  onClose,
}: {
  selected: PreviewSeat | undefined;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onOpenChanges: () => void;
  onOpenArtifacts: () => void;
  onOpenSession: () => void;
  onClose: () => void;
}) {
  if (!selected) {
    return <aside className="dui-details"><div className="dui-details-empty"><Users size={22} /><strong>Select a Seat</strong><p>Choose an object on the canvas to inspect its current work.</p></div></aside>;
  }
  return (
    <aside className="dui-details" aria-label="Seat details">
      <header className="dui-details-header"><span>Seat details</span><button type="button" aria-label="Close details" title="Close details" onClick={onClose}><X size={16} /></button></header>
      <nav className="dui-detail-tabs" aria-label="Seat detail sections">
        {(["overview", "activity", "changes", "artifacts"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "is-active" : ""} onClick={() => onTab(item)}>{item}</button>
        ))}
      </nav>
      <div className="dui-details-content">
        <div className="dui-profile-heading"><Avatar initials={selected.initials} tone={selected.tone} /><div><h2>{selected.name}</h2><p>{selected.role}</p><span className="dui-status-line"><ToneMark tone={selected.tone} />{selected.tone === "waiting" ? "Waiting for attention" : "Active now"}</span></div></div>
        {tab === "overview" ? <>
          <div className="dui-detail-section"><div className="dui-detail-label">Current activity</div><p className="dui-detail-callout">{selected.activity}</p></div>
          <div className="dui-detail-section"><div className="dui-detail-label">Workspace permissions</div><div className="dui-permission-row"><span><Bot size={15} /> Agent seat</span><small>Can execute</small></div><div className="dui-permission-row"><span><MessageSquareText size={15} /> Output</span><small>English</small></div></div>
        </> : null}
        {tab === "activity" ? <div className="dui-detail-section"><div className="dui-detail-label">Recent activity</div><div className="dui-activity-row"><ToneMark tone="active" /><span><strong>Started implementation shell</strong><small>command · 4 minutes ago</small></span></div><div className="dui-activity-row"><ToneMark tone="success" /><span><strong>Delivered implementation brief</strong><small>artifact · 4 minutes ago</small></span></div><div className="dui-activity-row"><ToneMark tone="active" /><span><strong>Received Task context</strong><small>handoff · 9 minutes ago</small></span></div></div> : null}
        {tab === "changes" ? <div className="dui-detail-section"><div className="dui-detail-label">Observed changes</div><button className="dui-detail-link" type="button" onClick={onOpenChanges}><GitCompareArrows size={15} /><span><strong>4 files changed</strong><small>+546 additions · -26 deletions</small></span><ChevronDown size={14} /></button><p className="dui-detail-note">Baseline: Run start, including existing workspace changes.</p></div> : null}
        {tab === "artifacts" ? <div className="dui-detail-section"><div className="dui-detail-label">Delivered artifacts</div><button className="dui-detail-link" type="button" onClick={onOpenArtifacts}><FileOutput size={15} /><span><strong>F1-A implementation review</strong><small>Markdown · valid · v1</small></span><ChevronDown size={14} /></button><button className="dui-detail-link" type="button" onClick={onOpenArtifacts}><FileText size={15} /><span><strong>Canvas verification report</strong><small>Test report · valid · v3</small></span><ChevronDown size={14} /></button></div> : null}
        {tab !== "overview" ? <div className="dui-detail-section"><div className="dui-detail-label">Recent handoffs</div><div className="dui-handoff-row"><span className="dui-handoff-avatar">{selected.initials}</span><span><strong>Implementation brief</strong><small>Delivered to Review · 4 min ago</small></span><Check size={15} /></div><div className="dui-handoff-row"><span className="dui-handoff-avatar dui-handoff-avatar--muted">O</span><span><strong>Task context</strong><small>Received from Orchestrator · 9 min ago</small></span><Check size={15} /></div></div> : null}
      </div>
      <footer className="dui-details-footer"><button className="dui-quiet-action" type="button" onClick={onOpenSession}><MessageSquareText size={15} /> Open session</button><button className="dui-icon-action" type="button" aria-label="More seat actions" title="More seat actions"><MoreHorizontal size={16} /></button></footer>
    </aside>
  );
}

export function DiscordUiPreview() {
  const { preferences, setPreferences } = usePreferences();
  const [activeWorkspace, setActiveWorkspace] = useState("ensemble");
  const [view, setView] = useState<PreviewView>("canvas");
  const [selectedSeatId, setSelectedSeatId] = useState("implementation");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [fileSourceSeat, setFileSourceSeat] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1200,
  );
  const theme: ThemeMode = preferences.theme === "dark" ? "dark" : "light";
  const workspace = WORKSPACES.find((item) => item.id === activeWorkspace) ?? WORKSPACES[0];
  const selectedSeat = SEATS.find((seat) => seat.id === selectedSeatId);
  const title = view === "canvas" ? "Organization" : `${view[0].toUpperCase()}${view.slice(1)}`;

  async function toggleTheme() {
    await setPreferences({ theme: theme === "light" ? "dark" : "light" });
  }

  function openChanges() {
    setFileSourceSeat(selectedSeat?.name);
    setView("files");
    setInspectorOpen(false);
  }

  function openArtifacts() {
    setView("artifacts");
    setInspectorOpen(false);
  }

  function openSession(id = selectedSeatId) {
    setSelectedSeatId(id);
    setView("session");
    setInspectorOpen(false);
  }

  function navigate(next: PreviewView) {
    if (next === "files") {
      setFileSourceSeat(undefined);
    }
    setView(next);
  }

  function openAttentionEvidence() {
    setFileSourceSeat("Implementation");
    setView("files");
  }

  return (
    <div className={`dui-preview dui-preview--${theme}${view === "canvas" && inspectorOpen ? " has-details" : ""}`}>
      <WorkspaceRail active={activeWorkspace} onSelect={setActiveWorkspace} />
      <WorkspaceSidebar workspace={workspace} view={view} sidebarOpen={sidebarOpen} onView={navigate} selectedSeatId={selectedSeatId} onSeat={openSession} onClose={() => setSidebarOpen(false)} />
      <main className="dui-content">
        <TopBar title={title} theme={theme} onToggleTheme={toggleTheme} onToggleSidebar={() => setSidebarOpen((value) => !value)} inspectorAvailable={view === "canvas"} inspectorOpen={inspectorOpen} onToggleInspector={() => setInspectorOpen((value) => !value)} />
        {view === "canvas" ? <CanvasView selected={selectedSeatId} onSelect={openSession} /> : null}
        {view === "runs" ? <RunsView /> : null}
        {view === "attention" ? <AttentionView onOpenEvidence={openAttentionEvidence} /> : null}
        {view === "files" ? <OutputInspectionPreview surface="files" sourceSeat={fileSourceSeat} /> : null}
        {view === "artifacts" ? <OutputInspectionPreview surface="artifacts" /> : null}
        {view === "session" && selectedSeat ? <AgentSessionPreview seat={selectedSeat} onOpenChanges={openChanges} onOpenArtifacts={openArtifacts} /> : null}
      </main>
      {view === "canvas" && inspectorOpen ? <DetailsPanel selected={selectedSeat} tab={detailTab} onTab={setDetailTab} onOpenChanges={openChanges} onOpenArtifacts={openArtifacts} onOpenSession={() => openSession()} onClose={() => setInspectorOpen(false)} /> : null}
    </div>
  );
}
