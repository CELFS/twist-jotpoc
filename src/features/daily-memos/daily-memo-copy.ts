import type { JSONContent } from "@tiptap/react";
import { createMemoMarkdownManager } from "@/features/daily-memos/daily-memo-markdown";
import { DailyMemoStarterKit } from "@/features/daily-memos/daily-memo-starter-kit";
import { createRepositories } from "@/data/repositories";
import { DailyMemoTaskItem, DailyMemoTaskList } from "@/features/daily-memos/daily-memo-task-extensions";
import { stripMemoListMarkerPlaceholders } from "@/features/daily-memos/daily-memo-list-placeholder-codec";

export function getMemoDocumentText(
  node: JSONContent,
  sourceNotes: ReadonlyMap<string, string> = new Map(),
): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "memoSourceNoteReference") {
    return sourceNotes.get(String(node.attrs?.sourceNoteId ?? "")) ?? "";
  }

  const children = node.content ?? [];
  const inline = node.type === "paragraph" || node.type === "heading" || node.type === "codeBlock";
  const separator = inline ? "" : node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList" ? "\n" : "\n\n";
  const body = children.map((child, index) => {
    const text = getMemoDocumentText(child, sourceNotes);
    if (node.type === "orderedList") return `${Number(node.attrs?.start ?? 1) + index}. ${text}`;
    if (node.type === "bulletList") return `- ${text}`;
    if (node.type === "taskList") return `${child.attrs?.checked ? "[x]" : "[ ]"} ${text}`;
    return text;
  }).join(separator);

  if (node.type === "memoInfoBlock") {
    return [String(node.attrs?.sourceName ?? ""), body].filter(Boolean).join("\n\n");
  }
  return body;
}

export function getDailyMemoCopyText(
  title: string,
  document: JSONContent,
  sourceNotes?: ReadonlyMap<string, string>,
): string {
  return stripMemoListMarkerPlaceholders(
    [title, getMemoDocumentText(document, sourceNotes)].filter(Boolean).join("\n\n"),
  );
}

export async function resolveDailyMemoCopyText(title: string, document: JSONContent): Promise<string> {
  const ids = new Set<string>();
  const visit = (node: JSONContent) => {
    if (node.type === "memoSourceNoteReference" && node.attrs?.sourceNoteId) {
      ids.add(String(node.attrs.sourceNoteId));
    }
    node.content?.forEach(visit);
  };
  visit(document);
  const sourceNotes = new Map<string, string>();
  if (ids.size > 0) {
    const repositories = createRepositories();
    const markdown = createMemoMarkdownManager({ extensions: [DailyMemoStarterKit, DailyMemoTaskItem, DailyMemoTaskList] });
    await Promise.all(Array.from(ids, async (id) => {
      const note = await repositories.sourceNotes.get(id);
      if (!note) throw new Error("Missing source note");
      const resource = await repositories.webResources.get(note.webResourceId);
      sourceNotes.set(id, [
        resource?.customTitle || resource?.pageTitle,
        resource?.url,
        getMemoDocumentText(markdown.parse(note.content)),
      ].filter(Boolean).join("\n\n"));
    }));
  }
  return getDailyMemoCopyText(title, document, sourceNotes);
}
