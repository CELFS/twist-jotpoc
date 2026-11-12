import { TaskItem, TaskList } from "@tiptap/extension-list";
import { memoTaskListTokenizer } from "./daily-memo-markdown-specs";
import { LIST_TYPES } from "./daily-memo-list-model";
import { getText } from "@/i18n/get-text";
import { nanoid } from "nanoid";
import { memoTaskMarker, readMemoTaskMetadata, removeMemoTaskMetadata } from "./memo-task-metadata";
import { memoTaskIdentityPlugin } from "./memo-task-identity";
import { getExtensionField } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";

const parseTaskMarkdown = getExtensionField(TaskItem, "parseMarkdown")!;
const renderTaskMarkdown = getExtensionField(TaskItem, "renderMarkdown")!;

function hasTaskText(node: Node) {
  return node.content.content.some(block => !LIST_TYPES.has(block.type.name) && block.textContent.trim().length > 0);
}

export const DailyMemoTaskList = TaskList.extend({
  markdownTokenizer: memoTaskListTokenizer,
});

export const DailyMemoTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      memoTaskId: {
        default: null,
        keepOnSplit: false,
        parseHTML: element => {
          const id = element.getAttribute("data-memo-task-id");
          return id && /^[A-Za-z0-9_-]{21}$/.test(id) ? id : null;
        },
        renderHTML: attributes => attributes.memoTaskId ? { "data-memo-task-id": attributes.memoTaskId } : {},
      },
      completedAt: {
        default: null,
        keepOnSplit: false,
        parseHTML: element => {
          const value = element.getAttribute("data-memo-task-completed-at") ?? "";
          return /^[1-9]\d{0,12}$/.test(value) ? Number(value) : null;
        },
        renderHTML: attributes => attributes.checked && attributes.completedAt ? { "data-memo-task-completed-at": attributes.completedAt } : {},
      },
    };
  },
  parseMarkdown(token, helpers) {
    const metadata = readMemoTaskMetadata(token.tokens);
    const text = metadata ? String(token.text ?? "").slice(metadata.marker.length).replace(/^ /, "") : token.text;
    const tokens = removeMemoTaskMetadata(token.tokens ?? []);
    const empty = !String(text ?? "").trim() && tokens.every(part => part.type === "text" && !String(part.text ?? "").trim());
    const parsed = parseTaskMarkdown({ ...token, tokens: empty ? [] : tokens, text: empty ? "" : text }, helpers);
    if (metadata && !Array.isArray(parsed)) parsed.attrs = { ...parsed.attrs, memoTaskId: metadata.id, completedAt: token.checked ? metadata.completedAt : null };
    return parsed;
  },
  renderMarkdown(node, helpers, context) {
    const rendered = renderTaskMarkdown(node, helpers, context);
    if (!node.attrs?.memoTaskId) return rendered;
    return rendered.replace(/^(- \[[ xX]\] )/, `$1${memoTaskMarker(node.attrs.memoTaskId, node.attrs.checked ? node.attrs.completedAt : null)} `);
  },
  addProseMirrorPlugins() {
    return [...this.parent?.() ?? [], memoTaskIdentityPlugin()];
  },
  addNodeView() {
    const createNodeView = this.parent!()!;

    return (props) => {
      const nodeView = createNodeView(props);
      const checkbox = (nodeView.dom as HTMLElement).querySelector<HTMLInputElement>(
        'input[type="checkbox"]',
      )!;

      // Reuse the upstream view, but prevent touch taps from activating the editor.
      const checkboxWrapper = checkbox.parentElement!;
      checkbox.disabled = !hasTaskText(props.node);
      checkboxWrapper.addEventListener("pointerdown", (event) => {
        event.preventDefault();
      });
      checkboxWrapper.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      checkbox.addEventListener("change", (event) => {
        if (
          !props.editor.isEditable &&
          !this.options.onReadOnlyChecked?.(props.node, checkbox.checked)
        ) {
          return;
        }

        // The upstream change handler focuses the editor, reopening the keyboard
        // and restoring its old caret position. Update only the task attribute.
        event.stopImmediatePropagation();
        const position = props.getPos();
        if (typeof position !== "number") {
          return;
        }
        const { state, view } = props.editor;
        const currentNode = state.doc.nodeAt(position);
        if (currentNode?.type !== props.node.type) {
          return;
        }
        if (!hasTaskText(currentNode)) {
          checkbox.checked = Boolean(currentNode.attrs.checked);
          return;
        }
        view.dispatch(state.tr.setNodeMarkup(position, undefined, {
          ...currentNode.attrs,
          checked: checkbox.checked,
          memoTaskId: currentNode.attrs.memoTaskId || nanoid(),
          completedAt: checkbox.checked ? Date.now() : null,
        }));
      }, true);

      return {
        ...nodeView,
        update: (node, decorations, innerDecorations) => {
          if (!nodeView.update?.(node, decorations, innerDecorations)) return false;
          checkbox.disabled = !hasTaskText(node);
          return true;
        },
        // Let native checkbox activation run without ProseMirror placing a caret.
        stopEvent: (event) =>
          (event.target instanceof globalThis.Node && checkboxWrapper.contains(event.target)) ||
          nodeView.stopEvent?.(event) || false,
      };
    };
  },
}).configure({
  nested: true,
  onReadOnlyChecked: () => false,
  a11y: {
    checkboxLabel: (_node, checked) =>
      getText(
        checked
          ? "dailyMemo.syntaxToolbar.uncheckTask"
          : "dailyMemo.syntaxToolbar.checkTask",
      ),
  },
});
