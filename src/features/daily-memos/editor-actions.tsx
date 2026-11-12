import { Redo2, Type, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import { useTranslationPreference } from "@/features/translation/use-translation-preference";
import type { DailyMemoEditorHistoryState } from "./daily-memo-rich-text-editor";

export function useFormattingPreference() {
  return useTranslationPreference("dailyMemo.syntaxToolbarExpanded", false);
}

export function EditorActions({ readOnly, history, preference, onUndo, onRedo }: {
  readOnly: boolean;
  history: DailyMemoEditorHistoryState;
  preference: ReturnType<typeof useFormattingPreference>;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const label = getText(preference.value ? "dailyMemo.syntaxToolbar.collapse" : "dailyMemo.syntaxToolbar.expand");
  return <>
    <Button variant="ghost" size="icon" aria-label={getText("client.undo")} disabled={readOnly || !history.canUndo} onClick={onUndo}><Undo2 size={17} /></Button>
    <Button variant="ghost" size="icon" aria-label={getText("client.redo")} disabled={readOnly || !history.canRedo} onClick={onRedo}><Redo2 size={17} /></Button>
    <Button variant="ghost" size="icon" aria-label={label} title={label} aria-expanded={!readOnly && preference.value}
      disabled={readOnly || !preference.ready || preference.saving} onPointerDown={event => event.preventDefault()}
      onClick={() => void preference.toggle()}><Type size={17} /></Button>
  </>;
}
