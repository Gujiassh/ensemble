import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  GitCompareArrows,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Rows3,
  Search,
} from "lucide-react";
import { useState } from "react";
import "./output-inspection-preview.css";

export type OutputSurface = "files" | "artifacts";

type OutputInspectionPreviewProps = {
  surface: OutputSurface;
  sourceSeat?: string;
};

type DiffMode = "unified" | "split";

const FILES = [
  { path: "apps", kind: "folder", depth: 0 },
  { path: "canvas", kind: "folder-open", depth: 1 },
  { path: "src", kind: "folder-open", depth: 2 },
  { path: "app-shell/AppShell.tsx", kind: "file", depth: 3, status: "M", add: 24, del: 8 },
  { path: "test-support/DiscordUiPreview.tsx", kind: "file", depth: 3, status: "M", add: 146, del: 18 },
  { path: "test-support/output-inspection-preview.css", kind: "file", depth: 3, status: "A", add: 212, del: 0 },
  { path: "docs", kind: "folder-open", depth: 0 },
  { path: "specs/workspace-output-inspection.md", kind: "file", depth: 1, status: "A", add: 164, del: 0 },
] as const;

const ARTIFACTS = [
  { id: "review", name: "F1-A implementation review", type: "Markdown", source: "Review", version: "v1", contract: "implementation_review", attempt: "attempt-03" },
  { id: "tests", name: "Canvas verification report", type: "Test report", source: "Implementation", version: "v3", contract: "verification_report", attempt: "attempt-02" },
  { id: "probe", name: "runner-probe.json", type: "JSON", source: "Orchestrator", version: "v1", contract: "runner_diagnostic", attempt: "attempt-01" },
] as const;

const UNIFIED_LINES = [
  { old: "18", next: "18", kind: "context", code: "  const [selectedSeatId, setSelectedSeatId] = useState(\"implementation\");" },
  { old: "19", next: "", kind: "remove", code: "- const [view, setView] = useState<PreviewView>(\"canvas\");" },
  { old: "", next: "19", kind: "add", code: "+ const [view, setView] = useState<PreviewView>(\"canvas\");" },
  { old: "", next: "20", kind: "add", code: "+ const [detailTab, setDetailTab] = useState<DetailTab>(\"overview\");" },
  { old: "20", next: "21", kind: "context", code: "  const [sidebarOpen, setSidebarOpen] = useState(true);" },
  { old: "21", next: "22", kind: "context", code: "  const [inspectorOpen, setInspectorOpen] = useState(true);" },
  { old: "", next: "23", kind: "add", code: "+ const sourceSeat = selectedSeat?.name;" },
] as const;

function FileIcon({ kind }: { kind: (typeof FILES)[number]["kind"] }) {
  if (kind === "folder" || kind === "folder-open") {
    return kind === "folder-open" ? <FolderOpen size={14} /> : <Folder size={14} />;
  }
  return <FileCode2 size={14} />;
}

