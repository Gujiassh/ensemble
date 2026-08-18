import type { Bubble, OrgSnapshot, SeatRuntime } from "@ensemble/protocol";

export const fourOrg: OrgSnapshot = {
  root: {
    id: "group_crew",
    kind: "group",
    name: "Delivery Crew",
    parent_id: null,
    children: [
      {
        id: "seat_pm",
        kind: "seat",
        name: "PM",
        parent_id: "group_crew",
        role_template: "pm",
        runner: "mock",
        goal: "Clarify scope and write the brief",
        prompt: "Capture acceptance criteria and hand off a brief.",
        children: [],
      },
      {
        id: "seat_res",
        kind: "seat",
        name: "Researcher",
        parent_id: "group_crew",
        role_template: "researcher",
        runner: "mock",
        goal: "Gather constraints and prior art",
        prompt: "Summarize relevant context for the engineer.",
        children: [],
      },
      {
        id: "seat_eng",
        kind: "seat",
        name: "Engineer",
        parent_id: "group_crew",
        role_template: "engineer",
        runner: "pi",
        goal: "Implement the change",
        prompt: "Produce a patch and short summary.",
        children: [],
      },
      {
        id: "seat_rev",
        kind: "seat",
        name: "Reviewer",
        parent_id: "group_crew",
        role_template: "reviewer",
        runner: "mock",
        goal: "Gate quality and request rework if needed",
        prompt: "Review the patch; approve or reject.",
        children: [],
      },
    ],
  },
  edges: [
    { id: "e_pm_res", from: "seat_pm", to: "seat_res", kind: "handoff" },
    { id: "e_res_eng", from: "seat_res", to: "seat_eng", kind: "handoff" },
    { id: "e_eng_rev", from: "seat_eng", to: "seat_rev", kind: "handoff" },
  ],
};

function rt(
  goal: string,
  prompt: string,
  status: SeatRuntime["status"] = "idle",
): SeatRuntime {
  return {
    status,
    goal,
    current_action: "Idle",
    prompt,
    history: ["Crew fixture loaded"],
    outputs: [],
  };
}

export const fourRuntimes: Record<string, SeatRuntime> = {
  seat_pm: rt("Clarify scope and write the brief", fourOrg.root.children![0].prompt!),
  seat_res: rt(
    "Gather constraints and prior art",
    fourOrg.root.children![1].prompt!,
  ),
  seat_eng: rt("Implement the change", fourOrg.root.children![2].prompt!),
  seat_rev: rt(
    "Gate quality and request rework if needed",
    fourOrg.root.children![3].prompt!,
  ),
};

export const fourBubbles: Bubble[] = [];

/** Fixed handoff playback labels (M1-F11 / A9) */
export const FOUR_HANDOFF_STEPS = [
  {
    from: "seat_pm",
    to: "seat_res",
    edge_id: "e_pm_res",
    label: "brief",
    fromStatus: "working" as const,
    toStatus: "working" as const,
    doneFrom: "done" as const,
  },
  {
    from: "seat_res",
    to: "seat_eng",
    edge_id: "e_res_eng",
    label: "research",
    fromStatus: "working" as const,
    toStatus: "working" as const,
    doneFrom: "done" as const,
  },
  {
    from: "seat_eng",
    to: "seat_rev",
    edge_id: "e_eng_rev",
    label: "patch",
    fromStatus: "tooling" as const,
    toStatus: "working" as const,
    doneFrom: "done" as const,
  },
  {
    from: "seat_rev",
    to: "seat_rev",
    edge_id: "e_eng_rev",
    label: "review",
    fromStatus: "waiting_human" as const,
    toStatus: "waiting_human" as const,
    doneFrom: "waiting_human" as const,
    bubble: true,
  },
] as const;
