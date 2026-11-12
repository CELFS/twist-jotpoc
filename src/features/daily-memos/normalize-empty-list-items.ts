import { createMemoMarkdownManager } from "@/features/daily-memos/daily-memo-markdown";
import { Fragment, type Node } from "@tiptap/pm/model";
import {
  getSchema,
  type Editor,
  type Extensions,
  type JSONContent,
} from "@tiptap/react";
import {
  isMemoListMarkerPlaceholder,
  restoreMemoListMarkerPlaceholdersInMarkdown,
} from "@/features/daily-memos/daily-memo-list-placeholder-codec";
import {
  LIST_ITEM_TYPES,
  LIST_TYPES,
} from "@/features/daily-memos/daily-memo-list-model";

function splitListMarkerPlaceholders(list: Node): Node[] {
  if (!LIST_TYPES.has(list.type.name)) {
    return [list];
  }

  const listStart = Number(list.attrs.start ?? 1);
  const segments: Node[] = [];
  let nextStart = listStart;
  let regularItems: Node[] = [];
  let foundPlaceholder = false;

  const createSegment = (
    items: readonly Node[],
    markerPlaceholder: boolean,
  ) => {
    const attrs = {
      ...list.attrs,
      memoListMarkerPlaceholder: markerPlaceholder,
      ...(list.type.name === "orderedList" ? { start: nextStart } : {}),
    };

    return list.type.create(attrs, Fragment.fromArray(items));
  };
  const flushRegularItems = () => {
    if (regularItems.length === 0) {
      return;
    }

    segments.push(createSegment(regularItems, false));
    nextStart += regularItems.length;
    regularItems = [];
  };

  list.forEach((item) => {
    const paragraph = item.firstChild;

    if (
      !paragraph ||
      paragraph.type.name !== "paragraph" ||
      !isMemoListMarkerPlaceholder(paragraph.textContent)
    ) {
      regularItems.push(item);
      return;
    }

    foundPlaceholder = true;
    flushRegularItems();
    const emptyParagraph = paragraph.type.create(paragraph.attrs);
    const placeholderItem = item.copy(
      item.content.replaceChild(0, emptyParagraph),
    );

    segments.push(createSegment([placeholderItem], true));
  });

  if (!foundPlaceholder) {
    return [list];
  }

  flushRegularItems();

  return segments;
}

function splitTrailingEmptyOrderedListItems(
  listItem: Node,
  nextNumber: number,
): Node[] | null {
  if (
    listItem.type.name !== "listItem" ||
    listItem.childCount !== 1 ||
    listItem.firstChild?.type.name !== "paragraph" ||
    !listItem.firstChild.content.content.every((child) => child.isText)
  ) {
    return null;
  }

  const paragraph = listItem.firstChild;
  const lines = paragraph.textContent.split("\n");
  let markerStart = -1;

  for (let index = 1; index < lines.length; index += 1) {
    const trailingLines = lines.slice(index);
    const allMarkersContinuous = trailingLines.every(
      (line, markerIndex) => line === `${nextNumber + markerIndex}.`,
    );

    if (allMarkersContinuous) {
      markerStart = index;
      break;
    }
  }

  if (markerStart < 0) {
    return null;
  }

  const paragraphText = lines.slice(0, markerStart).join("\n");
  const normalizedParagraph = paragraphText
    ? paragraph.cut(0, paragraphText.length)
    : paragraph.type.create();
  const normalizedListItem = listItem.copy(
    Fragment.from(normalizedParagraph),
  );
  const emptyListItems = lines.slice(markerStart).map(() =>
    listItem.type.create(
      listItem.attrs,
      paragraph.type.create(),
    ),
  );

  return [normalizedListItem, ...emptyListItems];
}

export function normalizeEmptyListDocument(node: Node): Node {
  let changed = false;
  const normalizedChildren: Node[] = [];

  node.forEach((child) => {
    const normalizedChild = normalizeEmptyListDocument(child);
    const splitChildren = splitListMarkerPlaceholders(normalizedChild);

    normalizedChildren.push(...splitChildren);
    changed ||=
      normalizedChild !== child ||
      splitChildren.length !== 1 ||
      splitChildren[0] !== normalizedChild;
  });

  let normalizedNode = changed
    ? node.copy(Fragment.fromArray(normalizedChildren))
    : node;

  if (
    LIST_ITEM_TYPES.has(normalizedNode.type.name) &&
    normalizedNode.firstChild?.type.name !== "paragraph"
  ) {
    normalizedNode = normalizedNode.copy(
      Fragment.from(normalizedNode.type.schema.nodes.paragraph.create()).append(
        normalizedNode.content,
      ),
    );
  }

  if (normalizedNode.type.name !== "orderedList") {
    return normalizedNode;
  }

  const listStart = Number(normalizedNode.attrs.start ?? 1);
  const listItems: Node[] = [];
  let split = false;

  normalizedNode.forEach((listItem, _offset, index) => {
    const splitItems = splitTrailingEmptyOrderedListItems(
      listItem,
      listStart + index + 1,
    );

    if (splitItems) {
      listItems.push(...splitItems);
      split = true;
      return;
    }

    listItems.push(listItem);
  });

  return split
    ? normalizedNode.copy(Fragment.fromArray(listItems))
    : normalizedNode;
}

export function parseNormalizedMemoMarkdown(
  content: string,
  extensions: Extensions,
): JSONContent {
  const markdownManager = createMemoMarkdownManager({ extensions });
  const schema = getSchema(extensions);
  const document = schema.nodeFromJSON(
    markdownManager.parse(
      restoreMemoListMarkerPlaceholdersInMarkdown(content),
    ),
  );

  return normalizeEmptyListDocument(document).toJSON();
}

export function normalizeEmptyListItems(editor: Editor): boolean {
  const normalizedDocument = normalizeEmptyListDocument(editor.state.doc);

  if (normalizedDocument.eq(editor.state.doc)) {
    return false;
  }

  editor.view.dispatch(
    editor.state.tr.replaceWith(
      0,
      editor.state.doc.content.size,
      normalizedDocument.content,
    ),
  );
  return true;
}
