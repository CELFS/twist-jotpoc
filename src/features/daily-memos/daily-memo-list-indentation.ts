import { Fragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  liftListItem as liftStandardListItem,
  sinkListItem as sinkStandardListItem,
} from "@tiptap/pm/schema-list";
import type { EditorState } from "@tiptap/pm/state";
import {
  getListContext,
  LIST_ITEM_TYPES,
  LIST_TYPES,
  setMovedSelection,
  type ListContext,
  type TransactionDispatch,
} from "@/features/daily-memos/daily-memo-list-model";

function isNestedListContext(state: EditorState, context: ListContext) {
  const parentItemDepth = context.listDepth - 1;
  const outerListDepth = parentItemDepth - 1;

  return (
    parentItemDepth > 0 &&
    outerListDepth >= 0 &&
    LIST_ITEM_TYPES.has(state.selection.$from.node(parentItemDepth).type.name) &&
    LIST_TYPES.has(state.selection.$from.node(outerListDepth).type.name)
  );
}

function createSunkListBlocks(
  targetList: ProseMirrorNode,
  targetItemType: ProseMirrorNode["type"],
  sourceItems: readonly ProseMirrorNode[],
) {
  const listBlocks: ProseMirrorNode[] = [];
  let targetListContent = targetList.content;

  const flushTargetList = () => {
    if (targetListContent.size === 0) {
      return;
    }

    listBlocks.push(targetList.copy(targetListContent));
    targetListContent = Fragment.empty;
  };

  for (const sourceItem of sourceItems) {
    const itemChildren: ProseMirrorNode[] = [];
    const releasedLists: ProseMirrorNode[] = [];

    sourceItem.forEach((child) => {
      if (LIST_TYPES.has(child.type.name)) {
        releasedLists.push(child);
      } else {
        itemChildren.push(child);
      }
    });

    const itemContent = Fragment.fromArray(itemChildren);

    if (!targetItemType.validContent(itemContent)) {
      return null;
    }

    const movedItem =
      sourceItem.type === targetItemType
        ? sourceItem.copy(itemContent)
        : targetItemType.create(
            targetItemType.name === "taskItem" ? { checked: false } : null,
            itemContent,
          );

    targetListContent = targetListContent.append(Fragment.from(movedItem));

    for (const releasedList of releasedLists) {
      if (
        releasedList.type === targetList.type &&
        releasedList.firstChild?.type === targetItemType
      ) {
        targetListContent = targetListContent.append(releasedList.content);
        continue;
      }

      flushTargetList();
      listBlocks.push(releasedList);
    }
  }

  flushTargetList();
  return listBlocks;
}

function sinkListItemAcrossTypes(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context) {
    return false;
  }

  const { $from } = state.selection;
  const { endIndex, itemDepth, listDepth, startIndex } = context;
  const currentList = $from.node(listDepth);
  const containerDepth = listDepth - 1;
  const container = $from.node(containerDepth);
  const currentListIndex = $from.index(containerDepth);

  if (startIndex !== 0 || currentListIndex === 0) {
    return false;
  }

  const previousList = container.child(currentListIndex - 1);
  const previousItem = previousList.lastChild;

  if (
    !LIST_TYPES.has(previousList.type.name) ||
    !previousItem ||
    !LIST_ITEM_TYPES.has(previousItem.type.name)
  ) {
    return false;
  }

  const existingNestedList =
    previousItem.lastChild?.type === currentList.type
      ? previousItem.lastChild
      : null;
  const targetList = existingNestedList
    ? existingNestedList
    : currentList.type.create(currentList.attrs);
  const targetItemType = currentList.firstChild?.type;
  let selectedItemsSize = 0;
  const sourceItems: ProseMirrorNode[] = [];

  for (let index = startIndex; index < endIndex; index += 1) {
    const item = currentList.child(index);

    selectedItemsSize += item.nodeSize;
    sourceItems.push(item);
  }

  if (!targetItemType) {
    return false;
  }

  const nestedListBlocks = createSunkListBlocks(
    targetList,
    targetItemType,
    sourceItems,
  );

  if (!nestedListBlocks) {
    return false;
  }

  const previousItemChildren: ProseMirrorNode[] = [];

  previousItem.forEach((child, _offset, index) => {
    if (existingNestedList && index === previousItem.childCount - 1) {
      previousItemChildren.push(...nestedListBlocks);
    } else {
      previousItemChildren.push(child);
    }
  });

  if (!existingNestedList) {
    previousItemChildren.push(...nestedListBlocks);
  }

  const previousItemContent = Fragment.fromArray(previousItemChildren);

  if (!previousItem.type.validContent(previousItemContent)) {
    return false;
  }

  const updatedPreviousItem = previousItem.copy(previousItemContent);
  const updatedPreviousList = previousList.copy(
    previousList.content.replaceChild(
      previousList.childCount - 1,
      updatedPreviousItem,
    ),
  );
  const remainingCurrentListContent = currentList.content.cut(selectedItemsSize);
  const replacement = Fragment.fromArray([
    updatedPreviousList,
    ...(remainingCurrentListContent.size > 0
      ? [currentList.copy(remainingCurrentListContent)]
      : []),
  ]);

  if (
    !container.canReplace(
      currentListIndex - 1,
      currentListIndex + 1,
      replacement,
    )
  ) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  const currentListStart = $from.before(listDepth);
  const currentItemStart = $from.before(itemDepth);
  const previousListStart = currentListStart - previousList.nodeSize;
  const previousItemStart =
    previousListStart +
    1 +
    previousList.content.size -
    previousItem.nodeSize;
  const nestedListStart = existingNestedList
    ? previousItemStart +
      1 +
      previousItem.content.size -
      existingNestedList.nodeSize
    : previousItemStart + 1 + previousItem.content.size;
  const movedItemStart =
    nestedListStart + 1 + (existingNestedList?.content.size ?? 0);
  const transaction = state.tr.replaceWith(
    previousListStart,
    currentListStart + currentList.nodeSize,
    replacement,
  );

  setMovedSelection(
    transaction,
    state,
    currentItemStart,
    movedItemStart,
  );
  dispatch(transaction.scrollIntoView());
  return true;
}

