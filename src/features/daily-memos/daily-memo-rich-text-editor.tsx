
import Placeholder from "@tiptap/extension-placeholder";
import { DailyMemoMarkdown } from "@/features/daily-memos/daily-memo-markdown";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { EditorView } from "@tiptap/pm/view";
import { redoDepth, undoDepth } from "@tiptap/pm/history";
import { Plus } from "lucide-react";
import { createPortal } from "react-dom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MemoSourcePreset } from "@/data/models";
import { ActiveHeadingIndicator } from "@/features/daily-memos/active-heading-indicator";
import { DailyMemoListIndentation } from "@/features/daily-memos/daily-memo-list-extension";
import { removeLeadingEmptyCheckbox } from "@/features/daily-memos/daily-memo-list-marker-command";
import { createMemoSerializationCache, serializeMemoListMarkerPlaceholders } from "@/features/daily-memos/daily-memo-list-placeholder-codec";
import { DailyMemoStarterKit } from "@/features/daily-memos/daily-memo-starter-kit";
import { DailyMemoSyntaxToolbar } from "@/features/daily-memos/daily-memo-syntax-toolbar";
import {
  DailyMemoTaskItem,
  DailyMemoTaskList,
} from "@/features/daily-memos/daily-memo-task-extensions";
import { MemoEmptyLineAction } from "@/features/daily-memos/memo-empty-line-action";
import { MemoCaretPlacement } from "@/features/daily-memos/memo-caret-placement";
import { MemoInfoBlock } from "@/features/daily-memos/memo-info-block";
import { MemoSourceNoteReference } from "@/features/daily-memos/memo-source-note-reference";
import { MemoInfoBlockSourceDrawer } from "@/features/daily-memos/memo-info-block-source-drawer";
import { parseNormalizedMemoMarkdown } from "@/features/daily-memos/normalize-empty-list-items";
import {
  MemoInfoBlockDragPlaceholder,
} from "@/features/daily-memos/use-memo-info-block-drag";
import { getText } from "@/i18n/get-text";

export type DailyMemoEditorHistoryState = {
  canRedo: boolean;
  canUndo: boolean;
};

export type DailyMemoRichTextEditorHandle = {
  getDocument: () => JSONContent | undefined;
  redo: () => void;
  undo: () => void;
};

type DailyMemoRichTextEditorProps = {
  content: string;
  preview?: boolean;
  memoInfoEnabled?: boolean;
  label: string;
  onChange: (content: string) => void;
  onCompositionChange: (composing: boolean) => void;
  onCursorNearFloatingControlsChange: (near: boolean) => void;
  onHistoryStateChange: (state: DailyMemoEditorHistoryState) => void;
  onScrollActivity: () => void;
  onScrollGestureEnd: () => void;
  onScrollGestureStart: () => void;
  placeholder: string;
  sourcePresets: MemoSourcePreset[];
  toolbarExpanded: boolean;
};

export const DailyMemoRichTextEditor = forwardRef<
  DailyMemoRichTextEditorHandle,
  DailyMemoRichTextEditorProps
