import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { getText } from "@/i18n/get-text";

export function TranslationSourceCard({ url, title }: { url: string; title: string }) {
  const domain = new URL(url).hostname;
  return <a className="translation-source-card" href={url} target="_blank" rel="noopener noreferrer" title={title || url} aria-label={`${getText("translation.source")}: ${title || domain}`}>
    <LinkIcon size={16} aria-hidden="true" />
    <span className="translation-source-card-text"><strong>{title || domain}</strong><small>{domain}</small></span>
    <ExternalLink size={13} aria-hidden="true" />
  </a>;
}