function FilesTree({ selected, onSelect }: { selected: string; onSelect: (path: string) => void }) {
  return (
    <div className="dui-output-browser">
      <div className="dui-output-browser__header">
        <span>Project files</span>
        <div>
          <button type="button" aria-label="Refresh files" title="Refresh files"><RefreshCw size={13} /></button>
          <button type="button" aria-label="More file actions" title="More file actions"><MoreHorizontal size={14} /></button>
        </div>
      </div>
      <label className="dui-output-search">
        <Search size={13} />
        <input aria-label="Filter files" placeholder="Filter files" />
      </label>
      <div className="dui-change-summary"><span>Run changes</span><strong>4 files</strong><em>+546 -26</em></div>
      <div className="dui-file-tree" role="tree" aria-label="Workspace files">
        {FILES.map((file) => (
          <button
            key={`${file.depth}-${file.path}`}
            type="button"
            role="treeitem"
            aria-selected={file.kind === "file" ? selected === file.path : undefined}
            className={`dui-file-row${file.kind === "file" && selected === file.path ? " is-selected" : ""}`}
            style={{ paddingInlineStart: `${10 + file.depth * 15}px` }}
            onClick={() => file.kind === "file" && onSelect(file.path)}
          >
            {file.kind === "folder" || file.kind === "folder-open" ? <ChevronDown size={12} /> : <span className="dui-tree-spacer" />}
            <FileIcon kind={file.kind} />
            <span className="dui-file-name">{file.path}</span>
            {"status" in file ? <span className={`dui-file-status dui-file-status--${file.status.toLowerCase()}`}>{file.status}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function UnifiedDiff() {
  return (
    <div className="dui-diff-code" role="table" aria-label="Unified diff">
      <div className="dui-diff-hunk">@@ -18,4 +18,6 @@ export function DiscordUiPreview()</div>
      {UNIFIED_LINES.map((line, index) => (
        <div className={`dui-diff-line dui-diff-line--${line.kind}`} role="row" key={`${line.old}-${line.next}-${index}`}>
          <span className="dui-line-number">{line.old}</span>
          <span className="dui-line-number">{line.next}</span>
          <code>{line.code}</code>
        </div>
      ))}
    </div>
  );
}

function SplitDiff() {
  return (
    <div className="dui-split-diff">
      <section aria-label="Baseline content">
        <header>Run start</header>
        <div className="dui-split-line"><span>18</span><code>const [selectedSeatId, setSelectedSeatId] =</code></div>
        <div className="dui-split-line is-remove"><span>19</span><code>const [view, setView] = useState(...);</code></div>
        <div className="dui-split-line"><span>20</span><code>const [sidebarOpen, setSidebarOpen] =</code></div>
      </section>
      <section aria-label="Current content">
        <header>Current workspace</header>
        <div className="dui-split-line"><span>18</span><code>const [selectedSeatId, setSelectedSeatId] =</code></div>
        <div className="dui-split-line is-add"><span>19</span><code>const [view, setView] = useState(...);</code></div>
        <div className="dui-split-line is-add"><span>20</span><code>const [detailTab, setDetailTab] = useState(...);</code></div>
      </section>
    </div>
  );
}

function DiffViewer({ selectedPath, sourceSeat }: { selectedPath: string; sourceSeat?: string }) {
  const [mode, setMode] = useState<DiffMode>("unified");
  return (
    <div className="dui-output-viewer">
      <div className="dui-output-meta">
        <div className="dui-output-path"><FileCode2 size={15} /><span>{selectedPath}</span><strong>Modified</strong></div>
        <div className="dui-output-tools">
          <span className="dui-diff-stat is-add">+146</span><span className="dui-diff-stat is-remove">-18</span>
          <div className="dui-mode-switch" aria-label="Diff layout">
            <button type="button" className={mode === "unified" ? "is-active" : ""} aria-label="Unified diff" title="Unified diff" onClick={() => setMode("unified")}><Rows3 size={14} /></button>
            <button type="button" className={mode === "split" ? "is-active" : ""} aria-label="Split diff" title="Split diff" onClick={() => setMode("split")}><Columns2 size={14} /></button>
          </div>
          <button type="button" className="dui-output-icon" aria-label="Copy path" title="Copy path"><Copy size={14} /></button>
        </div>
      </div>
      <div className="dui-baseline-bar">
        <GitCompareArrows size={14} />
        <span><strong>Baseline</strong> Run start · 28ad28f + existing workspace changes</span>
        <ChevronRight size={13} />
        <span><strong>Target</strong> Current workspace</span>
        {sourceSeat ? <em>Observed from {sourceSeat}</em> : null}
      </div>
      <div className="dui-diff-scroll">{mode === "unified" ? <UnifiedDiff /> : <SplitDiff />}</div>
    </div>
  );
}

function ArtifactBrowser({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="dui-output-browser">
      <div className="dui-output-browser__header"><span>Artifacts</span><button type="button" aria-label="More artifact actions" title="More artifact actions"><MoreHorizontal size={14} /></button></div>
      <label className="dui-output-search"><Search size={13} /><input aria-label="Filter artifacts" placeholder="Filter artifacts" /></label>
      <div className="dui-artifact-list">
        {ARTIFACTS.map((artifact) => (
          <button key={artifact.id} type="button" className={`dui-artifact-row${selected === artifact.id ? " is-selected" : ""}`} onClick={() => onSelect(artifact.id)}>
            <span className="dui-row-icon">{artifact.type === "JSON" ? <FileJson size={15} /> : <FileText size={15} />}</span>
            <span><strong>{artifact.name}</strong><small>{artifact.type} · {artifact.version}</small></span>
            <Check size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ArtifactViewer({ artifactId }: { artifactId: string }) {
  const artifact = ARTIFACTS.find((item) => item.id === artifactId) ?? ARTIFACTS[0];
  return (
    <div className="dui-output-viewer">
      <div className="dui-output-meta">
        <div className="dui-output-path"><FileText size={15} /><span>{artifact.name}</span><strong>Valid</strong></div>
        <div className="dui-output-tools"><button className="dui-output-icon" type="button" aria-label="View source" title="View source"><Braces size={14} /></button><button className="dui-output-icon" type="button" aria-label="Expand preview" title="Expand preview"><Maximize2 size={14} /></button></div>
      </div>
      <div className="dui-artifact-meta"><span>Contract <strong>{artifact.contract}</strong></span><span>Producer <strong>{artifact.source}</strong></span><span>Attempt <strong>{artifact.attempt}</strong></span><span>Version <strong>{artifact.version}</strong></span></div>
      {artifact.id === "review" ? <article className="dui-document-preview">
        <span className="dui-document-kicker">IMPLEMENTATION REVIEW</span>
        <h1>{artifact.name}</h1>
        <p className="dui-document-lead">The client foundation meets the accepted interaction and accessibility baseline.</p>
        <h2>Result</h2>
        <div className="dui-review-result"><Check size={16} /><span><strong>Accepted</strong><small>39 tests passed · no unresolved findings</small></span></div>
        <h2>Evidence</h2>
        <ul><li>Workspace creation preserves the draft after failure.</li><li>Inspector behavior is stable at 1024, 1280, and 1440.</li><li>Production entry excludes test gateway and visual harness code.</li></ul>
        <h2>Delivery</h2>
        <pre><code>28ad28f feat: rebuild the F1 client foundation</code></pre>
      </article> : null}
      {artifact.id === "tests" ? <article className="dui-document-preview">
        <span className="dui-document-kicker">VERIFICATION REPORT</span>
        <h1>Canvas verification report</h1>
        <p className="dui-document-lead">Generated by Implementation for attempt-02.</p>
        <div className="dui-test-summary"><strong>39</strong><span>passed</span><strong>0</strong><span>failed</span><strong>1.67s</strong><span>duration</span></div>
        <h2>Checks</h2>
        <div className="dui-check-row"><Check size={14} /><span>TypeScript</span><small>passed</small></div>
        <div className="dui-check-row"><Check size={14} /><span>ESLint</span><small>passed · zero warnings</small></div>
        <div className="dui-check-row"><Check size={14} /><span>Canvas unit and component tests</span><small>14 files · 39 tests</small></div>
        <h2>Command</h2>
        <pre><code>pnpm --filter @ensemble/canvas test -- --run</code></pre>
      </article> : null}
      {artifact.id === "probe" ? <article className="dui-document-preview">
        <span className="dui-document-kicker">STRUCTURED DATA</span>
        <h1>runner-probe.json</h1>
        <p className="dui-document-lead">Validated against runner_diagnostic v1.</p>
        <pre className="dui-json-preview"><code>{`{
  "schemaVersion": 1,
  "runnerProfileId": "pi",
  "status": "available",
  "capabilities": ["execute", "stream_output"],
  "checkedAt": "2026-08-19T14:42:10+08:00"
}`}</code></pre>
      </article> : null}
    </div>
  );
}

export function OutputInspectionPreview({ surface, sourceSeat }: OutputInspectionPreviewProps) {
  const [selectedPath, setSelectedPath] = useState("test-support/DiscordUiPreview.tsx");
  const [selectedArtifact, setSelectedArtifact] = useState("review");
  return (
    <div className="dui-main-body dui-output-surface">
      {surface === "files" ? <FilesTree selected={selectedPath} onSelect={setSelectedPath} /> : <ArtifactBrowser selected={selectedArtifact} onSelect={setSelectedArtifact} />}
      {surface === "files" ? <DiffViewer selectedPath={selectedPath} sourceSeat={sourceSeat} /> : <ArtifactViewer artifactId={selectedArtifact} />}
    </div>
  );
}
