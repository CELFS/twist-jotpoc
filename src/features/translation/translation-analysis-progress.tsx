
import { GenerationState } from "@/components/ui/generation-state";
import { getText } from "@/i18n/get-text";

export function TranslationAnalysisProgress({ text }: { text?: string }) {
  return <div className="translation-analysis-progress"><GenerationState label={getText("translation.analyzing")} text={text} lang="zh-CN" /></div>;
}
