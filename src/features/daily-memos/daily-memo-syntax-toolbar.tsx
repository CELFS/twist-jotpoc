
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  List as ListIcon,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Strikethrough,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  liftMemoListItem,
  sinkMemoListItem,
} from "@/features/daily-memos/daily-memo-list-indentation";
import { getText } from "@/i18n/get-text";

type HeadingLevel = 1 | 2 | 3;

const HEADING_LONG_PRESS_DELAY = 450;

function canRunToolbarCommand(command: () => boolean) {
  try {
    return command();
  } catch {
    return false;
  }
}

type ToolbarButtonProps = {
  active: boolean;
  children: ReactNode;
  disabled: boolean;
  label: string;
  onActivate: () => void;
};

const EMPTY_TOOLBAR_STATE = {
  boldActive: false,
  bulletListActive: false,
  canBold: false,
  canBulletList: false,
  canHeading1: false,
  canHeading2: false,
  canHeading3: false,
  canIndentListItem: false,
  canItalic: false,
  canOrderedList: false,
  canOutdentListItem: false,
  canParagraph: false,
  canStrike: false,
  canTaskList: false,
  heading1Active: false,
  heading2Active: false,
  heading3Active: false,
  italicActive: false,
  orderedListActive: false,
  paragraphActive: false,
  strikeActive: false,
  taskListActive: false,
};

