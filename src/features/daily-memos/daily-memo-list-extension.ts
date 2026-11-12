import { Extension } from "@tiptap/react";
import {
  liftMemoListItem,
  sinkMemoListItem,
} from "@/features/daily-memos/daily-memo-list-indentation";
import { handleMemoListBackspace } from "@/features/daily-memos/daily-memo-list-marker-command";

export const DailyMemoListIndentation = Extension.create({
  name: "dailyMemoListIndentation",
  priority: 110,

  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList", "taskList"],
        attributes: {
          memoListMarkerPlaceholder: {
            default: false,
            parseHTML: (element) =>
              element.hasAttribute("data-memo-list-marker-placeholder"),
            renderHTML: (attributes) =>
              attributes.memoListMarkerPlaceholder
                ? { "data-memo-list-marker-placeholder": "true" }
                : {},
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        handleMemoListBackspace(this.editor.state, (transaction) => {
          this.editor.view.dispatch(transaction);
        }),
      Tab: () =>
        sinkMemoListItem(this.editor.state, (transaction) => {
          this.editor.view.dispatch(transaction);
        }),
      "Shift-Tab": () =>
        liftMemoListItem(this.editor.state, (transaction) => {
          this.editor.view.dispatch(transaction);
        }),
    };
  },
});
