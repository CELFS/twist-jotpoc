import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
} from "lucide-react";
import {
  mergeAttributes,
  Node,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type MarkdownParseHelpers,
  type MarkdownParseResult,
  type MarkdownToken,
  type NodeViewProps,
} from "@tiptap/react";
import { Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/select-field";
import type { MemoSourcePreset } from "@/data/models";
import { MemoSourceVisual } from "@/features/daily-memos/memo-source-visual";
import { MemoInfoBlockCopyButton } from "@/features/daily-memos/memo-info-block-copy-button";
import { useMemoInfoBlockDrag } from "@/features/daily-memos/use-memo-info-block-drag";
import { memoInfoBlockMarkdownSpec } from "./daily-memo-markdown-specs";
import { getText } from "@/i18n/get-text";

export type MemoInfoBlockOptions = {
  readOnly: boolean;
  sourcePresets: MemoSourcePreset[];
};

const memoInfoBlockCollapsedState = new WeakMap<object, boolean>();

export function stripMemoInfoBlockClipboardContext(slice: Slice) {
  const memoInfoBlock = slice.content.firstChild;

  if (
    slice.content.childCount !== 1 ||
    memoInfoBlock?.type.name !== "memoInfoBlock" ||
    slice.openStart < 1 ||
    slice.openEnd < 1
  ) {
    return slice;
  }

  return new Slice(
    memoInfoBlock.content,
    slice.openStart - 1,
    slice.openEnd - 1,
  );
}

function MemoInfoBlockView({
  deleteNode,
  editor,
  extension,
  getPos,
  node,
  updateAttributes,
}: NodeViewProps) {
  const editable = useEditorState({ editor, selector: ({ editor: current }) => current.isEditable });
  const [collapsed, setCollapsed] = useState(
    () => memoInfoBlockCollapsedState.get(node) ?? false,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sourcePresets = extension.options.sourcePresets as MemoSourcePreset[];
  const sourceName = String(node.attrs.sourceName || "");
  const currentSource = sourcePresets.find(
    (preset) => preset.id === node.attrs.sourceId,
  );
  const sourceVisuals = Object.fromEntries(
    sourcePresets.map((preset) => [
      preset.id,
      <MemoSourceVisual
        color={preset.color}
        key={preset.id}
        size={14}
      />,
    ]),
  );
  const {
    dragHandleProps,
    dragging,
  } = useMemoInfoBlockDrag({ editor, getPos });

  useEffect(() => {
    memoInfoBlockCollapsedState.set(node, collapsed);
  }, [collapsed, node]);

  useEffect(() => {
    if (
      !extension.options.readOnly && editable &&
      currentSource &&
      currentSource.name !== sourceName
    ) {
      updateAttributes({ sourceName: currentSource.name });
    }
  }, [currentSource, editable, extension.options.readOnly, sourceName, updateAttributes]);

  if (extension.options.readOnly) {
    return (
      <NodeViewWrapper className="daily-memo-info-block" data-read-only="true">
        <header
          className="daily-memo-info-block-header"
          contentEditable={false}
          data-memo-info-block-ui=""
        >
          <strong>{sourceName}</strong>
        </header>
        <NodeViewContent className="daily-memo-info-block-body" />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="daily-memo-info-block"
      data-collapsed={collapsed || undefined}
      data-drag-source={dragging || undefined}
      data-first-node={getPos() === 0 || undefined}
      data-settings-open={settingsOpen || undefined}
    >
      <header
        className="daily-memo-info-block-header"
        contentEditable={false}
        data-memo-info-block-ui=""
      >
        {!editable ? <strong>{sourceName}</strong> : settingsOpen ? (
          <strong>{getText("dailyMemo.infoBlock.settingsTitle")}</strong>
        ) : (
          <div className="daily-memo-info-block-source-field">
            <SelectField
              className="daily-memo-info-block-source-select"
              label={getText("dailyMemo.infoBlock.sourceLabel")}
              optionVisuals={sourceVisuals}
              value={String(node.attrs.sourceId || "")}
              onChange={(event) => {
                const nextSource = sourcePresets.find(
                  (preset) => preset.id === event.target.value,
                );

                if (!nextSource) {
                  return;
                }

                updateAttributes({
                  sourceId: nextSource.id,
                  sourceName: nextSource.name,
                });
              }}
            >
              {sourcePresets.length === 0 ? (
                <option value={String(node.attrs.sourceId || "")}>
                  {sourceName || getText("dailyMemo.infoBlock.unknownSource")}
                </option>
              ) : null}
              {sourcePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </SelectField>
            <MemoInfoBlockCopyButton content={node.toJSON().content ?? []} />
          </div>
        )}
        <div className="daily-memo-info-block-header-actions">
          <button
            {...dragHandleProps}
            disabled={!editable}
            className="daily-memo-info-block-drag-handle"
            contentEditable={false}
            data-drag-handle=""
            aria-label={getText("dailyMemo.infoBlock.reorder")}
            title={getText("dailyMemo.infoBlock.reorder")}
            type="button"
          >
            <GripVertical aria-hidden="true" size={18} />
          </button>
          <button
            aria-label={getText("dailyMemo.infoBlock.settings")}
            disabled={!editable}
            className="daily-memo-info-block-icon-button"
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <ArrowRightLeft aria-hidden="true" size={17} />
          </button>
          <button
            aria-label={getText(
              collapsed
                ? "dailyMemo.infoBlock.expand"
                : "dailyMemo.infoBlock.collapse",
            )}
            className="daily-memo-info-block-icon-button"
            type="button"
            onClick={() => {
              setCollapsed((value) => {
                const nextValue = !value;
                memoInfoBlockCollapsedState.set(node, nextValue);
                return nextValue;
              });
            }}
          >
            {collapsed ? (
              <ChevronDown aria-hidden="true" size={19} />
            ) : (
              <ChevronUp aria-hidden="true" size={19} />
            )}
          </button>
        </div>
      </header>
      {settingsOpen && editable ? (
        <div
          className="daily-memo-info-block-settings"
          contentEditable={false}
          data-memo-info-block-ui=""
        >
          <p>{getText("dailyMemo.infoBlock.settingsDescription")}</p>
          <button
            className="daily-memo-info-block-delete"
            type="button"
            onClick={deleteNode}
          >
            <Trash2 aria-hidden="true" size={16} />
            {getText("dailyMemo.infoBlock.delete")}
          </button>
        </div>
      ) : null}
      <NodeViewContent
        className="daily-memo-info-block-body"
        data-hidden={collapsed || undefined}
      />
    </NodeViewWrapper>
  );
}

const defaultMemoInfoBlockMarkdown = memoInfoBlockMarkdownSpec;
const memoInfoBlockMarkdown = {
  ...defaultMemoInfoBlockMarkdown,
  parseMarkdown(
    token: MarkdownToken,
    helpers: MarkdownParseHelpers,
  ): MarkdownParseResult {
    const parsed = defaultMemoInfoBlockMarkdown.parseMarkdown(token, helpers);

    if (
      Array.isArray(parsed) ||
      "mark" in parsed ||
      parsed.type !== "memoInfoBlock" ||
      (parsed.content?.length ?? 0) > 0
    ) {
      return parsed;
    }

    return {
      ...parsed,
      content: [helpers.createNode("paragraph")],
    };
  },
};

export const MemoInfoBlock = Node.create<MemoInfoBlockOptions>({
  name: "memoInfoBlock",
  group: "block",
  content: "block+",
  draggable: false,
  isolating: true,
  defining: true,
  addOptions() {
    return {
      readOnly: false,
      sourcePresets: [],
    };
  },
  addAttributes() {
    return {
      sourceId: {
        default: "",
      },
      sourceName: {
        default: "",
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "section[data-daily-memo-info-block]",
        getAttrs: (element) => {
          const node = element as HTMLElement;
          return {
            sourceId: node.dataset.sourceId ?? "",
            sourceName: node.dataset.sourceName ?? "",
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { sourceId, sourceName, ...restAttributes } = HTMLAttributes;

    return [
      "section",
      mergeAttributes(restAttributes, {
        "data-daily-memo-info-block": "true",
        "data-source-id": sourceId,
        "data-source-name": sourceName,
      }),
      [
        "header",
        { "data-daily-memo-info-block-header": "true" },
        String(sourceName ?? ""),
      ],
      ["div", { "data-daily-memo-info-block-body": "true" }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MemoInfoBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target;

        return (
          target instanceof Element &&
          Boolean(target.closest("[data-memo-info-block-ui]"))
        );
      },
    });
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformCopied: stripMemoInfoBlockClipboardContext,
          transformPasted: (slice, view) => {
            const { $from } = view.state.selection;

            for (let depth = $from.depth; depth > 0; depth -= 1) {
              if ($from.node(depth).type.name === this.name) {
                return stripMemoInfoBlockClipboardContext(slice);
              }
            }

            return slice;
          },
        },
      }),
    ];
  },
  ...memoInfoBlockMarkdown,
});
