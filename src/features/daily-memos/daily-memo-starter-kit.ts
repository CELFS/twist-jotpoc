import { OrderedList } from "@tiptap/extension-list";
import { getExtensionField, type JSONContent, type Node } from "@tiptap/react";
import { memoOrderedListTokenizer } from "./daily-memo-markdown-specs";
import StarterKit from "@tiptap/starter-kit";

export const DailyMemoOrderedList = OrderedList.extend({
  markdownTokenizer: memoOrderedListTokenizer,
});

export const DailyMemoStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((extension) => {
      if (extension.name === "orderedList") {
        return DailyMemoOrderedList.configure(this.options.orderedList || {});
      }
      if (extension.name !== "paragraph") {
        return extension;
      }

      const paragraph = extension as Node;
      const renderMarkdown = getExtensionField(paragraph, "renderMarkdown")!;
      const renderedParagraphs = new WeakMap<JSONContent, string>();
      return paragraph.extend({
        renderMarkdown(node, helpers, context) {
          // Empty paragraphs depend on the previous sibling. Non-empty paragraphs
          // render only their own inline content, so immutable JSON can be reused.
          if (!node.content?.length) {
            return renderMarkdown(node, helpers, context);
          }
          const cached = renderedParagraphs.get(node);
          if (cached !== undefined) {
            return cached;
          }
          const markdown = renderMarkdown(node, helpers, context);
          renderedParagraphs.set(node, markdown);
          return markdown;
        },
      });
    });
  },
});
