"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { BookOpenText, House, Pause, Play, ShieldCheck } from "lucide-react";
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
  const [headerHeight, setHeaderHeight] = useState(64);
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
        </div>
      </header>
      <div className={cn("app-shell-content", className)}>{children}</div>
    </div>
  );
}
