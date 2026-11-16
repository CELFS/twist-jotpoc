import { Redo2, Type, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import { useTranslationPreference } from "@/features/translation/use-translation-preference";
import type { DailyMemoEditorHistoryState } from "./daily-memo-rich-text-editor";

export function useFormattingPreference() {
  return useTranslationPreference("dailyMemo.syntaxToolbarExpanded", false);
}

type HistoryActionsProps = {
  readOnly: boolean;
  history: DailyMemoEditorHistoryState;
  onUndo: () => void;
  onRedo: () => void;
};

type FormatToggleProps = {
  readOnly: boolean;
  preference: ReturnType<typeof useFormattingPreference>;
};

export function HistoryActions({ readOnly, history, onUndo, onRedo }: HistoryActionsProps) {
  return <>
    <Button variant="ghost" size="icon" aria-label={getText("client.undo")} disabled={readOnly || !history.canUndo} onClick={onUndo}><Undo2 size={17} /></Button>
    <Button variant="ghost" size="icon" aria-label={getText("client.redo")} disabled={readOnly || !history.canRedo} onClick={onRedo}><Redo2 size={17} /></Button>
  </>;
}

export function FormatToggle({ readOnly, preference }: FormatToggleProps) {
  const label = getText(preference.value ? "dailyMemo.syntaxToolbar.collapse" : "dailyMemo.syntaxToolbar.expand");
  return <Button variant="ghost" size="icon" aria-label={label} title={label} aria-controls="daily-memo-syntax-toolbar" aria-expanded={!readOnly && preference.value}
      disabled={readOnly || !preference.ready || preference.saving} onPointerDown={event => event.preventDefault()}
      onClick={() => void preference.toggle()}><Type size={17} /></Button>;
}

export function EditorActions({ preference, ...historyProps }: HistoryActionsProps & FormatToggleProps) {
  return <>
    <HistoryActions {...historyProps} />
    <FormatToggle readOnly={historyProps.readOnly} preference={preference} />
  </>;
}
