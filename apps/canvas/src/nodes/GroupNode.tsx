import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { GroupNodeData } from "../lib/layout";
import { useCanvasStore } from "../store/canvasStore";

export function GroupNode({ id, data }: NodeProps<Node<GroupNodeData>>) {
  const toggleCollapse = useCanvasStore((s) => s.toggleCollapse);
  const focusNode = useCanvasStore((s) => s.focusNode);
  const h = data.collapsed ? 72 : data.height;

  return (
    <div
      className={`group-node ${data.collapsed ? "collapsed" : "expanded"}`}
      style={{ width: data.width, height: h }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        focusNode(id);
      }}
    >
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="group-header">
        <Folder size={16} className="group-icon" />
        <span className="group-name">{data.org.name}</span>
        {data.hasChildren ? (
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(id);
            }}
          >
            {data.collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
