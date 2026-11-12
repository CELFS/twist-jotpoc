
import { Drawer } from "@/components/ui/drawer";
import type { MemoSourcePreset } from "@/data/models";
import { MemoSourceVisual } from "@/features/daily-memos/memo-source-visual";
import { getText } from "@/i18n/get-text";

export function MemoInfoBlockSourceDrawer({
  onClose,
  onSelect,
  sourcePresets,
}: {
  onClose: () => void;
  onSelect: (source: MemoSourcePreset) => void;
  sourcePresets: MemoSourcePreset[];
}) {
  const label = getText("dailyMemo.infoBlock.sourcePickerLabel");

  return (
    <Drawer
      ariaLabel={label}
      className="daily-memo-info-block-source-drawer"
      contentClassName="daily-memo-info-block-source-drawer-content custom-scrollbar"
      header={
        <header className="daily-memo-info-block-source-drawer-header">
          <h2>{label}</h2>
        </header>
      }
      onClose={onClose}
      persistent
    >
      {sourcePresets.length > 0 ? (
        <div
          aria-label={label}
          className="daily-memo-info-block-source-list"
          role="listbox"
        >
          {sourcePresets.map((source) => (
            <button
              key={source.id}
              aria-selected={false}
              role="option"
              type="button"
              onClick={() => onSelect(source)}
            >
              <MemoSourceVisual color={source.color} size={15} />
              <span>{source.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="daily-memo-info-block-source-empty">
          {getText("dailyMemo.infoBlock.noSources")}
        </p>
      )}
    </Drawer>
  );
}
