import { describe, expect, it } from "vitest";
import { rollupBadge, type SeatStatus } from "@ensemble/protocol";

describe("rollupBadge (10 §4.1)", () => {
  it("counts tooling child as busy", () => {
    const statuses: SeatStatus[] = ["idle", "tooling"];
    const b = rollupBadge(statuses, 0);
    expect(b.busy).toBe(1);
    expect(b.waiting).toBe(0);
    expect(b.error).toBe(0);
  });

  it("counts waiting_human and open p0 bubbles", () => {
    const b = rollupBadge(["waiting_human", "working"], 1);
    expect(b.busy).toBe(1);
    expect(b.waiting).toBe(2);
  });

  it("counts error and blocked", () => {
    const b = rollupBadge(["error", "blocked", "done"]);
    expect(b.error).toBe(2);
  });
});
