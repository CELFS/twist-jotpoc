import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { JSONContent } from "@tiptap/react";
import {
  LIST_ITEM_TYPES,
  LIST_TYPES,
} from "@/features/daily-memos/daily-memo-list-model";

export const MEMO_LIST_MARKER_PLACEHOLDER =
  "<!--memo-list-marker-placeholder-->";

const MEMO_LIST_MARKER_PLACEHOLDER_PATTERN =
  /^<!--memo-list-marker-placeholder:(bulletList|orderedList|taskList):(\d+)-->$/;
const MEMO_LIST_MARKER_PLACEHOLDER_LINE_PATTERN =
  /^([\t ]*)<!--memo-list-marker-placeholder:(bulletList|orderedList|taskList):(\d+)-->[\t ]*$/gm;
const ESCAPED_MEMO_LIST_MARKER_PLACEHOLDER_PATTERN =
  /&lt;!--memo-list-marker-placeholder:(bulletList|orderedList|taskList):(\d+)--&gt;/g;
const SERIALIZED_MEMO_LIST_MARKER_PLACEHOLDER_LINE_PATTERN =
  /^([\t ]*)(?:\d+[.)]|[-+*](?:[\t ]+\[[ xX]\])?)[\t ]+(<!--memo-list-marker-placeholder:(?:bulletList|orderedList|taskList):\d+-->)[\t ]*$/gm;
const STORED_MEMO_LIST_MARKER_PLACEHOLDER_LINE_PATTERN =
  /^[\t ]*(?:(?:\d+[.)]|[-+*](?:[\t ]+\[[ xX]\])?)[\t ]+)?(?:<!--memo-list-marker-placeholder-->|<!--memo-list-marker-placeholder:(?:bulletList|orderedList|taskList):\d+-->)[\t ]*(?:\r?\n|$)/gm;

function createMemoListMarkerPlaceholder(
  listType: string,
  start: number,
) {
  return `<!--memo-list-marker-placeholder:${listType}:${start}-->`;
}

export function isMemoListMarkerPlaceholder(value: string) {
  return (
    value === MEMO_LIST_MARKER_PLACEHOLDER ||
    MEMO_LIST_MARKER_PLACEHOLDER_PATTERN.test(value)
  );
}

export function restoreMemoListMarkerPlaceholdersInMarkdown(
  content: string,
) {
  return content.replace(
    MEMO_LIST_MARKER_PLACEHOLDER_LINE_PATTERN,
    (_match, indentation: string, listType: string, start: string) => {
      const marker = listType === "orderedList"
        ? `${start}. `
        : listType === "taskList"
        ? "- [ ] "
        : "- ";
      const placeholder = createMemoListMarkerPlaceholder(
        listType,
        Number(start),
      );
      const escapedPlaceholder = placeholder
        .replace("<", "&lt;")
        .replace(">", "&gt;");

      return `${indentation}${marker}${escapedPlaceholder}`;
    },
  );
}

export function stripMemoListMarkerPlaceholders(content: string) {
  return content
    .replace(STORED_MEMO_LIST_MARKER_PLACEHOLDER_LINE_PATTERN, "")
    .replaceAll(MEMO_LIST_MARKER_PLACEHOLDER, "")
    .replace(
      /<!--memo-list-marker-placeholder:(?:bulletList|orderedList|taskList):\d+-->/g,
      "",
    );
}

export function createMemoSerializationCache() {
  return {
    nodes: new WeakMap<ProseMirrorNode, ProseMirrorNode>(),
    json: new WeakMap<ProseMirrorNode, JSONContent>(),
  };
}

type MemoSerializationCache = ReturnType<typeof createMemoSerializationCache>;

function addMarkerPlaceholderForSerialization(
  node: ProseMirrorNode,
  cache?: MemoSerializationCache,
): ProseMirrorNode {
  const cached = cache?.nodes.get(node);
  if (cached) {
    return cached;
  }
  const children: ProseMirrorNode[] = [];

  node.forEach((child) => {
    children.push(addMarkerPlaceholderForSerialization(child, cache));
  });
  const content = Fragment.fromArray(children);
  let nextNode = node.content.eq(content) ? node : node.copy(content);
  cache?.nodes.set(node, nextNode);

  if (
    !LIST_TYPES.has(nextNode.type.name) ||
    !nextNode.attrs.memoListMarkerPlaceholder ||
    nextNode.childCount !== 1
  ) {
    return nextNode;
  }

  const placeholderItem = nextNode.firstChild;
  const paragraph = placeholderItem?.firstChild;

  if (
    !placeholderItem ||
    !LIST_ITEM_TYPES.has(placeholderItem.type.name) ||
    !paragraph ||
    paragraph.type.name !== "paragraph" ||
    paragraph.content.size !== 0
  ) {
    return nextNode;
  }

  const placeholderParagraph = paragraph.type.create(
    paragraph.attrs,
    nextNode.type.schema.text(
      createMemoListMarkerPlaceholder(
        nextNode.type.name,
        Number(nextNode.attrs.start ?? 1),
      ),
    ),
  );
  const placeholderItemContent = placeholderItem.content.replaceChild(
    0,
    placeholderParagraph,
  );
  nextNode = nextNode.copy(
    Fragment.from(placeholderItem.copy(placeholderItemContent)),
  );

  cache?.nodes.set(node, nextNode);
  return nextNode;
}

function getMemoSerializationJSON(
  node: ProseMirrorNode,
  cache?: MemoSerializationCache,
): JSONContent {
  if (!cache) {
    return node.toJSON();
  }
  const cached = cache.json.get(node);
  if (cached) {
    return cached;
  }
  // ProseMirror nodes are immutable; only changed ancestors need new JSON.
  const json: JSONContent = node.isLeaf
    ? node.toJSON()
    : node.copy(Fragment.empty).toJSON();
  if (node.childCount) {
    json.content = [];
    node.forEach((child) => {
      json.content!.push(getMemoSerializationJSON(child, cache));
    });
  }
  cache.json.set(node, json);
  return json;
}

export function serializeMemoListMarkerPlaceholders(
  node: ProseMirrorNode,
  serialize: (document: JSONContent) => string,
  cache?: MemoSerializationCache,
) {
  const document = addMarkerPlaceholderForSerialization(node, cache);
  const markdown = serialize(getMemoSerializationJSON(document, cache)).replace(
    ESCAPED_MEMO_LIST_MARKER_PLACEHOLDER_PATTERN,
    (_match, listType: string, start: string) =>
      createMemoListMarkerPlaceholder(listType, Number(start)),
  );

  return markdown.replace(
    SERIALIZED_MEMO_LIST_MARKER_PLACEHOLDER_LINE_PATTERN,
    "$1$2",
  );
}
