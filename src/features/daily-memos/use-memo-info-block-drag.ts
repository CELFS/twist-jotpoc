
import { Extension } from "@tiptap/react";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { NodeViewProps } from "@tiptap/react";

type DropTarget = {
  left: number;
  position: number;
  top: number;
  width: number;
};

type DragSession = {
  active: boolean;
  clientX: number;
  clientY: number;
  ghost: HTMLElement | null;
  handle: HTMLElement;
  height: number;
  pointerId: number;
  pointerType: string;
  scrollAnimationFrame: number | null;
  scrollContainer: HTMLElement | null;
  sourcePosition: number;
  startClientX: number;
  startClientY: number;
  timer: number | null;
};

type DragPlaceholder = {
  height: number;
  position: number;
};

const memoInfoBlockDragPlaceholderKey = new PluginKey<DragPlaceholder | null>(
  "memoInfoBlockDragPlaceholder",
);

export const MemoInfoBlockDragPlaceholder = Extension.create({
  name: "memoInfoBlockDragPlaceholder",

  addProseMirrorPlugins() {
    return [
      new Plugin<DragPlaceholder | null>({
        key: memoInfoBlockDragPlaceholderKey,
        state: {
          apply(transaction, placeholder) {
            const nextPlaceholder = transaction.getMeta(
              memoInfoBlockDragPlaceholderKey,
            ) as DragPlaceholder | null | undefined;

            if (nextPlaceholder !== undefined) {
              return nextPlaceholder;
            }

            if (!placeholder || !transaction.docChanged) {
              return placeholder;
            }

            return {
              ...placeholder,
              position: transaction.mapping.map(placeholder.position),
            };
          },
          init: () => null,
        },
        props: {
          decorations(state) {
            const placeholder = memoInfoBlockDragPlaceholderKey.getState(state);

            if (!placeholder) {
              return DecorationSet.empty;
            }

            return DecorationSet.create(state.doc, [
              Decoration.widget(
                placeholder.position,
                () => {
                  const element = document.createElement("div");
                  element.className = "daily-memo-info-block-drop-placeholder";
                  element.contentEditable = "false";
                  element.style.height = `${placeholder.height}px`;
                  element.setAttribute("aria-hidden", "true");
                  return element;
                },
                {
                  key: `memo-info-block-drop-${placeholder.position}-${placeholder.height}`,
                  side: -1,
                },
              ),
            ]);
          },
        },
      }),
    ];
  },
});

function setDragPlaceholder(
  view: EditorView,
  placeholder: DragPlaceholder | null,
) {
  view.dispatch(
    view.state.tr
      .setMeta(memoInfoBlockDragPlaceholderKey, placeholder)
      .setMeta("addToHistory", false),
  );
}

