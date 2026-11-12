import { Markdown, MarkdownManager, type MarkdownExtensionOptions } from "@tiptap/markdown";
import { Marked } from "marked";

function createMarkedInstance(): NonNullable<MarkdownExtensionOptions["marked"]> {
  // Tiptap types this option as the global callable export, but uses the parser
  // methods and Lexer provided by a Marked instance at runtime.
  return new Marked() as unknown as NonNullable<MarkdownExtensionOptions["marked"]>;
}

type MemoMarkdownManagerOptions = Omit<
  NonNullable<ConstructorParameters<typeof MarkdownManager>[0]>,
  "marked"
>;

export function createMemoMarkdownManager(options: MemoMarkdownManagerOptions) {
  return new MarkdownManager({ ...options, marked: createMarkedInstance() });
}

export const DailyMemoMarkdown = Markdown.extend({
  addStorage() {
    return {
      manager: createMemoMarkdownManager({
        extensions: [],
        indentation: this.options.indentation,
        markedOptions: this.options.markedOptions,
      }),
    };
  },
  onBeforeCreate(event) {
    // An extension configuration can be reused when switching documents. Allocate
    // here, per editor, so its tokenizers never accumulate on a previous parser.
    this.options.marked = createMarkedInstance();
    this.parent?.(event);
  },
});
