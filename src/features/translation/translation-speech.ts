
import { useCallback, useEffect, useRef, useState } from "react";

export function useTranslationSpeech(text: string, active: boolean) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const stop = useCallback(() => {
    if (!current.current) return;
    current.current = null;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    let mounted = true;
    const update = () => { if (mounted) setVoices(window.speechSynthesis.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)).sort((a, b) => Number(b.localService) - Number(a.localService))); };
    void Promise.resolve().then(update);
    window.speechSynthesis.addEventListener("voiceschanged", update);
    window.addEventListener("pagehide", stop);
    window.addEventListener("blur", stop);
    window.addEventListener("twill:translation-hide", stop);
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false; stop();
      window.speechSynthesis.removeEventListener("voiceschanged", update);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("blur", stop);
      window.removeEventListener("twill:translation-hide", stop);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [stop]);
  useEffect(() => { return stop; }, [text, active, stop]);
  const selected = voices.find(voice => voice.voiceURI === voiceId) ?? voices[0];
  function speak(value: string) {
    if (!active || !selected || !value.trim()) return;
    const voice = selected;
    stop(); setFailed(false);
    // Short utterances avoid Chromium interrupting a long passage mid-sentence.
    const chunks = value.trim().match(/[^.!?\n]{1,180}(?:[.!?\n]+|\s|$)|[\s\S]{1,180}/g) ?? [];
    function next() {
      const part = chunks.shift();
      if (!part) { current.current = null; setSpeaking(false); return; }
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.voice = voice; utterance.lang = voice.lang;
      utterance.onend = () => { if (current.current === utterance) next(); };
      utterance.onerror = event => {
        if (current.current !== utterance) return;
        current.current = null; setSpeaking(false);
        if (event.error !== "canceled" && event.error !== "interrupted") setFailed(true);
      };
      current.current = utterance; setSpeaking(true);
      try { window.speechSynthesis.speak(utterance); }
      catch { current.current = null; setSpeaking(false); setFailed(true); }
    }
    next();
  }
  return { voices, selected, voiceId: selected?.voiceURI ?? "", setVoiceId: (id: string) => { stop(); setVoiceId(id); }, speaking, failed, speak, stop };
}
