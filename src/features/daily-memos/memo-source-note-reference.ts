import {
  mergeAttributes,
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type MarkdownParseHelpers,
  type MarkdownParseResult,
  type MarkdownToken,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { createElement } from "react";
import { memoSourceNoteReferenceMarkdownSpec } from "./daily-memo-markdown-specs";
import { SourceNoteCard } from "@/features/daily-memos/source-note-card";

function MemoSourceNoteReferenceView({ node }: NodeViewProps) {
  return createElement(
    NodeViewWrapper,
    {
      className: "daily-memo-source-note-reference",
      contentEditable: false,
    },
    createElement(SourceNoteCard, {
      noteId: String(node.attrs.sourceNoteId || ""),
    }),
  );
}

const defaultSourceNoteReferenceMarkdown = memoSourceNoteReferenceMarkdownSpec;
const sourceNoteReferenceMarkdown = {
  ...defaultSourceNoteReferenceMarkdown,
  parseMarkdown(
    token: MarkdownToken,
    helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    const parsed = defaultSourceNoteReferenceMarkdown.parseMarkdown(
      token,
      helpers,
    );

    if (
      Array.isArray(parsed) ||
      "mark" in parsed ||
      parsed.type !== "memoSourceNoteReference"
    ) {
      return parsed;
    }

    const reference = { ...parsed };
    delete reference.content;

    return reference;
  },
};

export const MemoSourceNoteReference = Node.create({
  name: "memoSourceNoteReference",
  group: "block",
  atom: true,
  isolating: true,
  selectable: true,
  addAttributes() {
    return {
      sourceNoteId: {
        default: "",
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "article[data-memo-source-note-reference]",
        getAttrs: (element) => ({
          sourceNoteId:
            (element as HTMLElement).dataset.sourceNoteId ?? "",
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { sourceNoteId, ...restAttributes } = HTMLAttributes;

    return [
      "article",
      mergeAttributes(restAttributes, {
        "data-memo-source-note-reference": "true",
        "data-source-note-id": sourceNoteId,
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MemoSourceNoteReferenceView);
  },
  ...sourceNoteReferenceMarkdown,
});
