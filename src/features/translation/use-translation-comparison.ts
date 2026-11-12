
import { generationErrorCode } from '@/translation/generation-error';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { comparisonLanguages, type ComparisonInput, type ComparisonLanguage, type ComparisonResult } from '@/translation/comparison-contracts';
import { compareTranslation } from './comparison-client';

type Card = { working?: boolean; text?: string; result?: ComparisonResult; error?: string };
export function useTranslationComparison(input: Omit<ComparisonInput, 'language'>, enabled: boolean, paused: boolean, stopKey: number, selectedLanguages: readonly ComparisonLanguage[] = comparisonLanguages) {
  const languageKey = comparisonLanguages.filter(language => selectedLanguages.includes(language)).join(",");
  const languages = useMemo(() => comparisonLanguages.filter(language => languageKey.split(",").includes(language)), [languageKey]);
  const { sourceLanguage, model } = input;
  const text = input.text.trim();
  const identity = JSON.stringify([text, sourceLanguage, model, languageKey]);
  const previousIdentity = useRef(identity);
  const [cards, setCards] = useState<Partial<Record<ComparisonLanguage, Card>>>({});
  const requests = useRef(new Map<ComparisonLanguage, AbortController>());
  const revision = useRef(0);
  const abortAll = useCallback(() => {
    revision.current++;
    for (const controller of requests.current.values()) controller.abort();
    requests.current.clear();
  }, []);
  const stop = useCallback(() => {
    abortAll();
    setCards(previous => Object.fromEntries(Object.entries(previous).map(([language, card]) => [language, { ...card, working: false, text: undefined }])));
  }, [abortAll]);
  const runLanguage = useCallback((language: ComparisonLanguage, fresh: boolean) => {
    if (!enabled || !text || !languages.includes(language) || requests.current.has(language)) return;
    const controller = new AbortController();
    const current = revision.current;
    requests.current.set(language, controller);
    const update = (value: Card) => {
      if (!controller.signal.aborted && revision.current === current && requests.current.get(language) === controller) setCards(previous => ({ ...previous, [language]: value }));
    };
    update({ working: true });
    let preview = "";
    // Each language settles independently; neither failure nor completion gates the original translation.
    void compareTranslation({ text, sourceLanguage, model, language }, { signal: controller.signal, fresh,
      onText: text => { preview = text; update({ working: true, text }); },
    }).then(result => update({ result }), error => update({ text: preview, error: generationErrorCode(error) ?? (['signedOut', 'rateLimited'].includes(error?.message) ? error.message : 'failed') })).finally(() => {
      if (requests.current.get(language) === controller) requests.current.delete(language);
    });
  }, [text, sourceLanguage, model, enabled, languages]);
  const start = useCallback((fresh = false) => {
    stop();
    if (!enabled || !text) return;
    setCards({});
    for (const language of languages) runLanguage(language, fresh);
  }, [enabled, text, stop, languages, runLanguage]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      if (previousIdentity.current !== identity) { previousIdentity.current = identity; setCards({}); }
      if (!paused) start(); else stop();
    });
    return () => { live = false; abortAll(); };
  }, [start, stop, abortAll, paused, stopKey, identity]);
  return { cards, start, stop, retry: (language: ComparisonLanguage) => runLanguage(language, true), working: Object.values(cards).some(card => card.working) };
}
