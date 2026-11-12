import type { AnchorHTMLAttributes } from "react";
import { openNote } from "@/platform/navigation";

export function ResilientLink({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const target = new URL(href, window.location.href);
    const noteId = target.searchParams.get("note");
    if (target.pathname === "/source-notes/" && noteId) {
      event.preventDefault();
      openNote(noteId);
    }
  }}>{children}</a>;
}
