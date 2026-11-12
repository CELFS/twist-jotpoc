
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import type { TranslationDictionary } from "@/translation/contracts";
import type { useTranslationSpeech } from "./translation-speech";

export function TranslationPronunciation({ text, dictionary, active = true, speech }: { text: string; dictionary?: TranslationDictionary; active?: boolean; speech: ReturnType<typeof useTranslationSpeech> }) {
  return <section className="translation-learning-section translation-pronunciation" aria-label={getText("translation.pronunciation")}>
    <header><h3>{getText("translation.pronunciation")}</h3><Button variant="ghost" size="icon" disabled={!speech.selected || !active} aria-label={getText("translation.readAloud")} title={getText("translation.readAloud")} onClick={() => speech.speak(text)}><Volume2 size={15} /></Button>{speech.speaking && <Button variant="ghost" size="icon" aria-label={getText("translation.stopReading")} title={getText("translation.stopReading")} onClick={speech.stop}><Square size={14} /></Button>}</header>
    {dictionary?.status === "available" && dictionary.entries.map((entry, index) => <div className="translation-phonetics" key={`${entry.word}-${index}`}>
      <strong lang="en">{entry.word}</strong>{entry.phonetics.map(phonetic => <span key={phonetic} lang="en">{phonetic}</span>)}
      {!entry.phonetics.length && <span>{getText("translation.phoneticsUnavailable")}</span>}
    </div>)}
    {speech.failed && <p role="alert" className="translation-error">{getText("translation.speechFailed")}</p>}
  </section>;
}
