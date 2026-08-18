/** Visible-node LOD policy (docs/09). */

export type LodTier = "full" | "reduced" | "static" | "warn";

export interface LodState {
  tier: LodTier;
  visibleCount: number;
  /** Animate packet dots / flowing labels */
  allowPacketMotion: boolean;
  /** Cap concurrent flowing packet visuals */
  maxFlowingPackets: number;
  /** Show fold/focus hint banner */
  showCollapseHint: boolean;
}

export function lodLevel(visibleCount: number): LodState {
  const n = Math.max(0, visibleCount);
  if (n <= 40) {
    return {
      tier: "full",
      visibleCount: n,
      allowPacketMotion: true,
      maxFlowingPackets: Infinity,
      showCollapseHint: false,
    };
  }
  if (n <= 80) {
    return {
      tier: "reduced",
      visibleCount: n,
      allowPacketMotion: true,
      maxFlowingPackets: 4,
      showCollapseHint: false,
    };
  }
  if (n <= 200) {
    return {
      tier: "static",
      visibleCount: n,
      allowPacketMotion: false,
      maxFlowingPackets: 0,
      showCollapseHint: false,
    };
  }
  return {
    tier: "warn",
    visibleCount: n,
    allowPacketMotion: false,
    maxFlowingPackets: 0,
    showCollapseHint: true,
  };
}
