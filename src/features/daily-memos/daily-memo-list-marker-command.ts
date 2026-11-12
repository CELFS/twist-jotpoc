import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { liftListItem } from "@tiptap/pm/schema-list";
import { Selection, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import {
  getListContext,
  LIST_ITEM_TYPES,
  LIST_TYPES,
  type TransactionDispatch,
} from "@/features/daily-memos/daily-memo-list-model";

function appendChildListsToLastItem(
  list: ProseMirrorNode,
  childLists: readonly ProseMirrorNode[],
) {
  const lastItem = list.lastChild;

  if (!lastItem || !LIST_ITEM_TYPES.has(lastItem.type.name)) {
    return null;
  }

  const itemChildren: ProseMirrorNode[] = [];

  lastItem.forEach((child) => {
    itemChildren.push(child);
  });

  for (const childList of childLists) {
    const lastChild = itemChildren.at(-1);

    if (lastChild?.type === childList.type) {
      itemChildren[itemChildren.length - 1] = lastChild.copy(
        lastChild.content.append(childList.content),
      );
    } else {
      itemChildren.push(childList);
    }
  }

  const itemContent = Fragment.fromArray(itemChildren);

  if (!lastItem.type.validContent(itemContent)) {
    return null;
  }

  return list.copy(
    list.content.replaceChild(
      list.childCount - 1,
      lastItem.copy(itemContent),
    ),
  );
}

function canMergeAdjacentLists(
  previousList: ProseMirrorNode,
  nextList: ProseMirrorNode,
) {
  if (previousList.type !== nextList.type) {
    return false;
  }

  if (previousList.type.name !== "orderedList") {
    return true;
  }

  return (
    Number(nextList.attrs.start ?? 1) ===
    Number(previousList.attrs.start ?? 1) + previousList.childCount
  );
}

function createListMarkerPlaceholder(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context || !state.selection.empty || context.startIndex === 0) {
    return false;
  }

  const { $from } = state.selection;
  const currentList = $from.node(context.listDepth);
  const currentItem = currentList.child(context.startIndex);
  const paragraph = currentItem.firstChild;

  if (
    !LIST_TYPES.has(currentList.type.name) ||
    currentList.attrs.memoListMarkerPlaceholder ||
    context.endIndex !== context.startIndex + 1 ||
    !paragraph ||
    paragraph.type.name !== "paragraph" ||
    paragraph.content.size !== 0 ||
    $from.parent !== paragraph ||
    $from.parentOffset !== 0
  ) {
    return false;
  }

  for (let index = 1; index < currentItem.childCount; index += 1) {
    if (!LIST_TYPES.has(currentItem.child(index).type.name)) {
      return false;
    }
  }

  const beforeItems: ProseMirrorNode[] = [];
  const afterItems: ProseMirrorNode[] = [];

  currentList.forEach((item, _offset, index) => {
    if (index < context.startIndex) {
      beforeItems.push(item);
    } else if (index > context.startIndex) {
      afterItems.push(item);
    }
  });

  const replacementNodes: ProseMirrorNode[] = [];

  if (beforeItems.length > 0) {
    replacementNodes.push(
      currentList.type.create(
        {
          ...currentList.attrs,
          memoListMarkerPlaceholder: false,
        },
        Fragment.fromArray(beforeItems),
      ),
    );
  }

  const placeholderListAttrs = {
    ...currentList.attrs,
    memoListMarkerPlaceholder: true,
    ...(currentList.type.name === "orderedList"
      ? {
          start:
            Number(currentList.attrs.start ?? 1) + context.startIndex,
        }
      : {}),
  };
  const placeholderList = currentList.type.create(
    placeholderListAttrs,
    Fragment.from(currentItem),
  );
  replacementNodes.push(placeholderList);

  if (afterItems.length > 0) {
    replacementNodes.push(
      currentList.type.create(
        {
          ...currentList.attrs,
          memoListMarkerPlaceholder: false,
          ...(currentList.type.name === "orderedList"
            ? {
                start:
                  Number(currentList.attrs.start ?? 1) + context.startIndex,
              }
            : {}),
        },
        Fragment.fromArray(afterItems),
      ),
    );
  }

  const replacement = Fragment.fromArray(replacementNodes);
  const containerDepth = context.listDepth - 1;
  const container = $from.node(containerDepth);
  const listIndex = $from.index(containerDepth);

  if (!container.canReplace(listIndex, listIndex + 1, replacement)) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  const listStart = $from.before(context.listDepth);
  const beforeListSize = replacementNodes[0] === placeholderList
    ? 0
    : replacementNodes[0].nodeSize;
  const placeholderListStart = listStart + beforeListSize;
  const transaction = state.tr.replaceWith(
    listStart,
    listStart + currentList.nodeSize,
    replacement,
  );

  transaction.setSelection(
    TextSelection.create(transaction.doc, placeholderListStart + 3),
  );
  dispatch(transaction.scrollIntoView());
  return true;
}

