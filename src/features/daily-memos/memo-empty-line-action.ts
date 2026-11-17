import { Extension } from "@tiptap/react";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

type MemoEmptyLineActionOptions = Record<string, never>;

export const MemoEmptyLineAction = Extension.create<MemoEmptyLineActionOptions>({
  name: "memoEmptyLineAction",

  addOptions() {
    return {
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("memoEmptyLineAction");
    const activateTopInsertion = (view: EditorView, event: Event) => {
      const pointerEvent = event as MouseEvent;
      const firstBlock = Array.from(view.dom.children).find(
        (element) =>
          !element.classList.contains("ProseMirror-gapcursor") &&
          !element.classList.contains("daily-memo-empty-line--gap"),
      );

      if (!firstBlock || pointerEvent.button !== 0) {
        return false;
      }

      // Text paragraphs already provide a caret; a top gap is only needed before an atomic block.
      if (view.state.doc.firstChild?.isTextblock) {
        return false;
      }

      const editorRect = view.dom.getBoundingClientRect();
      const firstBlockRect = firstBlock.getBoundingClientRect();

      if (
        pointerEvent.clientY < editorRect.top ||
        pointerEvent.clientY >= firstBlockRect.top
      ) {
        return false;
      }

      if (!view.editable) return false;

      pointerEvent.preventDefault();
      // The gap belongs to the root editor, even when a block body owns focus.
      view.dispatch(
        view.state.tr.setSelection(new GapCursor(view.state.doc.resolve(0)))
          .setMeta(pluginKey, { focused: true }),
      );
      view.focus();
      return true;
    };

    return [
      new Plugin({
        key: pluginKey,
        state: {
          apply(transaction, focused) {
            return transaction.getMeta(pluginKey)?.focused ?? focused;
          },
          init: () => false,
        },
        props: {
          handleDOMEvents: {
            blur: (view) => {
              const activeElement = document.activeElement;
              if (
                activeElement instanceof Element &&
                activeElement.closest(".daily-memo-empty-line-action")
              ) {
                return false;
              }

              view.dispatch(view.state.tr.setMeta(pluginKey, { focused: false }));
              return false;
            },
            focus: (view) => {
              view.dispatch(view.state.tr.setMeta(pluginKey, { focused: true }));
              return false;
            },
            mousedown: activateTopInsertion,
            pointerdown: activateTopInsertion,
          },
          decorations: (state) => {
            if (!pluginKey.getState(state)) {
              return DecorationSet.empty;
            }

            const { $from } = state.selection;

            if (
              state.selection instanceof GapCursor &&
              $from.depth === 0
            ) {
              return DecorationSet.create(state.doc, [
                Decoration.widget(
                  $from.pos,
                  () => {
                    const element = document.createElement("div");
                    element.className =
                      "daily-memo-empty-line daily-memo-empty-line--gap";
                    element.contentEditable = "false";
                    element.setAttribute("aria-hidden", "true");
                    return element;
                  },
                  {
                    key: `daily-memo-empty-line-gap-${$from.pos}`,
                    side: -1,
                  },
                ),
              ]);
            }

            if (
              $from.depth !== 1 ||
              !$from.parent.isTextblock ||
              $from.parent.type.name !== "paragraph" ||
              $from.parent.content.size !== 0
            ) {
              return DecorationSet.empty;
            }

            for (let depth = 1; depth < $from.depth; depth += 1) {
              if ($from.node(depth).type.name === "memoInfoBlock") {
                return DecorationSet.empty;
              }
            }

            const position = $from.before($from.depth);
            return DecorationSet.create(state.doc, [
              Decoration.node(
                position,
                position + $from.parent.nodeSize,
                { class: "daily-memo-empty-line" },
              ),
            ]);
          },
        },
      }),
    ];
  },
});
