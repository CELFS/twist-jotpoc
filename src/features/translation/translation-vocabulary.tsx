import { getText } from "@/i18n/get-text";
import type { AnalysisContent } from "@/translation/analysis-content";

const kindKeys = { word: 'translation.vocabularyWord', phrase: 'translation.vocabularyPhrase', abbreviation: 'translation.vocabularyAbbreviation' } as const;
export function TranslationVocabulary({ items }: { items?: AnalysisContent['vocabulary'] }) {
  if (!items?.length) return null;
  return <section className="translation-vocabulary">
    <h4>{getText('translation.vocabularyTitle')}</h4>
    <dl>{items.map((item, index) => <div key={`${item.term}-${index}`}>
      <dt><strong>{item.term}</strong><span className="translation-tag">{getText(kindKeys[item.kind])}</span></dt>
      <dd lang="zh-CN">{item.meaning}</dd>
    </div>)}</dl>
  </section>;
}
