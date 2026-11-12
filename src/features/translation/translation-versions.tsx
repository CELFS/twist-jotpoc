import { ErrorNotice } from "@/features/shell/notification-center";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { getText } from '@/i18n/get-text';
import { AssistantModelIcon } from '@/features/assistant/assistant-model-icon';
import { translationModels, type LocalTranslation } from '@/translation/contracts';
import type { TranslationClient } from './translation-client';

export function TranslationVersions({ record, client, disabled, onSelect }: { record: LocalTranslation; client: TranslationClient; disabled: boolean; onSelect(record: LocalTranslation): void }) {
  const [items, setItems] = useState<LocalTranslation[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const revision = useRef(0);
  const load = useCallback(async (before?: number) => {
    const current = ++revision.current; setLoading(true); setFailed(false);
    try {
      const page = await client.versions(record.id, before);
      if (current !== revision.current) return;
      setItems(old => before === undefined ? page : [...old, ...page.filter(item => !old.some(row => row.id === item.id))]); setMore(page.length === 25);
    } catch { if (current === revision.current) setFailed(true); }
    finally { if (current === revision.current) setLoading(false); }
  }, [client, record.id]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => { if (live) void load(); });
    return () => { live = false; revision.current++; };
  }, [load]);
  const choices = items.some(item => item.id === record.id) ? items.map(item => item.id === record.id ? record : item) : [record, ...items];
  return <div className="translation-versions">
    <SelectField listboxClassName="translation-version-options" labelHidden triggerContent={<span className="translation-version-value"><span>{getText('translation.version')} {record.version ?? 1}</span><AssistantModelIcon model={record.model} /></span>} optionVisuals={Object.fromEntries(choices.map(item => [item.id, <AssistantModelIcon key={item.id} model={item.model} />]))} label={getText('translation.versions')} value={record.id} disabled={disabled || loading} onChange={event => { const item = choices.find(item => item.id === event.target.value); if (item) onSelect(item); }}>
      {choices.map(item => <option key={item.id} value={item.id}>{getText('translation.version')} {item.version ?? 1} · {translationModels[item.model]}</option>)}
    </SelectField>
    {failed && <ErrorNotice text={getText('translation.readFailed')} />}
    {(more || failed) && <Button variant="ghost" disabled={disabled || loading} onClick={() => void load(failed ? undefined : items.at(-1)?.version)}>{getText(failed ? 'translation.refresh' : 'translation.more')}</Button>}
  </div>;
}
