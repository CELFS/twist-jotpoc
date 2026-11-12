
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { resolveDailyMemoCopyText } from "@/features/daily-memos/daily-memo-copy";
import { getText } from "@/i18n/get-text";

export function MemoInfoBlockCopyButton({ content, text: plainText }: { content: JSONContent[]; text?: never } | { content?: never; text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const copying = useRef(false);

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    if (copying.current) return;
    copying.current = true;
    setBusy(true);
    setStatus("idle");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard unavailable");
      }
      // Copy the body as a document, excluding the block's source label.
      const text = plainText === undefined ? resolveDailyMemoCopyText("", { type: "doc", content }) : Promise.resolve(plainText);
      // Keep clipboard activation within the click, including linked note resolution.
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": text.then((value) => new Blob([value], { type: "text/plain" })),
      })]);
      setStatus("copied");
    } catch {
      setStatus("failed");
    } finally {
      copying.current = false;
      setBusy(false);
    }
  };

  return <>
    <button className="daily-memo-info-block-icon-button" type="button" disabled={busy}
      aria-label={getText("dailyMemo.infoBlock.copy")} title={getText("dailyMemo.infoBlock.copy")}
      onClick={() => void copy()}>
      {status === "copied" ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
    </button>
    <span className="daily-memo-info-block-copy-feedback" role={status === "failed" ? "alert" : "status"}>
      {status === "idle" ? null : getText(status === "copied" ? "dailyMemo.infoBlock.copied" : "dailyMemo.infoBlock.copyFailed")}
    </span>
  </>;
}
