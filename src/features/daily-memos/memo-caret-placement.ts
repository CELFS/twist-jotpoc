import { Extension } from "@tiptap/react";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export function placeMemoCaret(view: EditorView, _position: number, event: MouseEvent): boolean {
  if (view.editable === false) return false;
  if (event.detail > 1 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof Element) || target.closest('[contenteditable="false"]')) return false;

  const selector = "p, h1, h2, h3, h4, h5, h6";
  const targetBlock = target.closest<HTMLElement>(selector);
  const targetRect = targetBlock && view.dom.contains(targetBlock)
    ? targetBlock.getBoundingClientRect()
    : null;
  // Text taps already identify their paragraph. Preserve the existing vertical
  // lookup for taps on the editor's surrounding whitespace.
  const block = targetRect && targetRect.height > 0 &&
    event.clientY >= targetRect.top && event.clientY < targetRect.bottom
    ? targetBlock
    : Array.from(view.dom.querySelectorAll<HTMLElement>(selector)).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.height > 0 && event.clientY >= rect.top && event.clientY < rect.bottom;
    });
  if (!block || block.closest('[contenteditable="false"]')) return false;

  const start = view.posAtDOM(block, 0);
  const parent = view.state.doc.resolve(start).parent;
  if (!parent.isTextblock) return false;
  const select = (position: number) => {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
    view.focus();
    return true;
  };
  if (parent.content.size === 0) return select(start);

  // Only correct clicks at the right edge; leave ordinary taps, dragging and word selection native.
  const blockRect = block === targetBlock && targetRect
    ? targetRect
    : block.getBoundingClientRect();
  if (event.clientX < blockRect.right - 8) return false;

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let textNode: Node | null;
  let lineEnd: { position: number; right: number } | null = null;
  while ((textNode = walker.nextNode())) {
    if (textNode.parentElement?.closest('[contenteditable="false"]')) continue;
    range.selectNodeContents(textNode);
    if (!Array.from(range.getClientRects()).some((rect) =>
      event.clientY >= rect.top && event.clientY <= rect.bottom,
    )) continue;

    for (let offset = (textNode.textContent?.length ?? 0) - 1; offset >= 0; offset -= 1) {
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || event.clientY < rect.top || event.clientY > rect.bottom) continue;
      if (event.clientX >= rect.right - 1 && (!lineEnd || rect.right > lineEnd.right)) {
        lineEnd = { position: view.posAtDOM(textNode, offset + 1), right: rect.right };
      }
      break;
    }
  }
  return lineEnd ? select(lineEnd.position) : false;
}

export const MemoCaretPlacement = Extension.create({
  name: "memoCaretPlacement",
  addProseMirrorPlugins() {
    return [new Plugin({ props: { handleClick: placeMemoCaret } })];
  },
});
