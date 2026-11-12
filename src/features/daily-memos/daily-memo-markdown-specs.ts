import { OrderedList, TaskList } from "@tiptap/extension-list";
import { createBlockMarkdownSpec } from "@tiptap/react";

const taskListTokenizer = TaskList.config.markdownTokenizer!;
export const memoTaskListTokenizer = {
  ...taskListTokenizer,
  tokenize: ((src, tokens, lexer) => {
    // Keep blank-line and indentation handling in the original parser, but do
    // not split the entire remaining document for a non-task paragraph.
    if (!/^\s*[-+*][^\S\n]+\[[ xX]\][^\S\n]+/.test(src)) return undefined;
    return taskListTokenizer.tokenize(src, tokens, lexer);
  }) satisfies typeof taskListTokenizer.tokenize,
};

const orderedListTokenizer = OrderedList.config.markdownTokenizer!;
export const memoOrderedListTokenizer = {
  ...orderedListTokenizer,
  tokenize: ((src, tokens, lexer) => {
    // The upstream tokenizer splits all remaining lines before checking the first
    // marker. This superset admits every supported numeric, alpha and Roman marker.
    if (!/^[^\S\n]*[\da-zA-Z]+[.)][^\S\n]+/.test(src)) return undefined;
    return orderedListTokenizer.tokenize(src, tokens, lexer);
  }) satisfies typeof orderedListTokenizer.tokenize,
};

export const memoInfoBlockMarkdownSpec = createBlockMarkdownSpec({
  allowedAttributes: ["sourceId", "sourceName"],
  defaultAttributes: { sourceId: "", sourceName: "" },
  nodeName: "memoInfoBlock",
  name: "memo-info",
});

export const memoSourceNoteReferenceMarkdownSpec = createBlockMarkdownSpec({
  allowedAttributes: ["sourceNoteId"],
  defaultAttributes: { sourceNoteId: "" },
  nodeName: "memoSourceNoteReference",
  name: "source-note",
});
