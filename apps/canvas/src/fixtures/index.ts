import type { Bubble, FixtureId, OrgSnapshot, SeatRuntime } from "@ensemble/protocol";
import { deepBubbles, deepOrg, deepRuntimes } from "./deep";
import { fourBubbles, fourOrg, fourRuntimes, FOUR_HANDOFF_STEPS } from "./four";
export { FOUR_HANDOFF_STEPS };
import { nestedBubbles, nestedOrg, nestedRuntimes } from "./nested";
import { singleBubbles, singleOrg, singleRuntimes } from "./single";

export interface FixtureBundle {
  id: FixtureId;
  org: OrgSnapshot;
  runtimes: Record<string, SeatRuntime>;
  bubbles: Bubble[];
  runName: string;
  /** Seats collapsed by default (nested: collapse eng children for badge demo) */
  collapsedIds: string[];
}

export const FIXTURES: Record<FixtureId, FixtureBundle> = {
  single_agent: {
    id: "single_agent",
    runName: "run-single-mock",
    org: singleOrg,
    runtimes: singleRuntimes,
    bubbles: singleBubbles,
    collapsedIds: [],
  },
  four_crew: {
    id: "four_crew",
    runName: "run-four-mock",
    org: fourOrg,
    runtimes: fourRuntimes,
    bubbles: fourBubbles,
    collapsedIds: [],
  },
  nested: {
    id: "nested",
    runName: "run-nested-mock",
    org: nestedOrg,
    runtimes: nestedRuntimes,
    bubbles: nestedBubbles,
    collapsedIds: ["seat_eng"],
  },
  deep: {
    id: "deep",
    runName: "run-deep-mock",
    org: deepOrg,
    runtimes: deepRuntimes,
    bubbles: deepBubbles,
    collapsedIds: ["seat_eng", "nest_d4", "nest_d3"],
  },
};

export function getFixture(id: FixtureId): FixtureBundle {
  return FIXTURES[id];
}
