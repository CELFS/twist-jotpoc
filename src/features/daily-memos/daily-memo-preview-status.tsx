import { BookOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { getText } from "@/i18n/get-text";

export function DailyMemoPreviewStatus() {
  const pageRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const editorPage = page?.closest(".memo-workspace");
    if (!page || !editorPage) return;
    let animation: Animation | undefined;
    let animationScrollingDown: boolean | undefined;
    const scrollPositions = new WeakMap<Element, number>();
    editorPage.querySelectorAll(".daily-memo-rich-text-editor-content").forEach((element) => {
      scrollPositions.set(element, element.scrollTop);
    });
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Element) ||
        !event.target.closest(".daily-memo-rich-text-editor-content")) return;
      const scrollTop = event.target.scrollTop;
      const previousScrollTop = scrollPositions.get(event.target) ?? scrollTop;
      scrollPositions.set(event.target, scrollTop);
      if (scrollTop === previousScrollTop ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const scrollingDown = scrollTop > previousScrollTop;
      // Let each page turn finish instead of restarting it on every scroll event.
      if (animation?.playState === "running" && animationScrollingDown === scrollingDown) return;
      animation?.cancel();
      animationScrollingDown = scrollingDown;
      const startTransform = scrollingDown
        ? "perspective(60px) rotateY(0deg)"
        : "perspective(60px) rotateY(-180deg)";
      const endTransform = scrollingDown
        ? "perspective(60px) rotateY(-180deg)"
        : "perspective(60px) rotateY(0deg)";
      animation = page.animate([
        { offset: 0, opacity: 0, transform: startTransform },
        { offset: 0.2, opacity: 0.8 },
        { offset: 0.8, opacity: 0.8 },
        { offset: 1, opacity: 0, transform: endTransform },
      ], { duration: 900, easing: "ease-in-out" });
    };
    editorPage.addEventListener("scroll", onScroll, true);
    return () => {
      editorPage.removeEventListener("scroll", onScroll, true);
      animation?.cancel();
    };
  }, []);

  return (
    <div className="daily-memo-preview-status" role="status">
      <span className="daily-memo-preview-book" aria-hidden="true">
        <BookOpen size={15} />
        <svg ref={pageRef} className="daily-memo-preview-book-page" viewBox="0 0 24 24" fill="none">
          <path d="M12 5Q16 2 21 3V19Q16 18 12 21Z" />
        </svg>
      </span>
      <span>{getText("dailyMemo.previewing")}</span>
    </div>
  );
}
