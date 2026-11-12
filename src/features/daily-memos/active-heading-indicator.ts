import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const ActiveHeadingIndicator = Extension.create({
  name: "activeHeadingIndicator",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("activeHeadingIndicator"),
        props: {
          decorations(state) {
            const { $from } = state.selection;

            for (let depth = $from.depth; depth > 0; depth -= 1) {
              const node = $from.node(depth);

              if (node.type.name !== "heading") {
                continue;
              }

              const position = $from.before(depth);
              const level = Number(node.attrs.level);

              return DecorationSet.create(state.doc, [
                Decoration.node(position, position + node.nodeSize, {
                  class: "daily-memo-active-heading",
                  "data-heading-level": `H${level}`,
                }),
              ]);
            }

            return DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
