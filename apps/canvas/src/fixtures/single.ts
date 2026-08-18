import type { Bubble, OrgSnapshot, SeatRuntime } from "@ensemble/protocol";

export const singleOrg: OrgSnapshot = {
  root: {
    id: "group_default",
    kind: "group",
    name: "Default",
    parent_id: null,
    children: [
      {
        id: "seat_eng",
        kind: "seat",
        name: "Engineer",
        parent_id: "group_default",
        role_template: "engineer",
        runner: "pi",
        goal: "Ship a minimal fix for the reported issue",
        current_action: "Waiting for run",
        prompt:
          "You are the sole engineer. Plan, implement, and gate a small change.",
        children: [],
      },
    ],
  },
  edges: [],
};

export const singleRuntimes: Record<string, SeatRuntime> = {
  seat_eng: {
    status: "idle",
    goal: "Ship a minimal fix for the reported issue",
    current_action: "Waiting for run",
    prompt:
      "You are the sole engineer. Plan, implement, and gate a small change.",
    history: ["Workspace ready", "Single-agent fixture loaded"],
    outputs: [],
  },
};

export const singleBubbles: Bubble[] = [];
