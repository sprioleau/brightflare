"use client";

import { BookOpenText, House, Menu, Pause, Play, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  centerName?: string;
  centerHours?: string;
  section: "family" | "handbook" | "admin";
  actions?: ReactNode;
  className?: string;
  onBrandClick?: () => void;
};

const navigationItems = [
  { href: "/", label: "Family desk", Icon: House, section: "family" },
  { href: "/handbook", label: "Handbook", Icon: BookOpenText, section: "handbook" },
  { href: "/admin", label: "Staff", Icon: ShieldCheck, section: "admin" },
] as const;

export function AppShell({ children, centerName, centerHours, section, actions, className, onBrandClick }: AppShellProps) {
  const headerRef = useRef<HTMLElement>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const [headerHeight, setHeaderHeight] = useState(64);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const shellStyle = { "--app-header-height": `${headerHeight}px` } as CSSProperties;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function updateMotionPreference() {
      setIsReducedMotion(motionPreference.matches);
    }

    updateMotionPreference();
    motionPreference.addEventListener?.("change", updateMotionPreference);

    return () => motionPreference.removeEventListener?.("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMobileNavOpen(false);
      mobileNavTriggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileNavOpen]);

  function closeMobileNavigation() {
    setIsMobileNavOpen(false);
  }

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    if (typeof ResizeObserver === "undefined") {
      setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      const nextHeight = Math.ceil(header.getBoundingClientRect().height);
      setHeaderHeight(nextHeight);
    });
    resizeObserver.observe(header);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={cn("app-shell", isPaused && "motion-paused")} data-section={section} style={shellStyle}>
      <div className="app-shell__ambient" aria-hidden="true">
        <span className="app-shell__plus app-shell__plus--one">+</span>
        <span className="app-shell__plus app-shell__plus--two">+</span>
        <span className="app-shell__plus app-shell__plus--three">+</span>
      </div>
      <header ref={headerRef} className="app-shell__header">
        <div className="app-shell__header-inner">
          <Link className="app-shell__brand" href="/" aria-label="brightflare home" onClick={onBrandClick}>
            <Logo variant="full" size={37} />
          </Link>
          {centerName || centerHours ? (
            <div className="app-shell__center">
              {centerName ? <span>{centerName}</span> : null}
              {centerHours ? <small>{centerHours}</small> : null}
            </div>
          ) : null}
          <nav className="app-shell__nav" aria-label="Main navigation">
            {navigationItems.map(({ href, label, Icon, section: itemSection }) => {
              const isActive = section === itemSection;

              return (
                <Button
                  key={href}
                  asChild
                  variant="navigation"
                  size="sm"
                  className="app-shell__nav-link"
                >
                  <Link href={href} aria-current={isActive ? "page" : undefined}>
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <div className="app-shell__actions">
            {actions}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="app-shell__motion"
              aria-label={isReducedMotion ? "Motion reduced" : isPaused ? "Resume motion" : "Pause motion"}
              title={isReducedMotion ? "Motion reduced by your system preference" : isPaused ? "Resume motion" : "Pause motion"}
              aria-pressed={isPaused || isReducedMotion}
              disabled={isReducedMotion}
              onClick={() => setIsPaused((current) => !current)}
            >
              {isReducedMotion ? null : isPaused ? <Play aria-hidden="true" className="size-5" /> : <Pause aria-hidden="true" className="size-5" />}
              <span className="app-shell__motion-label">{isReducedMotion ? "Motion reduced" : isPaused ? "Resume motion" : "Pause motion"}</span>
            </Button>
          </div>
          <Button
            ref={mobileNavTriggerRef}
            type="button"
            variant="secondary"
            size="sm"
            className="app-shell__mobile-menu"
            aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileNavOpen}
            aria-controls="app-shell-mobile-navigation"
            onClick={() => setIsMobileNavOpen((current) => !current)}
          >
            {isMobileNavOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            <span>{isMobileNavOpen ? "Close" : "Menu"}</span>
          </Button>
          <div
            id="app-shell-mobile-navigation"
            className="app-shell__mobile-nav"
            hidden={!isMobileNavOpen}
          >
            <nav aria-label="Mobile main navigation">
              {navigationItems.map(({ href, label, Icon, section: itemSection }) => {
                const isActive = section === itemSection;

                return (
                  <Button
                    key={href}
                    asChild
                    variant="navigation"
                    size="sm"
                    className="app-shell__mobile-nav-link"
                  >
                    <Link href={href} aria-current={isActive ? "page" : undefined} onClick={closeMobileNavigation}>
                      <Icon aria-hidden="true" className="size-5" />
                      {label}
                    </Link>
                  </Button>
                );
              })}
            </nav>
            <div className="app-shell__mobile-tools">
              {actions}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="app-shell__motion"
                aria-label={isReducedMotion ? "Motion reduced" : isPaused ? "Resume motion" : "Pause motion"}
                title={isReducedMotion ? "Motion reduced by your system preference" : isPaused ? "Resume motion" : "Pause motion"}
                aria-pressed={isPaused || isReducedMotion}
                disabled={isReducedMotion}
                onClick={() => setIsPaused((current) => !current)}
              >
                {isReducedMotion ? null : isPaused ? <Play aria-hidden="true" className="size-5" /> : <Pause aria-hidden="true" className="size-5" />}
                <span className="app-shell__motion-label">{isReducedMotion ? "Motion reduced" : isPaused ? "Resume motion" : "Pause motion"}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      <div className={cn("app-shell-content", className)}>{children}</div>
    </div>
  );
}
