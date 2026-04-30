/**
 * LifecycleLight — 3D LED indicator for lifecycle tracker stages
 *
 * Visual states:
 *   - completed (past):  Green 3D light — solid glow
 *   - current:           Yellow 3D light — flickering/pulsing animation
 *   - next:              Orange 3D light — subtle glow
 *   - future:            Red 3D light — dim, inactive
 *
 * Uses CSS radial gradients, box-shadows, and keyframe animations
 * to create a realistic 3D LED bulb effect.
 */

import React from "react";

export type LightState = "completed" | "current" | "next" | "future";

interface LifecycleLightProps {
  state: LightState;
  size?: number; // px — default 10
  className?: string;
}

// ─── Color configs for each state ──────────────────────────
const LIGHT_CONFIG: Record<
  LightState,
  {
    core: string;       // bright center
    mid: string;        // mid-ring
    edge: string;       // outer ring / bezel
    glow: string;       // outer glow shadow
    glowSpread: string; // glow size
    animate: boolean;   // flicker
  }
> = {
  completed: {
    core: "#6fff6f",
    mid: "#22c55e",
    edge: "#166534",
    glow: "rgba(34, 197, 94, 0.6)",
    glowSpread: "6px",
    animate: false,
  },
  current: {
    core: "#fff566",
    mid: "#facc15",
    edge: "#a16207",
    glow: "rgba(250, 204, 21, 0.7)",
    glowSpread: "8px",
    animate: true,
  },
  next: {
    core: "#ffb366",
    mid: "#f97316",
    edge: "#9a3412",
    glow: "rgba(249, 115, 22, 0.45)",
    glowSpread: "5px",
    animate: false,
  },
  future: {
    core: "#ff6b6b",
    mid: "#ef4444",
    edge: "#7f1d1d",
    glow: "rgba(239, 68, 68, 0.3)",
    glowSpread: "3px",
    animate: false,
  },
};

export function LifecycleLight({ state, size = 10, className = "" }: LifecycleLightProps) {
  const c = LIGHT_CONFIG[state];

  const lightStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    position: "relative",
    flexShrink: 0,
    // 3D LED effect: radial gradient from bright center → dark edge
    background: `radial-gradient(circle at 35% 35%, ${c.core} 0%, ${c.mid} 50%, ${c.edge} 100%)`,
    // Multi-layer shadow: inner highlight + outer glow + bezel depth
    boxShadow: [
      `inset 0 -${size * 0.15}px ${size * 0.25}px rgba(0,0,0,0.3)`,     // inner bottom shadow (depth)
      `inset 0 ${size * 0.1}px ${size * 0.15}px rgba(255,255,255,0.25)`, // inner top highlight (shine)
      `0 0 ${c.glowSpread} ${c.glow}`,                                   // outer glow
      `0 ${size * 0.05}px ${size * 0.1}px rgba(0,0,0,0.2)`,             // drop shadow (elevation)
    ].join(", "),
    ...(c.animate
      ? { animation: "ledFlicker 1.8s ease-in-out infinite" }
      : {}),
  };

  return <div style={lightStyle} className={className} aria-hidden="true" />;
}

/**
 * Determines the LightState for a stage given its position relative to the current stage.
 */
export function getLightState(
  stageIndex: number,
  currentIndex: number,
  isTerminal?: boolean
): LightState {
  if (isTerminal) return "future"; // all stages dim when closed_lost
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";
  if (stageIndex === currentIndex + 1) return "next";
  return "future";
}

export default LifecycleLight;
