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
  Plus,
  Plug,
  Search,
  Settings,
  X,
  BookOpen,
  List,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppearanceControl } from "./appearance-control";
import { PlannerSurface } from "./planner-surface";

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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreTrigger = useRef(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLElement>(null);
  const panel = search.get("panel");
  const detail =
    (pathname === "/upcoming" ? null : search.get("assessment")) ??
    (pathname === "/courses" ? null : search.get("course"));
  const scenario = search.get("scenario");
  const conflict = search.get("conflict");
  const activePanel = scenario ? "scenario" : conflict ? "conflict" : panel || detail;
  const params = new URLSearchParams(search.toString());
  params.set("panel", "planner");
  const plannerHref = `${pathname}?${params.toString()}`;

  const closePanel = useCallback(() => {
    const next = new URLSearchParams(search.toString());
    if (scenario) next.delete("scenario");
    else if (conflict) next.delete("conflict");
    else if (panel) next.delete("panel");
    else for (const key of ["assessment", "course"]) next.delete(key);
    restoreTrigger.current = true;
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, search, scenario, conflict, panel]);
  useEffect(() => {
    if (!activePanel && restoreTrigger.current) {
      restoreTrigger.current = false;
      triggerRef.current?.focus();
    }
  }, [activePanel]);
  useEffect(() => {
    if (!activePanel) return;
    restoreTrigger.current = false;
    closeRef.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
      if (event.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
          ),
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!panelRef.current.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
    // Panel focus and Escape follow URL state.
  }, [activePanel, closePanel]);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuCloseRef.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, [closeMenu, menuOpen]);
  useEffect(() => {
    if (!accountOpen) return;
    function dismiss(event: PointerEvent) {
      if (
        accountMenuRef.current?.contains(event.target as Node) ||
        accountTriggerRef.current?.contains(event.target as Node)
      )
        return;
      setAccountOpen(false);
    }
    function keydown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setAccountOpen(false);
      accountTriggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown);
    };
  }, [accountOpen]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement | null;
        if (
          target?.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
        )
          return;
        event.preventDefault();
        router.push(plannerHref, { scroll: false });
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [plannerHref, router]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar" aria-label="Application sidebar">
        <Link className="brand" href="/today">
          <span className="brand-mark" aria-hidden="true">
            <GraduationCap size={20} strokeWidth={2} />
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
          ref={menuTriggerRef}
          className="icon-button tablet-menu"
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-sheet"
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
          <AppearanceControl compact />
          <div className="account-control">
            <button
              ref={accountTriggerRef}
              className="icon-button"
              type="button"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              aria-controls="account-options"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <CircleUserRound size={19} aria-hidden="true" />
            </button>
            {accountOpen && (
              <nav
                ref={accountMenuRef}
                id="account-options"
                className="account-menu"
                aria-label="Account options"
              >
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
      <main className="main-content" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <AnimatePresence>
        {activePanel && (
          <motion.aside
            ref={panelRef}
            key="right-panel"
            className="right-panel"
            aria-label={
              activePanel === "planner"
                ? "Planner panel"
                : activePanel === "scenario"
                  ? "Scenario preview"
                  : activePanel === "conflict"
                    ? "Conflict resolution"
                    : "Detail panel"
            }
            role="dialog"
            aria-modal="true"
            initial={reduced ? false : { x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: 28, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
          >
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">University Planner</p>
                <h2>
                  {activePanel === "planner"
                    ? "Planner"
                    : activePanel === "scenario"
                      ? "Scenario preview"
                      : activePanel === "conflict"
                        ? "Conflict resolution"
                        : "Detail"}
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
            {activePanel === "planner" ||
            activePanel === "scenario" ||
            activePanel === "conflict" ? (
              <PlannerSurface
                key={activePanel}
                kind={activePanel}
                pathname={pathname}
                search={search.toString()}
                onClose={closePanel}
              />
            ) : (
              <p className="panel-message">This detail is available from its owning screen.</p>
            )}
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
        <div className="menu-backdrop" onClick={closeMenu}>
          <aside
            ref={menuRef}
            id="mobile-navigation-sheet"
            className="mobile-menu"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-navigation-title"
          >
            <div className="mobile-menu-head">
              <strong id="mobile-navigation-title">University Planner</strong>
              <button
                ref={menuCloseRef}
                className="icon-button"
                aria-label="Close navigation"
                onClick={closeMenu}
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
                  onSelect={closeMenu}
                />
              ))}
            </nav>
            <nav aria-label="Secondary navigation" className="nav-group secondary">
              {secondary.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  current={pathname}
                  onSelect={closeMenu}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