export function getMemoInfoBlockDropTarget(
  view: EditorView,
  sourcePosition: number,
  clientY: number,
): DropTarget | null {
  const editorElement = view.dom;
  const editorRect = editorElement.getBoundingClientRect();
  const candidates: Array<{
    bottom: number;
    midpoint: number;
    position: number;
    top: number;
  }> = [];

  view.state.doc.forEach((_child, offset) => {
    if (offset === sourcePosition) {
      return;
    }

    const element = view.nodeDOM(offset);

    if (!(element instanceof HTMLElement)) {
      return;
    }

    const rect = element.getBoundingClientRect();
    candidates.push({
      bottom: rect.bottom,
      midpoint: rect.top + rect.height / 2,
      position: offset,
      top: rect.top,
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  const nextCandidate = candidates.find(
    (candidate) => clientY < candidate.midpoint,
  );
  const position = nextCandidate
    ? nextCandidate.position
    : view.state.doc.content.size;
  const top = nextCandidate
    ? nextCandidate.top
    : candidates[candidates.length - 1].bottom;
  const sourceNode = view.state.doc.nodeAt(sourcePosition);

  if (
    !sourceNode ||
    (position >= sourcePosition &&
      position <= sourcePosition + sourceNode.nodeSize)
  ) {
    return null;
  }

  return {
    left: editorRect.left + 12,
    position,
    top,
    width: Math.max(0, editorRect.width - 24),
  };
}

export function moveMemoInfoBlock(
  view: EditorView,
  sourcePosition: number,
  targetPosition: number,
  focusEditor = true,
) {
  const sourceNode = view.state.doc.nodeAt(sourcePosition);

  if (!sourceNode || sourceNode.type.name !== "memoInfoBlock") {
    return;
  }

  const adjustedTarget =
    targetPosition > sourcePosition
      ? targetPosition - sourceNode.nodeSize
      : targetPosition;
  const transaction = view.state.tr
    .delete(sourcePosition, sourcePosition + sourceNode.nodeSize)
    .insert(adjustedTarget, sourceNode);
  transaction.setSelection(
    NodeSelection.create(transaction.doc, adjustedTarget),
  );

  view.dispatch(transaction.scrollIntoView());

  if (focusEditor) {
    view.focus();
  }
}

export function useMemoInfoBlockDrag({
  editor,
  getPos,
}: Pick<NodeViewProps, "editor" | "getPos">) {
  const sessionRef = useRef<DragSession | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  const [dragging, setDragging] = useState(false);

  const preventTouchEditing = useCallback(() => {
    if (editor.isDestroyed) {
      return;
    }

    editor.view.dom.blur();
    window.getSelection()?.removeAllRanges();
  }, [editor]);

  useEffect(() => {
    const handle = dragHandleRef.current;

    if (!handle) {
      return;
    }

    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      event.stopPropagation();
      preventTouchEditing();
    };

    handle.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: false,
    });

    return () => {
      handle.removeEventListener("touchstart", handleTouchStart, true);
    };
  }, [preventTouchEditing]);

  const updateDragFeedback = (session: DragSession) => {
    const deltaX = session.clientX - session.startClientX;
    const deltaY = session.clientY - session.startClientY;
    session.ghost?.style.setProperty(
      "transform",
      `translate3d(${deltaX}px, ${deltaY}px, 0)`,
    );
    const nextTarget = getMemoInfoBlockDropTarget(
      editor.view,
      session.sourcePosition,
      session.clientY,
    );
    const previousTarget = targetRef.current;
    targetRef.current = nextTarget;

    if (previousTarget?.position !== nextTarget?.position) {
      setDragPlaceholder(
        editor.view,
        nextTarget
          ? { height: session.height, position: nextTarget.position }
          : null,
      );
    }
  };

  const getAutoScrollVelocity = (session: DragSession) => {
    const container = session.scrollContainer;

    if (!container) {
      return 0;
    }

    const rect = container.getBoundingClientRect();
    const edgeSize = Math.min(72, rect.height / 3);
    const maxVelocity = 14;

    if (session.clientY < rect.top + edgeSize) {
      const strength = Math.min(
        1,
        (rect.top + edgeSize - session.clientY) / edgeSize,
      );
      return -maxVelocity * strength;
    }

    if (session.clientY > rect.bottom - edgeSize) {
      const strength = Math.min(
        1,
        (session.clientY - (rect.bottom - edgeSize)) / edgeSize,
      );
      return maxVelocity * strength;
    }

    return 0;
  };

  const updateAutoScroll = (session: DragSession) => {
    if (session.scrollAnimationFrame !== null) {
      window.cancelAnimationFrame(session.scrollAnimationFrame);
      session.scrollAnimationFrame = null;
    }

    const scroll = () => {
      if (sessionRef.current !== session || !session.active) {
        session.scrollAnimationFrame = null;
        return;
      }

      const container = session.scrollContainer;
      const velocity = getAutoScrollVelocity(session);

      if (!container || velocity === 0) {
        session.scrollAnimationFrame = null;
        return;
      }

      const previousScrollTop = container.scrollTop;
      container.scrollTop += velocity;

      if (container.scrollTop === previousScrollTop) {
        session.scrollAnimationFrame = null;
        return;
      }

      updateDragFeedback(session);
      session.scrollAnimationFrame = window.requestAnimationFrame(scroll);
    };

    if (getAutoScrollVelocity(session) !== 0) {
      session.scrollAnimationFrame = window.requestAnimationFrame(scroll);
    }
  };

  const activateSession = (session: DragSession) => {
    if (session.active) {
      return;
    }

    const sourceElement = session.handle.closest<HTMLElement>(
      ".daily-memo-info-block",
    );

    if (!sourceElement) {
      return;
    }

    const sourceRect = sourceElement.getBoundingClientRect();
    const ghost = sourceElement.cloneNode(true) as HTMLElement;
    const sourceStyles = window.getComputedStyle(sourceElement);
    ghost.removeAttribute("data-drag-source");
    ghost.setAttribute("data-drag-ghost", "true");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.style.left = `${sourceRect.left}px`;
    ghost.style.minHeight = `${sourceRect.height}px`;
    ghost.style.top = `${sourceRect.top}px`;
    ghost.style.width = `${sourceRect.width}px`;
    ghost.style.setProperty(
      "--daily-memo-context-color",
      sourceStyles.getPropertyValue("--daily-memo-context-color"),
    );
    document.body.append(ghost);

    session.active = true;
    session.ghost = ghost;
    session.height = sourceRect.height;
    session.scrollContainer = sourceElement.closest<HTMLElement>(
      ".daily-memo-rich-text-editor-content",
    );
    session.timer = null;
    document.body.dataset.memoInfoBlockDragging = "true";
    setDragging(true);
    updateDragFeedback(session);
    updateAutoScroll(session);
  };

  const clearSession = useCallback(() => {
    const session = sessionRef.current;

    if (session?.timer != null) {
      window.clearTimeout(session.timer);
    }

    if (session?.scrollAnimationFrame != null) {
      window.cancelAnimationFrame(session.scrollAnimationFrame);
    }

    if (
      session &&
      session.handle.hasPointerCapture(session.pointerId)
    ) {
      session.handle.releasePointerCapture(session.pointerId);
    }

    session?.ghost?.remove();

    if (!editor.isDestroyed && (session?.active || targetRef.current)) {
      setDragPlaceholder(editor.view, null);
    }

    sessionRef.current = null;
    targetRef.current = null;
    setDragging(false);
    delete document.body.dataset.memoInfoBlockDragging;
  }, [editor]);

  useEffect(() => clearSession, [clearSession]);

  const onPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!editor.isEditable) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.pointerType !== "mouse") {
      preventTouchEditing();
    }

    const sourcePosition = getPos();

    if (typeof sourcePosition !== "number") {
      return;
    }

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const session: DragSession = {
      active: false,
      clientX: event.clientX,
      clientY: event.clientY,
      ghost: null,
      handle,
      height: 0,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      scrollAnimationFrame: null,
      scrollContainer: null,
      sourcePosition,
      startClientX: event.clientX,
      startClientY: event.clientY,
      timer: null,
    };

    if (event.pointerType !== "mouse") {
      session.timer = window.setTimeout(() => {
        activateSession(session);
      }, 260);
    }

    sessionRef.current = session;
  };

  const onPointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const session = sessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - session.startClientX;
    const deltaY = event.clientY - session.startClientY;
    session.clientX = event.clientX;
    session.clientY = event.clientY;

    if (!session.active) {
      if (session.pointerType === "mouse" && Math.hypot(deltaX, deltaY) > 4) {
        activateSession(session);
      } else if (Math.hypot(deltaX, deltaY) > 8) {
        clearSession();
      }

      if (!session.active) {
        return;
      }
    }

    event.preventDefault();
    updateDragFeedback(session);
    updateAutoScroll(session);
  };

  const onPointerUp = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const session = sessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const target = targetRef.current;
    const active = session.active;
    const focusEditor = session.pointerType === "mouse";
    const sourcePosition = session.sourcePosition;
    clearSession();

    if (active && target) {
      moveMemoInfoBlock(
        editor.view,
        sourcePosition,
        target.position,
        focusEditor,
      );
    }
  };

  return {
    dragging,
    dragHandleProps: {
      ref: (handle: HTMLButtonElement | null) => {
        dragHandleRef.current = handle;
      },
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onDragStart: (event: ReactDragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onPointerCancel: clearSession,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  };
}
