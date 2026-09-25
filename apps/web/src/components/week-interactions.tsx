"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export function WeekSelectionClose() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    const next = new URLSearchParams(search.toString());
    const id = next.get("session") ?? next.get("event");
    const deadline = next.get("deadline");
    next.delete("session");
    next.delete("event");
    next.delete("deadline");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("[data-week-object], [data-week-deadline]"),
      ).find(
        (link) =>
          (id ? link.dataset.weekObject === id : link.dataset.weekDeadline === deadline) &&
          link.getClientRects().length > 0,
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

export function WeekSwipe({
  previous,
  next,
  children,
}: {
  previous: string;
  next: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onTouchStart={(event) => {
        start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }}
      onTouchEnd={(event) => {
        if (!start.current) return;
        const dx = event.changedTouches[0].clientX - start.current.x;
        const dy = event.changedTouches[0].clientY - start.current.y;
        if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
          router.push(dx > 0 ? previous : next, { scroll: false });
        start.current = null;
      }}
    >
      {children}
    </div>
  );
}
