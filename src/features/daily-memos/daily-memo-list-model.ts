import { Selection, TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

export const LIST_ITEM_TYPES = new Set(["listItem", "taskItem"]);
export const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);

export type ListContext = {
  endIndex: number;
  itemDepth: number;
  listDepth: number;
  startIndex: number;
};

export type TransactionDispatch = (transaction: Transaction) => void;

export function getListContext(state: EditorState): ListContext | null {
  const { $from, $to } = state.selection;
  const range = $from.blockRange(
    $to,
    (node) =>
      LIST_TYPES.has(node.type.name) &&
      node.childCount > 0 &&
      LIST_ITEM_TYPES.has(node.firstChild?.type.name ?? ""),
  );

  if (!range) {
    return null;
  }

  return {
    endIndex: range.endIndex,
    itemDepth: range.depth + 1,
    listDepth: range.depth,
    startIndex: range.startIndex,
  };
}

export function setMovedSelection(
  transaction: Transaction,
  state: EditorState,
  previousItemStart: number,
  nextItemStart: number,
) {
  if (state.selection instanceof TextSelection) {
    const nextAnchor = Math.min(
      Math.max(
        nextItemStart + state.selection.anchor - previousItemStart,
        0,
      ),
      transaction.doc.content.size,
    );
    const nextHead = Math.min(
      Math.max(
        nextItemStart + state.selection.head - previousItemStart,
        0,
      ),
      transaction.doc.content.size,
    );

    transaction.setSelection(
      TextSelection.between(
        transaction.doc.resolve(nextAnchor),
        transaction.doc.resolve(nextHead),
      ),
    );
    return;
  }

  transaction.setSelection(
    Selection.near(transaction.doc.resolve(nextItemStart + 1)),
  );
}