function sinkListItemsIntoPreviousItem(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context || context.startIndex === 0) {
    return false;
  }

  const { $from } = state.selection;
  const { endIndex, itemDepth, listDepth, startIndex } = context;
  const currentList = $from.node(listDepth);
  const previousItem = currentList.child(startIndex - 1);
  const existingTargetList = LIST_TYPES.has(
    previousItem.lastChild?.type.name ?? "",
  )
    ? previousItem.lastChild
    : null;
  const targetList = existingTargetList
    ? existingTargetList
    : currentList.type.create(currentList.attrs);

  const targetItemType = existingTargetList?.firstChild?.type ?? currentList.firstChild?.type;

  if (!targetItemType || !LIST_ITEM_TYPES.has(targetItemType.name)) {
    return false;
  }

  const sourceItems: ProseMirrorNode[] = [];

  for (let index = startIndex; index < endIndex; index += 1) {
    sourceItems.push(currentList.child(index));
  }

  const nestedListBlocks = createSunkListBlocks(
    targetList,
    targetItemType,
    sourceItems,
  );

  if (!nestedListBlocks) {
    return false;
  }

  const previousItemChildren: ProseMirrorNode[] = [];

  previousItem.forEach((child, _offset, index) => {
    if (existingTargetList && index === previousItem.childCount - 1) {
      previousItemChildren.push(...nestedListBlocks);
    } else {
      previousItemChildren.push(child);
    }
  });

  if (!existingTargetList) {
    previousItemChildren.push(...nestedListBlocks);
  }

  const updatedPreviousItem = previousItem.copy(
    Fragment.fromArray(previousItemChildren),
  );

  if (!previousItem.type.validContent(updatedPreviousItem.content)) {
    return false;
  }
  const currentListChildren: ProseMirrorNode[] = [];

  currentList.forEach((item, _offset, index) => {
    if (index === startIndex - 1) {
      currentListChildren.push(updatedPreviousItem);
    } else if (index < startIndex || index >= endIndex) {
      currentListChildren.push(item);
    }
  });

  const updatedCurrentListContent = Fragment.fromArray(currentListChildren);

  if (!currentList.type.validContent(updatedCurrentListContent)) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  const currentListStart = $from.before(listDepth);
  const currentItemStart = $from.before(itemDepth);
  let previousItemOffset = 0;

  for (let index = 0; index < startIndex - 1; index += 1) {
    previousItemOffset += currentList.child(index).nodeSize;
  }

  const previousItemStart = currentListStart + 1 + previousItemOffset;
  const targetListStart =
    previousItemStart + 1 + previousItem.content.size -
    (existingTargetList?.nodeSize ?? 0);
  const movedItemStart = targetListStart + 1 + targetList.content.size;
  const updatedCurrentList = currentList.copy(updatedCurrentListContent);
  const transaction = state.tr.replaceWith(
    currentListStart,
    currentListStart + currentList.nodeSize,
    updatedCurrentList,
  );

  setMovedSelection(
    transaction,
    state,
    currentItemStart,
    movedItemStart,
  );
  dispatch(transaction.scrollIntoView());
  return true;
}

