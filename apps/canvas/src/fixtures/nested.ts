import type { Bubble, OrgSnapshot, SeatRuntime } from "@ensemble/protocol";

export const nestedOrg: OrgSnapshot = {
  root: {
    id: "group_eng",
    kind: "group",
    name: "Engineering",
    parent_id: null,
    children: [
      {
        id: "seat_eng",
        kind: "seat",
        name: "Engineer",
        parent_id: "group_eng",
        role_template: "engineer",
        runner: "pi",
        goal: "Own the feature and delegate tests",
        prompt: "Implement the feature; spawn QA for verification.",
        children: [
          {
            id: "seat_qa",
            kind: "seat",
            name: "QA",
            parent_id: "seat_eng",
            role_template: "qa",
            runner: "mock",
            goal: "Verify the patch",
            current_action: "Running checks",
            prompt: "Execute test plan and report defects.",
            children: [],
          },
        ],
      },
    ],
  },
  edges: [
    { id: "e_eng_qa", from: "seat_eng", to: "seat_qa", kind: "delegate" },
  ],
};

export const nestedRuntimes: Record<string, SeatRuntime> = {
  seat_eng: {
    status: "working",
    goal: "Own the feature and delegate tests",
    current_action: "Delegating verification",
    prompt: "Implement the feature; spawn QA for verification.",
    history: ["Nested fixture loaded", "Child QA attached"],
    outputs: ["01-plan.md"],
  },
  seat_qa: {
    status: "tooling",
    goal: "Verify the patch",
    current_action: "Running checks",
    prompt: "Execute test plan and report defects.",
    history: ["Started tooling session"],
    outputs: [],
  },
};

export const nestedBubbles: Bubble[] = [
  {
    bubble_id: "b_eng_approve",
    seat_id: "seat_eng",
    kind: "approve",
    priority: 0,
    title: "Approve nested plan?",
    body: "Engineer proposes shipping after QA tooling completes.",
    actions: ["approve", "reject"],
  },
];
