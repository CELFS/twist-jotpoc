import type { CSSProperties } from "react";
import type { SourceNoteRecord } from "@/data/models";
export const colors = { red: "#f87171", purple: "#a78bfa", blue: "#60a5fa", green: "#4ade80", yellow: "#eab308" };
export function noteMarkStyle(note: SourceNoteRecord): CSSProperties {
  const ink = note.ink;
  if (!ink) return {};
  const color = colors[ink.color];
  return ink.lineStyle === "highlight" ? { backgroundColor: `${color}55`, boxDecorationBreak: "clone" } : {
    textDecorationLine: "underline", textDecorationStyle: ink.lineStyle === "wavy" ? "wavy" : "solid", textDecorationColor: color, textUnderlineOffset: "0.2em",
  };
}
