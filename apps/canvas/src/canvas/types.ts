export type CanvasObjectKind = "seat" | "group" | "packet" | "attention";

export type CanvasObject = {
  id: string;
  kind: CanvasObjectKind;
  label: string;
  summary?: string;
};

export type CanvasProjection = {
  workspaceId: string;
  objects: CanvasObject[];
};

export type CanvasViewportState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "unavailable"; reasonKey: "canvas.unavailable.body" }
  | { status: "ready"; projection: CanvasProjection };

export type CanvasSelection = {
  objectId: string | null;
};
