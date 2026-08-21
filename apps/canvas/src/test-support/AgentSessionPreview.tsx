import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileOutput,
  GitCompareArrows,
  Paperclip,
  Play,
  Send,
  Square,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import "./agent-session-preview.css";

type AgentSessionPreviewProps = {
  seat: {
    name: string;
    role: string;
    initials: string;
    tone: string;
    activity: string;
  };
  onOpenChanges: () => void;
  onOpenArtifacts: () => void;
};

type SessionMessage = {
  id: number;
  author: "you" | "agent";
  body: string;
};

const INITIAL_MESSAGES: SessionMessage[] = [
  {
    id: 1,
    author: "you",
    body: "Add the Agent session prototype. Keep the organization model and make the work inspectable.",
  },
  {
    id: 2,
    author: "agent",
    body: "I am extending the preview with a direct session surface. I will keep conversation, execution evidence, and workspace changes connected without treating terminal output as the source of truth.",
  },
];

export function AgentSessionPreview({ seat, onOpenChanges, onOpenArtifacts }: AgentSessionPreviewProps) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [rawOpen, setRawOpen] = useState(true);
  const [running, setRunning] = useState(true);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), author: "you", body },
      {
        id: Date.now() + 1,
        author: "agent",
        body: "Received. I added that instruction to the active task context and will apply it in the next implementation step.",
      },
    ]);
    setDraft("");
    setRunning(true);
  }

  return (
    <div className="dui-main-body dui-session">
      <section className="dui-session-thread" aria-label={`${seat.name} session`}>
        <header className="dui-session-heading">
          <div className={`dui-session-avatar dui-session-avatar--${seat.tone}`}>{seat.initials}</div>
          <div>
            <div className="dui-session-name"><strong>{seat.name}</strong><span><CircleDot size={11} />{running ? "Working" : "Paused"}</span></div>
            <p>{seat.role}</p>
          </div>
          <div className="dui-session-controls">
            <span>run-221</span>
            <button type="button" onClick={() => setRunning((value) => !value)}>
              {running ? <><Square size={12} /> Interrupt</> : <><Play size={13} /> Continue</>}
            </button>
          </div>
        </header>

        <div className="dui-session-feed" aria-live="polite">
          <div className="dui-session-date"><span>Today</span></div>
          <div className="dui-session-event dui-session-event--system">
            <span className="dui-session-event-icon"><Activity size={14} /></span>
            <div><strong>Attempt 03 started</strong><small>pi runner · /home/cc/code1/ensemble · main</small></div>
            <time>14:42</time>
          </div>

          {messages.map((message) => (
            <article className={`dui-session-message dui-session-message--${message.author}`} key={message.id}>
              <div className={`dui-session-message-avatar${message.author === "you" ? " is-you" : ""}`}>
                {message.author === "you" ? "G" : seat.initials}
              </div>
              <div className="dui-session-message-body">
                <header><strong>{message.author === "you" ? "You" : seat.name}</strong><time>14:43</time></header>
                <p>{message.body}</p>
              </div>
            </article>
          ))}

          <div className="dui-session-event">
            <span className="dui-session-event-icon"><Wrench size={14} /></span>
            <div><strong>Inspected the client shell</strong><small>Read 8 files · searched 3 symbols</small></div>
            <span className="dui-session-event-state"><Check size={12} /> Done</span>
          </div>

          <div className="dui-session-command">
            <button className="dui-session-command-heading" type="button" aria-expanded={rawOpen} onClick={() => setRawOpen((value) => !value)}>
              <span className="dui-session-event-icon"><Terminal size={14} /></span>
              <span><strong>pnpm --filter @ensemble/canvas test -- --run</strong><small>apps/canvas · exit 0 · 2.89s</small></span>
              <span className="dui-session-command-status"><Check size={12} /> Passed</span>
              <ChevronDown size={14} />
            </button>
            {rawOpen ? (
              <pre className="dui-session-terminal"><code><span>$ pnpm --filter @ensemble/canvas test -- --run</span>{`\n\n RUN  v3.2.7 /home/cc/code1/ensemble/apps/canvas\n ✓ src/App.entry.test.ts (1)\n ✓ src/app-shell/AppShell.test.tsx (5)\n ✓ src/test-support/DiscordUiPreview.test.tsx (3)\n\n Test Files  15 passed (15)\n      Tests  42 passed (42)\n   Duration  2.89s`}</code></pre>
            ) : null}
          </div>

          <div className="dui-session-event">
            <span className="dui-session-event-icon"><GitCompareArrows size={14} /></span>
            <div><strong>Updated the working tree</strong><small>4 files changed · +546 -26</small></div>
            <button type="button" onClick={onOpenChanges}>Open diff <ChevronRight size={13} /></button>
          </div>

          <article className="dui-session-message dui-session-message--agent">
            <div className="dui-session-message-avatar">{seat.initials}</div>
            <div className="dui-session-message-body">
              <header><strong>{seat.name}</strong><time>just now</time></header>
              <p>The interactive session is in place. I am checking the direct message flow and the raw execution output now.</p>
              {running ? <span className="dui-session-typing"><i /><i /><i /> Working</span> : <span className="dui-session-paused">Paused by you</span>}
            </div>
          </article>
        </div>

        <form className="dui-session-composer" onSubmit={sendMessage}>
          <button type="button" aria-label="Attach context" title="Attach context"><Paperclip size={17} /></button>
          <textarea
            aria-label={`Message ${seat.name}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={`Message ${seat.name}`}
            rows={1}
          />
          <span className="dui-session-context">Task context</span>
          <button className="dui-session-send" type="submit" aria-label="Send message" title="Send message" disabled={!draft.trim()}><Send size={16} /></button>
        </form>
      </section>

      <aside className="dui-session-context-panel" aria-label="Session context">
        <div className="dui-session-context-heading"><span>Session context</span><Bot size={15} /></div>
        <section className="dui-session-context-section">
          <span className="dui-session-context-label">Current task</span>
          <h3>Agent session prototype</h3>
          <p>Direct conversation and inspectable execution for every Seat.</p>
          <div className="dui-session-progress"><span style={{ width: "72%" }} /></div>
          <div className="dui-session-progress-meta"><span>In progress</span><strong>3 / 4 steps</strong></div>
        </section>
        <section className="dui-session-context-section">
          <span className="dui-session-context-label">Plan</span>
          <div className="dui-session-plan-item is-done"><Check size={13} /><span>Map the current shell</span></div>
          <div className="dui-session-plan-item is-done"><Check size={13} /><span>Build session stream</span></div>
          <div className="dui-session-plan-item is-active"><CircleDot size={13} /><span>Wire direct messages</span></div>
          <div className="dui-session-plan-item"><span className="dui-session-plan-dot" /><span>Visual review</span></div>
        </section>
        <section className="dui-session-context-section">
          <span className="dui-session-context-label">Working tree</span>
          <button className="dui-session-context-link" type="button" onClick={onOpenChanges}><GitCompareArrows size={15} /><span><strong>4 changed files</strong><small>+546 additions · -26 deletions</small></span><ChevronRight size={14} /></button>
          <button className="dui-session-context-link" type="button" onClick={onOpenArtifacts}><FileOutput size={15} /><span><strong>2 artifacts</strong><small>Review and test report</small></span><ChevronRight size={14} /></button>
        </section>
        <section className="dui-session-context-section dui-session-context-section--runtime">
          <span className="dui-session-context-label">Runtime</span>
          <dl><dt>Runner</dt><dd>pi</dd><dt>Model</dt><dd>gpt-5.6-sol</dd><dt>Context</dt><dd>42%</dd><dt>Elapsed</dt><dd>08:41</dd></dl>
        </section>
      </aside>
    </div>
  );
}
