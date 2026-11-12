import { Rss } from "lucide-react";
import type { CSSProperties } from "react";

export function memoSourceStyle(color: string): CSSProperties {
  return { "--memo-source-color": color } as CSSProperties;
}

export function MemoSourceVisual({
  color,
  size = 18,
}: {
  color: string;
  size?: number;
}) {
  return (
    <span
      className="memo-source-visual"
      style={memoSourceStyle(color)}
      aria-hidden="true"
    >
      <Rss size={size} />
    </span>
  );
}
