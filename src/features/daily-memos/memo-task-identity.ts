import { nanoid } from "nanoid";
import { Plugin } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { Fragment, Slice, type Node } from "@tiptap/pm/model";
import { claimMemoTaskId } from "./memo-task-metadata";

// A cut can transfer identity once, including between memo editors. Keep only the
// latest clipboard operation in memory; nothing is written to storage or synced.
let cutTasks: { source: { doc: Node }; ids: Set<string> } | null = null;

function mapClipboardTasks(slice: Slice, attributes: (node: Node) => Node["attrs"]) {
  const map = (fragment: Fragment): Fragment => {
    const nodes: Node[] = [];
    fragment.forEach(node => {
      const attrs = node.type.name === "taskItem" ? attributes(node) : null;
      const content = map(node.content);
      nodes.push(node.type.name === "taskItem"
        ? node.type.create(attrs, content, node.marks)
        : node.copy(content));
    });
    return Fragment.fromArray(nodes);
  };
  return new Slice(map(slice.content), slice.openStart, slice.openEnd);
}

// Identity travels with the task node through edits and moves. New/split/pasted
// tasks get their own ID; opening a legacy memo never invents a completion time.
export function memoTaskIdentityPlugin() {
  let cutting: boolean | null = null;
  const source = {} as { doc: Node };
  return new Plugin({
    state: {
      init: (_, state) => { source.doc = state.doc; return null; },
      apply: (_, value, __, state) => { source.doc = state.doc; return value; },
    },
    props: {
      handleDOMEvents: {
        copy: () => { cutting = false; cutTasks = null; return false; },
        cut: () => { cutting = true; cutTasks = null; return false; },
      },
      transformCopied(slice) {
        // Drag serialization also uses this hook. The identity mapper handles
        // same-editor drag moves/copies after ProseMirror applies the drop.
        if (cutting === null) return slice;
        const ids = new Set<string>();
        const result = mapClipboardTasks(slice, node => {
          if (cutting && claimMemoTaskId(node.attrs.memoTaskId, ids)) return node.attrs;
          return { ...node.attrs, memoTaskId: null, completedAt: null };
        });
        cutTasks = cutting && ids.size ? { source, ids } : null;
        cutting = null;
        return result;
      },
      transformPasted(slice, view) {
        if (view.dragging) return slice;
        const pending = cutTasks;
        const remaining = new Set<string>();
        if (pending) pending.source.doc.descendants(node => {
          if (node.type.name === "taskItem" && node.attrs.memoTaskId) remaining.add(node.attrs.memoTaskId);
        });
        return mapClipboardTasks(slice, node => {
          const id = node.attrs.memoTaskId as string | null;
          // Partial cuts and cuts undone before pasting still have an owner.
          if (id && pending?.ids.has(id) && !remaining.has(id)) {
            pending.ids.delete(id);
            if (!pending.ids.size) cutTasks = null;
            return node.attrs;
          }
          return { ...node.attrs, memoTaskId: nanoid(), completedAt: null };
        });
      },
    },
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some(transaction => transaction.docChanged)) return null;
      const mapping = new Mapping(transactions.flatMap(transaction => transaction.mapping.maps));
      const previous = new Map<string, Node>();
      const legacy = new Map<number, Node>();
      const owners = new Map<string, number>();
      const originals = new Set<string>();
      const retained = new Map<number, Node>();
      const importedDuplicates = new Map<number, Node>();
      oldState.doc.descendants((node, position) => {
        if (node.type.name !== "taskItem") return;
        // Match the extractor on already duplicated/imported Markdown. A genuine
        // paste before an existing owner still respects that owner's mapped position.
        const interior = mapping.mapResult(position + 1);
        const mappedPosition = interior.pos - 1;
        const mappedItem = !interior.deleted && mappedPosition >= 0 ? newState.doc.nodeAt(mappedPosition) : null;
        const survives = mappedItem?.type === node.type;
        if (!node.attrs.memoTaskId) {
          if (survives) legacy.set(mappedPosition, node);
          return;
        }
        if (!claimMemoTaskId(node.attrs.memoTaskId, originals)) {
          if (survives) importedDuplicates.set(mappedPosition, node);
          return;
        }
        previous.set(node.attrs.memoTaskId, node);
        if (survives) {
          retained.set(mappedPosition, node);
          if (mappedItem.attrs.memoTaskId === node.attrs.memoTaskId) owners.set(node.attrs.memoTaskId, mappedPosition);
        }
      });
      const seen = new Set<string>();
      const transaction = newState.tr;
      const now = Date.now();
      newState.doc.descendants((node, position) => {
        if (node.type.name !== "taskItem") return;
        let id = node.attrs.memoTaskId as string | null;
        let completedAt = node.attrs.completedAt as number | null;
        // Undo may restore a legacy node without metadata. Its mapped interior
        // identifies the same task, so retain the ID allocated by its first edit.
        const retainedNode = retained.get(position);
        if (retainedNode && id !== retainedNode.attrs.memoTaskId) {
          // Undo can also restore a duplicate marker repaired by the first edit.
          if (id) completedAt = retainedNode.attrs.completedAt;
          id = retainedNode.attrs.memoTaskId;
        }
        const duplicate = Boolean(id && (importedDuplicates.has(position) || (owners.has(id) && owners.get(id) !== position) || !claimMemoTaskId(id, seen)));
        const before = duplicate ? importedDuplicates.get(position) : id ? previous.get(id) : legacy.get(position);
        if (!id || duplicate) id = nanoid();
        if (!node.attrs.checked) completedAt = null;
        else if (duplicate) completedAt = before && !before.attrs.checked ? now : null;
        else if (before && !before.attrs.checked && !completedAt) completedAt = now;
        seen.add(id);
        if (id !== node.attrs.memoTaskId || completedAt !== node.attrs.completedAt) {
          transaction.setNodeMarkup(position, undefined, { ...node.attrs, memoTaskId: id, completedAt });
        }
      });
      return transaction.docChanged ? transaction : null;
    },
  });
}
