import { getText } from "@/i18n/get-text";
import { Underline } from "lucide-react";
import type { CSSProperties } from "react";

const colors = { red: "#fb7185", purple: "#a78bfa", blue: "#60a5fa", green: "#4ade80", yellow: "#facc15" };

export type InkEntryData = {
  id: string;
  kind: "ink";
  text: string;
  color: keyof typeof colors;
  lineStyle: "highlight" | "underline" | "wavy";
  url: string;
  urlKey: string;
  pageTitle: string;
  noteId: string | null;
  sourceCount: number;
};

export function InkEntry({ item }: { item: InkEntryData }) {
  const style = { "--ink-color": colors[item.color] } as CSSProperties;
  return <li className="ink-entry">
    <span className="mark-kind"><Underline size={13} aria-hidden="true" />{getText("collections.ink")}</span>
    <p><span className="ink-mark-text" data-line-style={item.lineStyle} style={style}>{item.text}</span></p>
  </li>;
}