function removeListMarkerPlaceholder(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context || !state.selection.empty) {
    return false;
  }

  const { $from } = state.selection;
  const currentList = $from.node(context.listDepth);
  const currentItem = currentList.child(context.startIndex);
  const paragraph = currentItem.firstChild;

  if (
    !LIST_TYPES.has(currentList.type.name) ||
    !currentList.attrs.memoListMarkerPlaceholder ||
    currentList.childCount !== 1 ||
    !paragraph ||
    paragraph.type.name !== "paragraph" ||
    paragraph.content.size !== 0 ||
    $from.parent !== paragraph ||
    $from.parentOffset !== 0
  ) {
    return false;
  }

  const childLists: ProseMirrorNode[] = [];

  for (let index = 1; index < currentItem.childCount; index += 1) {
    const child = currentItem.child(index);

    if (!LIST_TYPES.has(child.type.name)) {
      return false;
    }

    childLists.push(child);
  }

  const containerDepth = context.listDepth - 1;
  const container = $from.node(containerDepth);
  const listIndex = $from.index(containerDepth);
  const previousList = listIndex > 0 ? container.child(listIndex - 1) : null;
  const nextList =
    listIndex < container.childCount - 1
      ? container.child(listIndex + 1)
      : null;
  const previousListWithChildren =
    childLists.length > 0 && previousList?.type === currentList.type
      ? appendChildListsToLastItem(previousList, childLists)
      : null;

  const canMergeLists =
    childLists.length === 0 &&
    previousList &&
    nextList &&
    canMergeAdjacentLists(previousList, nextList);
  const replacement = previousListWithChildren
    ? Fragment.from(previousListWithChildren)
    : canMergeLists
      ? Fragment.from(
          previousList.copy(previousList.content.append(nextList.content)),
        )
      : Fragment.fromArray(childLists);
  const replaceFromIndex =
    previousListWithChildren || canMergeLists ? listIndex - 1 : listIndex;
  const replaceToIndex = previousListWithChildren
    ? listIndex + 1
    : canMergeLists
      ? listIndex + 2
      : listIndex + 1;

  if (!container.canReplace(replaceFromIndex, replaceToIndex, replacement)) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  const placeholderListStart = $from.before(context.listDepth);
  const replaceFrom = previousListWithChildren || canMergeLists
    ? placeholderListStart - (previousList?.nodeSize ?? 0)
    : placeholderListStart;
  const replaceTo = previousListWithChildren
    ? placeholderListStart + currentList.nodeSize
    : canMergeLists
    ? placeholderListStart +
      currentList.nodeSize +
      (nextList?.nodeSize ?? 0)
    : placeholderListStart + currentList.nodeSize;
  const transaction = state.tr.replaceWith(
    replaceFrom,
    replaceTo,
    replacement,
  );

  if (previousList?.lastChild?.firstChild) {
    const previousListStart = previousListWithChildren || canMergeLists
      ? replaceFrom
      : placeholderListStart - previousList.nodeSize;
    let previousItemStart = previousListStart + 1;

    for (let index = 0; index < previousList.childCount - 1; index += 1) {
      previousItemStart += previousList.child(index).nodeSize;
    }

    transaction.setSelection(
      TextSelection.create(
        transaction.doc,
        previousItemStart +
          2 +
          previousList.lastChild.firstChild.content.size,
      ),
    );
  } else {
    transaction.setSelection(
      Selection.near(transaction.doc.resolve(replaceFrom)),
    );
  }

  dispatch(transaction.scrollIntoView());
  return true;
}

export function removeLeadingEmptyCheckbox(state: EditorState, dispatch?: TransactionDispatch) {
  const cursor = state.selection instanceof TextSelection ? state.selection.$cursor : null;
  if (!cursor || cursor.depth !== 3 || cursor.parent.content.size !== 0 ||
    cursor.node(1).type.name !== "taskList" || !state.selection.eq(Selection.atStart(state.doc))) {
    return false;
  }

  return liftListItem(cursor.node(2).type)(state, dispatch);
}

export function handleMemoListBackspace(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  return (
    removeLeadingEmptyCheckbox(state, dispatch) ||
    removeListMarkerPlaceholder(state, dispatch) ||
    createListMarkerPlaceholder(state, dispatch)
  );
}
