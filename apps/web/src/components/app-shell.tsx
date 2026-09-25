"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  Inbox,
  Layers3,
  Menu,
  Moon,
  Plus,
  Plug,
  Search,
  Settings,
  Sun,
  X,
  BookOpen,
  List,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
const primary: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/week", label: "Week", icon: CalendarRange },
  { href: "/upcoming", label: "Upcoming", icon: List },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];
const secondary: NavItem[] = [
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/availability", label: "Availability", icon: Layers3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  item,
  current,
  onSelect,
}: {
  item: NavItem;
  current: string;
  onSelect?: () => void;
}) {
  const Icon = item.icon;
  const active = current === item.href || current.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={`nav-link${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
      <span className="nav-label">{item.label}</span>
    </Link>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("up-theme", next);
    setTheme(next);
  }
  return (
    <button
      className="icon-button"
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Use light appearance" : "Use dark appearance"}
      title={theme === "dark" ? "Light appearance" : "Dark appearance"}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const panel = search.get("panel");
  const detail =
    (pathname === "/upcoming" ? null : search.get("assessment")) ?? search.get("course");
  const scenario = search.get("scenario");
  const conflict = search.get("conflict");
  const activePanel = panel || detail || scenario || conflict;
  const params = new URLSearchParams(search.toString());
  params.set("panel", "planner");
  const plannerHref = `${pathname}?${params.toString()}`;

  const closePanel = useCallback(() => {
    const next = new URLSearchParams(search.toString());
    for (const key of ["panel", "assessment", "course", "scenario", "conflict"]) next.delete(key);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [pathname, router, search]);
  useEffect(() => {
    if (!activePanel) return;
    closeRef.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
    // Panel focus and Escape follow URL state.
  }, [activePanel, closePanel]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push(plannerHref, { scroll: false });
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [plannerHref, router]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Application sidebar">
        <Link className="brand" href="/today">
          <span className="brand-mark" aria-hidden="true">
            U
          </span>
          <span className="brand-name">University Planner</span>
        </Link>
        <nav aria-label="Primary navigation" className="nav-group">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} current={pathname} />
          ))}
        </nav>
        <nav aria-label="Secondary navigation" className="nav-group secondary">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} current={pathname} />
          ))}
        </nav>
      </aside>
      <header className="topbar">
        <button
          className="icon-button tablet-menu"
          aria-label="Open navigation"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} />
        </button>
        <Link href={plannerHref} ref={triggerRef} className="command-trigger">
          <Search size={18} aria-hidden="true" />
          <span>Search or ask planner…</span>
          <kbd>⌘ K</kbd>
        </Link>
        <div className="topbar-actions">
          <Link href="/inbox?capture=1" className="button button-primary quick-add">
            <Plus size={18} aria-hidden="true" />
            Add
          </Link>
          <ThemeToggle />
          <div className="account-control">
            <button
              className="icon-button"
              type="button"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <CircleUserRound size={19} aria-hidden="true" />
            </button>
            {accountOpen && (
              <nav className="account-menu" aria-label="Account options">
                <Link href="/settings" onClick={() => setAccountOpen(false)}>
                  Settings
                </Link>
                <button type="button" onClick={() => void signOut({ callbackUrl: "/sign-in" })}>
                  Sign out
                </button>
              </nav>
            )}
          </div>
        </div>
      </header>
      <main className="main-content" id="main-content">
        {children}
      </main>
      <AnimatePresence>
        {activePanel && (
          <motion.aside
            key="right-panel"
            className="right-panel"
            aria-label="Detail panel"
            role="dialog"
            aria-modal="false"
            initial={reduced ? false : { x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: 28, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
          >
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">University Planner</p>
                <h2>
                  {panel === "planner"
                    ? "Planner"
                    : detail
                      ? "Detail"
                      : scenario
                        ? "Scenario"
                        : "Conflict"}
                </h2>
              </div>
              <button
                ref={closeRef}
                className="icon-button"
                aria-label="Close panel"
                onClick={closePanel}
              >
                <X size={18} />
              </button>
            </div>
            <p className="panel-message">
              {panel === "planner"
                ? "Planner commands will be available in a later Milestone 5 slice."
                : "This detail view will be connected in a later Milestone 5 slice."}
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {primary.slice(0, 2).map((item) => (
          <NavLink key={item.href} item={item} current={pathname} />
        ))}
        <Link href="/inbox?capture=1" className="mobile-add" aria-label="Quick Add">
          <Plus size={22} aria-hidden="true" />
          <span>Quick Add</span>
        </Link>
        {primary.slice(2).map((item) => (
          <NavLink key={item.href} item={item} current={pathname} />
        ))}
      </nav>
      {menuOpen && (
        <div className="menu-backdrop" onClick={() => setMenuOpen(false)}>
          <aside
            className="mobile-menu"
            onClick={(event) => event.stopPropagation()}
            aria-label="Navigation menu"
          >
            <div className="mobile-menu-head">
              <strong>University Planner</strong>
              <button
                className="icon-button"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <nav aria-label="Primary navigation">
              {primary.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  current={pathname}
                  onSelect={() => setMenuOpen(false)}
                />
              ))}
            </nav>
            <nav aria-label="Secondary navigation" className="nav-group secondary">
              {secondary.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  current={pathname}
                  onSelect={() => setMenuOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
