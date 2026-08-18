import type { SeatStatus } from "@ensemble/protocol";

/** Display labels (protocol enums stay unchanged in store). */
export function statusLabel(status: SeatStatus): string {
  switch (status) {
    case "waiting_human":
      return "等你";
    case "waiting_peer":
      return "等同伴";
    case "planning":
      return "规划中";
    case "working":
      return "工作中";
    case "tooling":
      return "调工具";
    case "blocked":
      return "受阻";
    case "done":
      return "完成";
    case "error":
      return "错误";
    case "idle":
    default:
      return "空闲";
  }
}