>(function DailyMemoRichTextEditor({
  content,
  preview = false,
  memoInfoEnabled = true,
  label,
  onChange,
  onCompositionChange,
  onHistoryStateChange,
  onScrollActivity,
  onScrollGestureEnd,
  onScrollGestureStart,
  onCursorNearFloatingControlsChange,
  placeholder,
  sourcePresets,
  toolbarExpanded,
}: DailyMemoRichTextEditorProps, ref) {
  const editorRootRef = useRef<HTMLDivElement>(null);
  const editorFocusedRef = useRef(false);
  const editorComposingRef = useRef(false);
  const compositionFlushFrameRef = useRef<number | null>(null);
  const pendingCompositionMarkdownRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  const onCompositionChangeRef = useRef(onCompositionChange);
  const initialContentRef = useRef(content);
  const serializationCache = useMemo(() => createMemoSerializationCache(), []);
  onChangeRef.current = onChange;
  onCompositionChangeRef.current = onCompositionChange;
  const [emptyLineAction, setEmptyLineAction] = useState<{
    from: number;
    left: number;
    size: number;
    top: number;
    to: number;
  } | null>(null);
  const [sourceDrawer, setSourceDrawer] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const editorProps = useMemo(
    () => ({
      attributes: {
        "aria-label": label,
        class: "daily-memo-rich-text-content",
        role: "textbox",
      },
      handleDOMEvents: {
        beforeinput: (view: EditorView, event: Event) => {
          const inputEvent = event as InputEvent;
          if (view.editable && inputEvent.cancelable && !inputEvent.isComposing &&
            inputEvent.inputType === "deleteContentBackward" && removeLeadingEmptyCheckbox(view.state, view.dispatch)) {
            event.preventDefault();
            return true;
          }

          if (
            inputEvent.isComposing ||
            inputEvent.inputType === "insertCompositionText"
          ) {
            editorComposingRef.current = true;
            onCompositionChangeRef.current(true);
          }

          return false;
        },
        compositionend: () => {
          if (compositionFlushFrameRef.current !== null) {
            window.cancelAnimationFrame(compositionFlushFrameRef.current);
          }

          compositionFlushFrameRef.current = window.requestAnimationFrame(() => {
            compositionFlushFrameRef.current = null;
            editorComposingRef.current = false;
            onCompositionChangeRef.current(false);

            if (pendingCompositionMarkdownRef.current !== null) {
              onChangeRef.current(pendingCompositionMarkdownRef.current);
              pendingCompositionMarkdownRef.current = null;
            }
          });
          return false;
        },
        compositionstart: () => {
          if (compositionFlushFrameRef.current !== null) {
            window.cancelAnimationFrame(compositionFlushFrameRef.current);
            compositionFlushFrameRef.current = null;
          }

          editorComposingRef.current = true;
          onCompositionChangeRef.current(true);
          return false;
        },
      },
    }),
    [label],
  );
  const extensions = useMemo(
    () => [
      DailyMemoStarterKit.configure({
        link: {
          markdownLinks: true,
          openOnClick: false,
        },
      }),
      DailyMemoTaskList,
      DailyMemoTaskItem.configure({ onReadOnlyChecked: () => true }),
      DailyMemoListIndentation,
      DailyMemoMarkdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      ActiveHeadingIndicator,
      MemoCaretPlacement,
      ...(memoInfoEnabled
        ? [
            MemoInfoBlock.configure({ sourcePresets }),
            MemoSourceNoteReference,
            MemoInfoBlockDragPlaceholder,
            MemoEmptyLineAction,
          ]
        : []),
    ],
    [memoInfoEnabled, placeholder, sourcePresets],
  );
  const [initialEditorContent] = useState(() =>
    parseNormalizedMemoMarkdown(initialContentRef.current, extensions),
  );
  const editor = useEditor({
    editable: !preview,
    content: initialEditorContent,
    editorProps,
    extensions,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: updatedEditor }) => {
      const markdownManager = updatedEditor.markdown;
      const nextMarkdown = markdownManager
        ? serializeMemoListMarkerPlaceholders(
            updatedEditor.state.doc,
            (document) => markdownManager.serialize(document),
            serializationCache,
          )
        : updatedEditor.getMarkdown();

      if (editorComposingRef.current || updatedEditor.view.composing) {
        pendingCompositionMarkdownRef.current = nextMarkdown;
        return;
      }

      onChangeRef.current(nextMarkdown);
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (preview) {
      editor.view.dom.blur();
      const title = editorRootRef.current?.closest(".daily-memo-writing-panel")
        ?.querySelector<HTMLInputElement>(".daily-memo-title-input");
      title?.blur();
      setEmptyLineAction(null);
      setSourceDrawer(null);
    }
    editor.setEditable(!preview, false);
    // Notify node views about the mode change without changing the document.
    editor.view.dispatch(editor.state.tr);
  }, [editor, preview]);

  useEffect(() => {
    return () => {
      if (compositionFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(compositionFlushFrameRef.current);
      }
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getDocument: () => editor?.getJSON(),
      redo: () => {
        if (!editor?.isEditable) return;
        editor?.chain().focus().redo().run();
      },
      undo: () => {
        if (!editor?.isEditable) return;
        editor?.chain().focus().undo().run();
      },
    }),
    [editor],
  );

  useEffect(() => {
    if (!editor) {
      onHistoryStateChange({ canRedo: false, canUndo: false });
      return;
    }

    let previous: DailyMemoEditorHistoryState | null = null;
    const updateHistoryState = () => {
      const next = {
        canRedo: redoDepth(editor.state) > 0,
        canUndo: undoDepth(editor.state) > 0,
      };
      if (previous?.canRedo === next.canRedo && previous.canUndo === next.canUndo) {
        return;
      }
      previous = next;
      onHistoryStateChange(next);
    };

    updateHistoryState();
    editor.on("transaction", updateHistoryState);

    return () => {
      editor.off("transaction", updateHistoryState);
    };
  }, [editor, onHistoryStateChange]);

  const updateEmptyLineAction = useCallback(() => {
    if (!editor || !editor.isEditable || !memoInfoEnabled) {
      setEmptyLineAction(null);
      onCursorNearFloatingControlsChange(false);
      return;
    }

    if (!editorFocusedRef.current) {
      setEmptyLineAction(null);
      onCursorNearFloatingControlsChange(false);
      return;
    }

    const { $from } = editor.state.selection;
    const root = editorRootRef.current;

    if (!root) {
      setEmptyLineAction(null);
      onCursorNearFloatingControlsChange(false);
      return;
    }

    const cursorCoordinates = editor.view.coordsAtPos($from.pos);
    const workspace = root.closest<HTMLElement>(".daily-memo-workspace");
    const controls = workspace
      ? Array.from(
          workspace.querySelectorAll<HTMLElement>(".daily-memo-list-trigger"),
        ).filter((element) => element.parentElement === workspace)
        .concat(
          workspace
            ? Array.from(
                workspace.querySelectorAll<HTMLElement>(
                  ".daily-memo-action-menu > .daily-memo-list-trigger",
                ),
              )
            : [],
        )
      : [];
    const controlsTop = controls.reduce(
      (top, element) => Math.min(top, element.getBoundingClientRect().top),
      Number.POSITIVE_INFINITY,
    );
    onCursorNearFloatingControlsChange(
      Number.isFinite(controlsTop) && cursorCoordinates.bottom >= controlsTop - 8,
    );

    let anchorDom: HTMLElement | null = null;
    let from = 0;
    let to = 0;

    if (
      editor.state.selection instanceof GapCursor &&
      $from.depth === 0
    ) {
      anchorDom = root.querySelector<HTMLElement>(
        ".daily-memo-empty-line--gap",
      );
      from = $from.pos;
      to = $from.pos;
    } else {
      if (
        $from.depth !== 1 ||
        !$from.parent.isTextblock ||
        $from.parent.type.name !== "paragraph" ||
        $from.parent.content.size !== 0
      ) {
        setEmptyLineAction(null);
        return;
      }

      for (let depth = 1; depth < $from.depth; depth += 1) {
        if ($from.node(depth).type.name === "memoInfoBlock") {
          setEmptyLineAction(null);
          return;
        }
      }

      from = $from.before($from.depth);
      to = from + $from.parent.nodeSize;
      const paragraphDom = editor.view.nodeDOM(from);
      anchorDom = paragraphDom instanceof HTMLElement ? paragraphDom : null;
    }

    if (!anchorDom) {
      setEmptyLineAction(null);
      return;
    }

    const paragraphRect = anchorDom.getBoundingClientRect();
    const scrollContainer = root.querySelector<HTMLElement>(
      ".daily-memo-rich-text-editor-content",
    );
    const scrollRect = scrollContainer?.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportBottom =
      viewportTop + (visualViewport?.height ?? window.innerHeight);
    const visibleTop = Math.max(viewportTop, scrollRect?.top ?? viewportTop);
    const visibleBottom = Math.min(
      viewportBottom,
      scrollRect?.bottom ?? viewportBottom,
    );

    if (
      paragraphRect.height <= 0 ||
      paragraphRect.top < visibleTop ||
      paragraphRect.bottom > visibleBottom
    ) {
      setEmptyLineAction(null);
      onCursorNearFloatingControlsChange(false);
      return;
    }

    const borderBottomWidth = Number.parseFloat(
      window.getComputedStyle(anchorDom).borderBottomWidth,
    );
    const actionGap = 4;
    const actionSize = Math.max(
      1,
      paragraphRect.height -
        (Number.isFinite(borderBottomWidth) ? borderBottomWidth : 0) -
        actionGap,
    );

    setEmptyLineAction({
      from,
      left: paragraphRect.right - actionSize,
      size: actionSize,
      top: paragraphRect.top,
      to,
    });
  }, [editor, memoInfoEnabled, onCursorNearFloatingControlsChange]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    let focusFrame: number | null = null;
    const handleEditorFocus = () => {
      editorFocusedRef.current = true;

      if (focusFrame !== null) {
        window.cancelAnimationFrame(focusFrame);
      }

      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = null;
        updateEmptyLineAction();
      });
    };
    const handleEditorBlur = () => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof Element &&
        activeElement.closest(".daily-memo-empty-line-action")
      ) {
        return;
      }

      editorFocusedRef.current = false;
      updateEmptyLineAction();
    };

    const visualViewport = window.visualViewport;
    const scheduleEmptyLineActionUpdate = () => {
      if (focusFrame !== null) {
        window.cancelAnimationFrame(focusFrame);
      }

      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = null;
        updateEmptyLineAction();
      });
    };

    editor.on("selectionUpdate", scheduleEmptyLineActionUpdate);
    editor.on("transaction", scheduleEmptyLineActionUpdate);
    editor.on("focus", handleEditorFocus);
    editor.on("blur", handleEditorBlur);
    window.addEventListener("resize", scheduleEmptyLineActionUpdate);
    visualViewport?.addEventListener(
      "resize",
      scheduleEmptyLineActionUpdate,
    );
    visualViewport?.addEventListener(
      "scroll",
      scheduleEmptyLineActionUpdate,
    );

    return () => {
      if (focusFrame !== null) {
        window.cancelAnimationFrame(focusFrame);
      }
      editor.off("selectionUpdate", scheduleEmptyLineActionUpdate);
      editor.off("transaction", scheduleEmptyLineActionUpdate);
      editor.off("focus", handleEditorFocus);
      editor.off("blur", handleEditorBlur);
      window.removeEventListener("resize", scheduleEmptyLineActionUpdate);
      visualViewport?.removeEventListener(
        "resize",
        scheduleEmptyLineActionUpdate,
      );
      visualViewport?.removeEventListener(
        "scroll",
        scheduleEmptyLineActionUpdate,
      );
    };
  }, [editor, updateEmptyLineAction]);

  const insertInfoBlock = (source: MemoSourcePreset) => {
    if (!editor || editor.isDestroyed || !editor.isEditable || !sourceDrawer) {
      return;
    }

    const { from, to } = sourceDrawer;
    const inserted = editor
      .chain()
      .insertContentAt(
        {
          from,
          to,
        },
        {
          attrs: {
            sourceId: source.id,
            sourceName: source.name,
          },
          content: [{ type: "paragraph" }],
          type: "memoInfoBlock",
        },
      )
      .setTextSelection(from + 2)
      .run();

    if (inserted) {
      setSourceDrawer(null);
    }
  };

  const closeSourceDrawer = () => {
    setSourceDrawer(null);
  };

  const handleEditorScroll = useCallback(() => {
    onScrollActivity();
    updateEmptyLineAction();
  }, [onScrollActivity, updateEmptyLineAction]);

  const floatingLayer =
    !preview && memoInfoEnabled && typeof document !== "undefined" && emptyLineAction
      ? createPortal(
          <button
            aria-label={getText("dailyMemo.infoBlock.insert")}
            className="daily-memo-empty-line-action"
            style={{
              height: emptyLineAction.size,
              left: emptyLineAction.left,
              width: emptyLineAction.size,
              top: emptyLineAction.top,
            }}
            tabIndex={-1}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              editor?.commands.blur();
              setSourceDrawer({
                from: emptyLineAction.from,
                to: emptyLineAction.to,
              });
            }}
          >
            <Plus aria-hidden="true" size={16} />
          </button>,
          document.body,
        )
      : null;
  const sourceDrawerLayer =
    memoInfoEnabled && typeof document !== "undefined" && sourceDrawer
      ? createPortal(
          <MemoInfoBlockSourceDrawer
            sourcePresets={sourcePresets}
            onClose={closeSourceDrawer}
            onSelect={insertInfoBlock}
          />,
          document.body,
        )
      : null;

  return (
    <div
      ref={editorRootRef}
      className="daily-memo-rich-text-editor"
      data-toolbar-expanded={toolbarExpanded || undefined}
    >
      {toolbarExpanded ? <DailyMemoSyntaxToolbar editor={editor} /> : null}
      <EditorContent
        className="daily-memo-rich-text-editor-content custom-scrollbar"
        editor={editor}
        onScrollCapture={handleEditorScroll}
        onTouchCancel={onScrollGestureEnd}
        onTouchEnd={(event) => {
          if (event.touches.length === 0) {
            onScrollGestureEnd();
          }
        }}
        onTouchStart={onScrollGestureStart}
      />
      {floatingLayer}
      {sourceDrawerLayer}
    </div>
  );
});