function liftNestedListItems(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context) {
    return false;
  }

  const { $from } = state.selection;
  const { endIndex, itemDepth, listDepth, startIndex } = context;
  const parentItemDepth = listDepth - 1;
  const outerListDepth = parentItemDepth - 1;

  if (
    parentItemDepth <= 0 ||
    !LIST_ITEM_TYPES.has($from.node(parentItemDepth).type.name) ||
    !LIST_TYPES.has($from.node(outerListDepth).type.name)
  ) {
    return false;
  }

  const currentList = $from.node(listDepth);
  const parentItem = $from.node(parentItemDepth);
  const outerList = $from.node(outerListDepth);
  const targetItemType = outerList.firstChild?.type;

  if (!targetItemType || !LIST_ITEM_TYPES.has(targetItemType.name)) {
    return false;
  }

  const nestedListIndex = $from.index(parentItemDepth);
  const outerItemIndex = $from.index(outerListDepth);
  const earlierItems: ProseMirrorNode[] = [];
  const laterItems: ProseMirrorNode[] = [];
  const liftedItems: ProseMirrorNode[] = [];

  currentList.forEach((item, _offset, index) => {
    if (index < startIndex) {
      earlierItems.push(item);
      return;
    }

    if (index >= endIndex) {
      laterItems.push(item);
      return;
    }

    if (item.type === targetItemType) {
      liftedItems.push(item);
      return;
    }

    if (!targetItemType.validContent(item.content)) {
      return;
    }

    liftedItems.push(
      targetItemType.create(
        targetItemType.name === "taskItem" ? { checked: false } : null,
        item.content,
      ),
    );
  });

  if (liftedItems.length !== endIndex - startIndex) {
    return false;
  }

  if (laterItems.length > 0) {
    const lastLiftedItemIndex = liftedItems.length - 1;
    const lastLiftedItem = liftedItems[lastLiftedItemIndex];
    const existingNestedList =
      lastLiftedItem.lastChild?.type === currentList.type
        ? lastLiftedItem.lastChild
        : null;
    const laterItemsFragment = Fragment.fromArray(laterItems);
    const nestedList = existingNestedList
      ? existingNestedList.copy(
          existingNestedList.content.append(laterItemsFragment),
        )
      : currentList.copy(laterItemsFragment);
    const lastLiftedItemContent = existingNestedList
      ? lastLiftedItem.content.replaceChild(
          lastLiftedItem.childCount - 1,
          nestedList,
        )
      : lastLiftedItem.content.append(Fragment.from(nestedList));

    if (!lastLiftedItem.type.validContent(lastLiftedItemContent)) {
      return false;
    }

    liftedItems[lastLiftedItemIndex] = lastLiftedItem.copy(
      lastLiftedItemContent,
    );
  }

  const parentItemChildren: ProseMirrorNode[] = [];

  parentItem.forEach((child, _offset, index) => {
    if (index !== nestedListIndex) {
      parentItemChildren.push(child);
      return;
    }

    if (earlierItems.length > 0) {
      parentItemChildren.push(
        currentList.copy(Fragment.fromArray(earlierItems)),
      );
    }
  });

  const updatedParentItemContent = Fragment.fromArray(parentItemChildren);

  if (!parentItem.type.validContent(updatedParentItemContent)) {
    return false;
  }

  const updatedParentItem = parentItem.copy(updatedParentItemContent);
  const outerListChildren: ProseMirrorNode[] = [];

  outerList.forEach((child, _offset, index) => {
    if (index !== outerItemIndex) {
      outerListChildren.push(child);
      return;
    }

    outerListChildren.push(updatedParentItem, ...liftedItems);
  });

  const updatedOuterListContent = Fragment.fromArray(outerListChildren);

  if (!outerList.type.validContent(updatedOuterListContent)) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  const currentItemStart = $from.before(itemDepth);
  const outerListStart = $from.before(outerListDepth);
  let movedItemStart = outerListStart + 1;

  for (let index = 0; index < outerItemIndex; index += 1) {
    movedItemStart += outerList.child(index).nodeSize;
  }

  movedItemStart += updatedParentItem.nodeSize;
  const updatedOuterList = outerList.copy(updatedOuterListContent);
  const transaction = state.tr.replaceWith(
    outerListStart,
    outerListStart + outerList.nodeSize,
    updatedOuterList,
  );

  setMovedSelection(
    transaction,
    state,
    currentItemStart,
    movedItemStart,
  );
  dispatch(transaction.scrollIntoView());
  return true;
}

export function sinkMemoListItem(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context) {
    return false;
  }

  const itemType = state.selection.$from.node(context.itemDepth).type;

  return (
    sinkListItemsIntoPreviousItem(state, dispatch) ||
    sinkStandardListItem(itemType)(state, dispatch) ||
    sinkListItemAcrossTypes(state, dispatch)
  );
}

export function liftMemoListItem(
  state: EditorState,
  dispatch?: TransactionDispatch,
) {
  const context = getListContext(state);

  if (!context) {
    return false;
  }

  const itemType = state.selection.$from.node(context.itemDepth).type;

  if (!isNestedListContext(state, context)) {
    return liftStandardListItem(itemType)(state, dispatch);
  }

  return (
    liftNestedListItems(state, dispatch) ||
    liftStandardListItem(itemType)(state, dispatch)
  );
}
