"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export function TodaySelectionClose() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    const next = new URLSearchParams(search.toString());
    const sessionId = next.get("session");
    const taskId = next.get("task");
    next.delete("session");
    next.delete("task");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    requestAnimationFrame(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>(
        sessionId ? "[data-session-id]" : "[data-task-id]",
      );
      const target = Array.from(links).find((link) =>
        sessionId ? link.dataset.sessionId === sessionId : link.dataset.taskId === taskId,
      );
      target?.focus();
    });
  }, [pathname, router, search]);
  useEffect(() => {
    button.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <button
      ref={button}
      type="button"
      className="icon-button"
      aria-label="Close detail"
      onClick={close}
    >
      <X size={18} aria-hidden="true" />
    </button>
  );
}
