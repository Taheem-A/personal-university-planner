"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function AppearanceControl({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () =>
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const frame = requestAnimationFrame(sync);
    window.addEventListener("up-theme-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("up-theme-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("up-theme", next);
    setTheme(next);
    window.dispatchEvent(new Event("up-theme-change"));
  }
  const label = theme === "dark" ? "Use light appearance" : "Use dark appearance";
  return (
    <button
      className={compact ? "icon-button" : "button button-secondary"}
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
      {!compact && <span>{label}</span>}
    </button>
  );
}
