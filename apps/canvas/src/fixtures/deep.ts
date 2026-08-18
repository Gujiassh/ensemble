import type { Bubble, OrgNode, OrgSnapshot, SeatRuntime } from "@ensemble/protocol";

/** Depth-5 chain under eng for LOD / fold demos. */
function chain(depth: number, parentId: string, prefix: string): OrgNode[] {
  if (depth <= 0) return [];
  const id = `${prefix}_d${depth}`;
  return [
    {
      id,
      kind: "seat",
      name: `Nest ${depth}`,
      parent_id: parentId,
      role_template: "engineer",
      runner: "mock",
      children: chain(depth - 1, id, prefix),
    },
  ];
}

export const deepOrg: OrgSnapshot = {
  root: {
    id: "group_root",
    kind: "group",
    name: "Deep",
    parent_id: null,
    children: [
      {
        id: "group_eng",
        kind: "group",
        name: "Engineering",
        parent_id: "group_root",
        children: [
          {
            id: "seat_eng",
            kind: "seat",
            name: "Engineer",
            parent_id: "group_eng",
            role_template: "engineer",
            runner: "pi",
            children: chain(4, "seat_eng", "nest"),
          },
        ],
      },
    ],
  },
  edges: [],
};

function walkSeats(n: OrgNode, out: string[] = []): string[] {
  if (n.kind === "seat") out.push(n.id);
  for (const c of n.children ?? []) walkSeats(c, out);
  return out;
}

export const deepRuntimes: Record<string, SeatRuntime> = Object.fromEntries(
  walkSeats(deepOrg.root).map((id, i) => [
    id,
    {
      status: i === 0 ? "tooling" : i === 1 ? "working" : "idle",
      history: [],
      outputs: [],
      current_action: i === 0 ? "parent" : undefined,
    } satisfies SeatRuntime,
  ]),
);

export const deepBubbles: Bubble[] = [
  {
    bubble_id: "b_deep_ask",
    seat_id: "nest_d3",
    kind: "ask",
    priority: 1,
    title: "Need parent decision?",
    actions: ["approve", "reject"],
  },
];
