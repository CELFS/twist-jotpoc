import type { MarkdownToken } from "@tiptap/react";

const metadataPattern = /^<!--memo-task:([A-Za-z0-9_-]{21}):(0|[1-9]\d{0,12})-->$/;

// Imported duplicate markers belong to their first occurrence, in source order.
export function claimMemoTaskId(id: string | null | undefined, seen: Set<string>) {
  if (!id || !/^[A-Za-z0-9_-]{21}$/.test(id) || seen.has(id)) return false;
  seen.add(id);
  return true;
}

export function readMemoTaskMetadata(tokens: MarkdownToken[] = []) {
  const token = tokens[0];
  const match = token?.type === "html" ? metadataPattern.exec(token.raw ?? "") : null;
  if (!match) return undefined;
  const completedAt = Number(match[2]);
  return { id: match[1], completedAt: completedAt || null, marker: match[0] };
}

export function memoTaskMarker(id: string, completedAt: number | null) {
  return `<!--memo-task:${id}:${completedAt ?? 0}-->`;
}

export function removeMemoTaskMetadata(tokens: MarkdownToken[]) {
  if (!readMemoTaskMetadata(tokens)) return tokens;
  const rest = tokens.slice(1);
  if (rest[0]?.type === "text") {
    rest[0] = { ...rest[0], raw: rest[0].raw?.replace(/^ /, ""), text: String(rest[0].text ?? "").replace(/^ /, "") };
    if (rest[0].text === "") rest.shift();
  }
  return rest;
}
