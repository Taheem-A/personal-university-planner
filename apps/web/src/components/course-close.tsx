"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function CourseClose({ id }: { id: string }) {
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    const restore = () => {
      if (document.querySelector(".courses-content")?.classList.contains("course-open"))
        return false;
      const target = (document.querySelector(`[data-course-id="${CSS.escape(id)}"]`) ??
        document.querySelector("#courses-title")) as HTMLElement | null;
      target?.focus();
      return Boolean(target);
    };
    const observer = new MutationObserver(() => {
      if (restore()) observer.disconnect();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 3000);
    router.replace("/courses", { scroll: false });
  }, [id, router]);
  useEffect(() => {
    button.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [close]);
  return (
    <button
      ref={button}
      className="icon-button course-close"
      type="button"
      aria-label="Close course detail"
      onClick={close}
    >
      <X size={18} aria-hidden="true" />
    </button>
  );
}
