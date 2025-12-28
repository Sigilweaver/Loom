import React from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  coords: { x: number; y: number } | null;
  currentPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  onSelect: (
    p: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  ) => void;
  onClose: () => void;
}

const options = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const CanvasPositionMenu: React.FC<Props> = ({
  open,
  coords,
  currentPosition,
  onSelect,
  onClose,
}) => {
  if (!open || !coords) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: coords.x,
        top: coords.y,
        background: "var(--color-canvas-controls-bg)",
        border: "1px solid var(--color-canvas-controls-border)",
        borderRadius: 6,
        boxShadow: "var(--color-canvas-controls-shadow)",
        zIndex: 10000,
        width: 100,
        overflow: "hidden",
      }}
      onMouseLeave={onClose}
    >
      {options.map((o) => (
        <button
          key={o}
          onClick={() => {
            onSelect(o);
            onClose();
          }}
          style={{
            width: "100%",
            padding: "6px 8px",
            border: "none",
            background:
              currentPosition === o
                ? "var(--color-canvas-controls-btn-bg-active)"
                : "transparent",
            color:
              currentPosition === o
                ? "var(--color-canvas-controls-btn-text-active)"
                : "var(--color-canvas-controls-btn-text)",
            textAlign: "left",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {o
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")}
        </button>
      ))}
    </div>,
    document.body
  );
};
