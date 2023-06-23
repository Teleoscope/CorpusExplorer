import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { useAppSelector, useAppDispatch } from "@/util/hooks";

const onEdgeClick = (evt, id) => {
  evt.stopPropagation();
  alert(`remove ${id}`);
};

const buttonStyle = {
  width: "20px",
  height: "20px",
  background: "#eee",
  border: "1px solid #fff",
  cursor: "pointer",
  borderRadius: "50%",
  fontSize: "12px",
  lineHeight: "1",
}

export default function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {
    strokeWidth: 1.5

  },
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const settings = useAppSelector((state) => state.windows.settings);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{stroke: settings.color, ...style}} />
      <EdgeLabelRenderer>
        {/* <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button style={buttonStyle} onClick={(event) => onEdgeClick(event, id)}>
            ×
          </button>
        </div> */}
      </EdgeLabelRenderer>
    </>
  );
}
