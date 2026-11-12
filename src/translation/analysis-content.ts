// Keep analysis normalization aligned across the website, service and extension.
// Missing or invalid sections must not discard unrelated, usable teaching material.
export type AnalysisContent = {
  explanation: string; usage: string[]; examples: { text: string; translation: string }[];
  vocabulary?: { term: string; kind: 'word' | 'phrase' | 'abbreviation'; meaning: string }[];
  english?: { explanation: string; usage: string[] };
};
const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() && value.length <= max ? value.trim() : '';
const notes = (value: unknown) => Array.isArray(value) ? value.map(item => text(item, 600)).filter(Boolean).slice(0, 5) : [];
export function normalizeAnalysisContent(value: unknown): AnalysisContent | null {
  const raw = object(value);
  if (!raw) return null;
  const english = object(raw.english);
  const englishExplanation = text(english?.explanation, 3000);
  const englishUsage = notes(english?.usage);
  const content: AnalysisContent = {
    explanation: text(raw.explanation, 3000),
    usage: notes(raw.usage),
    examples: Array.isArray(raw.examples) ? raw.examples.flatMap(item => {
      const example = object(item);
      const original = text(example?.text, 600);
      const translation = text(example?.translation, 600);
      return original && translation ? [{ text: original, translation }] : [];
    }).slice(0, 3) : [],
    ...(Array.isArray(raw.vocabulary) ? { vocabulary: raw.vocabulary.flatMap((item): NonNullable<AnalysisContent['vocabulary']> => {
      const entry = object(item);
      const term = text(entry?.term, 80);
      const meaning = text(entry?.meaning, 120);
      const kind = entry?.kind;
      return term && meaning && (kind === 'word' || kind === 'phrase' || kind === 'abbreviation') ? [{ term, kind, meaning }] : [];
    }).slice(0, 3) } : {}),
    ...(englishExplanation || englishUsage.length ? { english: { explanation: englishExplanation, usage: englishUsage } } : {}),
  };
  return content.explanation || content.usage.length || content.examples.length || content.english || content.vocabulary?.length ? content : null;
}
export function isAnalysisComplete(content: AnalysisContent, englishAnalysis: boolean) {
  const explanation = englishAnalysis ? content.english?.explanation : content.explanation;
  const usage = englishAnalysis ? content.english?.usage : content.usage;
  return !!explanation && !!usage?.length && content.examples.length > 0;
}
