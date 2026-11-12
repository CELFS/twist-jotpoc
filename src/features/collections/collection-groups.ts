import type { CollectionItem } from "@/extension/collection-contracts";

export type CollectionListItem = CollectionItem & { urlKey: string; noteId: string | null; sourceCount?: number };
export type CollectionSourceGroup = {
  urlKey: string;
  source: CollectionListItem;
  noteId: string | null;
  items: CollectionListItem[];
};

export function groupCollectionsBySource(items: CollectionListItem[]): CollectionSourceGroup[] {
  const groups = new Map<string, CollectionSourceGroup>();
  for (const item of items) {
    const group = groups.get(item.urlKey);
    if (group) {
      group.items.push(item);
      group.noteId ??= item.noteId;
    } else {
      groups.set(item.urlKey, { urlKey: item.urlKey, source: item, noteId: item.noteId, items: [item] });
    }
  }
  return [...groups.values()];
}
