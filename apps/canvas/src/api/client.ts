/** Runtime HTTP + SSE client (M2). */

export const RUNTIME_BASE =
  import.meta.env.VITE_RUNTIME_URL ?? "http://127.0.0.1:18427";

export interface WorkspaceInfo {
  id: string;
  name: string;
  title?: string;
}

export interface OrgPayload {
  workspace_id: string;
  org: {
    root: import("@ensemble/protocol").OrgNode;
    edges: import("@ensemble/protocol").OrgEdge[];
  };
}

export async function fetchWorkspaces(): Promise<WorkspaceInfo[]> {
  const r = await fetch(`${RUNTIME_BASE}/workspaces`);
  if (!r.ok) throw new Error(`workspaces ${r.status}`);
  const j = (await r.json()) as { workspaces: WorkspaceInfo[] };
  return j.workspaces;
}

export async function fetchOrg(workspaceId: string): Promise<OrgPayload> {
  const r = await fetch(`${RUNTIME_BASE}/workspaces/${workspaceId}/org`);
  if (!r.ok) throw new Error(`org ${r.status}`);
  return r.json() as Promise<OrgPayload>;
}

export async function startRun(
  workspaceId: string,
  body: {
    client_op_id: string;
    template: string;
    title?: string;
    prompt?: string;
  },
): Promise<{ run_id: string; stage: string }> {
  const r = await fetch(`${RUNTIME_BASE}/workspaces/${workspaceId}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`run.start ${r.status}`);
  return r.json() as Promise<{ run_id: string; stage: string }>;
}

export async function bubbleAct(
  workspaceId: string,
  runId: string,
  bubbleId: string,
  body: { client_op_id: string; action: string; comment?: string },
): Promise<unknown> {
  const r = await fetch(
    `${RUNTIME_BASE}/workspaces/${workspaceId}/runs/${runId}/bubbles/${bubbleId}/act`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`bubble.act ${r.status}`);
  return r.json();
}

export type SseHandler = (event: Record<string, unknown>) => void;

/** Subscribe to workspace SSE. Returns abort fn. */
export function subscribeEvents(
  workspaceId: string,
  onEvent: SseHandler,
  after?: string,
): () => void {
  const url = new URL(
    `${RUNTIME_BASE}/workspaces/${workspaceId}/events`,
  );
  if (after) url.searchParams.set("after", after);
  const es = new EventSource(url.toString());
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as Record<string, unknown>;
      onEvent(data);
    } catch {
      // ignore malformed
    }
  };
  return () => es.close();
}

export async function humanInject(
  workspaceId: string,
  runId: string,
  seatId: string,
  body: { client_op_id: string; inject_kind?: string; text: string },
): Promise<{ ok: boolean; prompt?: string }> {
  const r = await fetch(
    `${RUNTIME_BASE}/workspaces/${workspaceId}/runs/${runId}/seats/${seatId}/inject`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inject_kind: "prompt_append",
        ...body,
      }),
    },
  );
  if (!r.ok) throw new Error(`human.inject ${r.status}`);
  return r.json() as Promise<{ ok: boolean; prompt?: string }>;
}

export async function fetchArtifact(
  workspaceId: string,
  runId: string,
  name: string,
): Promise<string> {
  const r = await fetch(
    `${RUNTIME_BASE}/workspaces/${workspaceId}/runs/${runId}/artifacts/${encodeURIComponent(name)}`,
  );
  if (!r.ok) throw new Error(`artifact ${r.status}`);
  return r.text();
}
