"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export function AssessmentClose({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    const next = new URLSearchParams(search.toString());
    next.delete("assessment");
    next.delete("view");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("[data-assessment-id]"),
      ).find((link) => link.dataset.assessmentId === id);
      (target ?? document.querySelector<HTMLElement>("#upcoming-title"))?.focus();
    });
  }, [id, pathname, router, search]);
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
      className="icon-button"
      type="button"
      aria-label="Close assessment detail"
      onClick={close}
    >
      <X size={18} aria-hidden="true" />
    </button>
  );
}