function ToolbarButton({
  active,
  children,
  disabled,
  label,
  onActivate,
}: ToolbarButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="daily-memo-syntax-toolbar-button"
      data-active={active || undefined}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onActivate}
      onPointerDown={(event) => {
        event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function DailyMemoSyntaxToolbar({
  editor,
}: {
  editor: Editor | null;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const headingButtonRef = useRef<HTMLButtonElement>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const headingLongPressTimerRef = useRef<number | null>(null);
  const suppressHeadingClickRef = useRef(false);
  const [headingLevel, setHeadingLevel] = useState<HeadingLevel>(1);
  const [headingMenuLeft, setHeadingMenuLeft] = useState(0);
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const toolbarState =
    useEditorState({
      editor,
      selector: ({ editor: currentEditor }) => {
        if (!currentEditor || currentEditor.isDestroyed) {
          return EMPTY_TOOLBAR_STATE;
        }

        return {
          boldActive: currentEditor.isActive("bold"),
          bulletListActive: currentEditor.isActive("bulletList"),
          canBold: canRunToolbarCommand(() =>
            currentEditor.can().toggleBold(),
          ),
          canBulletList: canRunToolbarCommand(() =>
            currentEditor.can().toggleBulletList(),
          ),
          canHeading1: canRunToolbarCommand(() =>
            currentEditor.can().toggleHeading({ level: 1 }),
          ),
          canHeading2: canRunToolbarCommand(() =>
            currentEditor.can().toggleHeading({ level: 2 }),
          ),
          canHeading3: canRunToolbarCommand(() =>
            currentEditor.can().toggleHeading({ level: 3 }),
          ),
          canIndentListItem: canRunToolbarCommand(() =>
            sinkMemoListItem(currentEditor.state),
          ),
          canItalic: canRunToolbarCommand(() =>
            currentEditor.can().toggleItalic(),
          ),
          canOrderedList: canRunToolbarCommand(() =>
            currentEditor.can().toggleOrderedList(),
          ),
          canOutdentListItem: canRunToolbarCommand(() =>
            liftMemoListItem(currentEditor.state),
          ),
          canParagraph: canRunToolbarCommand(() =>
            currentEditor.can().setParagraph(),
          ),
          canTaskList: canRunToolbarCommand(() =>
            currentEditor.can().toggleTaskList(),
          ),
          canStrike: canRunToolbarCommand(() =>
            currentEditor.can().toggleStrike(),
          ),
          heading1Active: currentEditor.isActive("heading", { level: 1 }),
          heading2Active: currentEditor.isActive("heading", { level: 2 }),
          heading3Active: currentEditor.isActive("heading", { level: 3 }),
          italicActive: currentEditor.isActive("italic"),
          orderedListActive: currentEditor.isActive("orderedList"),
          paragraphActive: currentEditor.isActive("paragraph"),
          strikeActive: currentEditor.isActive("strike"),
          taskListActive: currentEditor.isActive("taskList"),
        };
      },
    }) ?? EMPTY_TOOLBAR_STATE;

  const clearHeadingLongPressTimer = useCallback(() => {
    if (headingLongPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(headingLongPressTimerRef.current);
    headingLongPressTimerRef.current = null;
  }, []);

  const openHeadingMenu = useCallback(() => {
    const toolbar = toolbarRef.current;
    const headingButton = headingButtonRef.current;

    if (toolbar && headingButton) {
      const toolbarRect = toolbar.getBoundingClientRect();
      const buttonRect = headingButton.getBoundingClientRect();
      setHeadingMenuLeft(buttonRect.left - toolbarRect.left - 1);
    }

    setHeadingMenuOpen(true);
  }, []);

  useEffect(() => {
    if (!headingMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        !headingButtonRef.current?.contains(target) &&
        !headingMenuRef.current?.contains(target)
      ) {
        suppressHeadingClickRef.current = false;
        setHeadingMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        suppressHeadingClickRef.current = false;
        setHeadingMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [headingMenuOpen]);

  useEffect(() => clearHeadingLongPressTimer, [clearHeadingLongPressTimer]);

  const applyHeading = (level: HeadingLevel) => {
    editor?.chain().focus().toggleHeading({ level }).run();
  };
  const headingActive =
    headingLevel === 1
      ? toolbarState.heading1Active
      : headingLevel === 2
        ? toolbarState.heading2Active
        : toolbarState.heading3Active;
  const headingAvailable =
    headingLevel === 1
      ? toolbarState.canHeading1
      : headingLevel === 2
        ? toolbarState.canHeading2
        : toolbarState.canHeading3;
  const headingLabel = getText(
    headingLevel === 1
      ? "dailyMemo.syntaxToolbar.heading1"
      : headingLevel === 2
        ? "dailyMemo.syntaxToolbar.heading2"
        : "dailyMemo.syntaxToolbar.heading3",
  );

  return (
    <div
      ref={toolbarRef}
      aria-label={getText("dailyMemo.syntaxToolbar.label")}
      className="daily-memo-syntax-toolbar"
      id="daily-memo-syntax-toolbar"
      role="toolbar"
    >
      <div className="daily-memo-syntax-toolbar-viewport no-scrollbar">
        <div
          aria-label={getText("dailyMemo.syntaxToolbar.blockStyle")}
          className="daily-memo-syntax-toolbar-group"
          role="group"
        >
          <ToolbarButton
            active={toolbarState.paragraphActive}
            disabled={!toolbarState.canParagraph}
            label={getText("dailyMemo.syntaxToolbar.paragraph")}
            onActivate={() => {
              editor?.chain().focus().setParagraph().run();
            }}
          >
            <Pilcrow aria-hidden="true" size={18} />
          </ToolbarButton>
          <button
            ref={headingButtonRef}
            aria-expanded={headingMenuOpen}
            aria-haspopup="menu"
            aria-label={headingLabel}
            aria-pressed={headingActive}
            className="daily-memo-syntax-toolbar-button daily-memo-heading-trigger"
            data-active={headingActive || undefined}
            data-menu-open={headingMenuOpen || undefined}
            disabled={!headingAvailable}
            title={headingLabel}
            type="button"
            onClick={() => {
              if (suppressHeadingClickRef.current) {
                suppressHeadingClickRef.current = false;
                return;
              }

              applyHeading(headingLevel);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                openHeadingMenu();
              }
            }}
            onPointerCancel={clearHeadingLongPressTimer}
            onPointerDown={(event) => {
              event.preventDefault();
              clearHeadingLongPressTimer();
              suppressHeadingClickRef.current = false;
              headingLongPressTimerRef.current = window.setTimeout(() => {
                headingLongPressTimerRef.current = null;
                suppressHeadingClickRef.current = true;
                openHeadingMenu();
              }, HEADING_LONG_PRESS_DELAY);
            }}
            onPointerLeave={clearHeadingLongPressTimer}
            onPointerUp={clearHeadingLongPressTimer}
          >
            <span aria-hidden="true">H{headingLevel}</span>
          </button>
        </div>
        <div
          aria-label={getText("dailyMemo.syntaxToolbar.indentation")}
          className="daily-memo-syntax-toolbar-group"
          role="group"
        >
          <ToolbarButton
            active={false}
            disabled={!toolbarState.canOutdentListItem}
            label={getText("dailyMemo.syntaxToolbar.decreaseIndent")}
            onActivate={() => {
              if (!editor) {
                return;
              }

              editor
                .chain()
                .command(({ state, dispatch }) =>
                  liftMemoListItem(state, dispatch),
                )
                .run();
            }}
          >
            <ListIndentDecrease aria-hidden="true" size={19} />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            disabled={!toolbarState.canIndentListItem}
            label={getText("dailyMemo.syntaxToolbar.increaseIndent")}
            onActivate={() => {
              if (!editor) {
                return;
              }

              editor
                .chain()
                .command(({ state, dispatch }) =>
                  sinkMemoListItem(state, dispatch),
                )
                .run();
            }}
          >
            <ListIndentIncrease aria-hidden="true" size={19} />
          </ToolbarButton>
        </div>
        <div
          aria-label={getText("dailyMemo.syntaxToolbar.listStyle")}
          className="daily-memo-syntax-toolbar-group"
          role="group"
        >
          <ToolbarButton
            active={toolbarState.bulletListActive}
            disabled={!toolbarState.canBulletList}
            label={getText("dailyMemo.syntaxToolbar.bulletList")}
            onActivate={() => {
              editor?.chain().focus().toggleBulletList().run();
            }}
          >
            <ListIcon aria-hidden="true" size={19} />
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState.orderedListActive}
            disabled={!toolbarState.canOrderedList}
            label={getText("dailyMemo.syntaxToolbar.orderedList")}
            onActivate={() => {
              editor?.chain().focus().toggleOrderedList().run();
            }}
          >
            <ListOrdered aria-hidden="true" size={19} />
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState.taskListActive}
            disabled={!toolbarState.canTaskList}
            label={getText("dailyMemo.syntaxToolbar.taskList")}
            onActivate={() => {
              editor?.chain().focus().toggleTaskList().run();
            }}
          >
            <ListTodo aria-hidden="true" size={19} />
          </ToolbarButton>
        </div>
        <div
          aria-label={getText("dailyMemo.syntaxToolbar.inlineStyle")}
          className="daily-memo-syntax-toolbar-group"
          role="group"
        >
          <ToolbarButton
            active={toolbarState.strikeActive}
            disabled={!toolbarState.canStrike}
            label={getText("dailyMemo.syntaxToolbar.strike")}
            onActivate={() => {
              editor?.chain().focus().toggleStrike().run();
            }}
          >
            <Strikethrough aria-hidden="true" size={18} />
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState.boldActive}
            disabled={!toolbarState.canBold}
            label={getText("dailyMemo.syntaxToolbar.bold")}
            onActivate={() => {
              editor?.chain().focus().toggleBold().run();
            }}
          >
            <Bold aria-hidden="true" size={18} />
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState.italicActive}
            disabled={!toolbarState.canItalic}
            label={getText("dailyMemo.syntaxToolbar.italic")}
            onActivate={() => {
              editor?.chain().focus().toggleItalic().run();
            }}
          >
            <Italic aria-hidden="true" size={18} />
          </ToolbarButton>
        </div>
      </div>
      {headingMenuOpen ? (
        <div
          ref={headingMenuRef}
          aria-label={getText("dailyMemo.syntaxToolbar.headingMenu")}
          className="daily-memo-heading-menu"
          role="menu"
          style={{ left: headingMenuLeft }}
        >
          {([1, 2, 3] as const).map((level) => {
            const available =
              level === 1
                ? toolbarState.canHeading1
                : level === 2
                  ? toolbarState.canHeading2
                  : toolbarState.canHeading3;
            const label = getText(
              level === 1
                ? "dailyMemo.syntaxToolbar.heading1"
                : level === 2
                  ? "dailyMemo.syntaxToolbar.heading2"
                  : "dailyMemo.syntaxToolbar.heading3",
            );

            return (
              <button
                aria-checked={headingLevel === level}
                aria-label={label}
                className="daily-memo-heading-menu-item"
                data-selected={headingLevel === level || undefined}
                disabled={!available}
                key={level}
                role="menuitemradio"
                type="button"
                onClick={() => {
                  suppressHeadingClickRef.current = false;
                  setHeadingLevel(level);
                  setHeadingMenuOpen(false);
                  applyHeading(level);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                }}
              >
                H{level}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
