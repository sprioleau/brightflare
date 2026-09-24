import Link from "next/link";
import {
  BookOpen,
  CircleHelp,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Settings2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./admin-workspace-nav.module.css";

export type AdminView =
  | "dashboard"
  | "recommendations"
  | "questions"
  | "topics"
  | "handbook"
  | "featured"
  | "announcement"
  | "settings";

export const adminViewPaths: Record<AdminView, string> = {
  dashboard: "/admin/dashboard",
  recommendations: "/admin/recommendations",
  questions: "/admin/questions",
  topics: "/admin/topics",
  handbook: "/admin/handbook",
  featured: "/admin/featured",
  announcement: "/admin/announcement",
  settings: "/admin/settings",
};

const adminNavigationItems = [
  { view: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { view: "recommendations", label: "Recommendations", Icon: ClipboardCheck },
  { view: "questions", label: "Questions", Icon: MessageCircle },
  { view: "topics", label: "Question topics", Icon: CircleHelp },
  { view: "handbook", label: "Handbook", Icon: BookOpen },
  { view: "featured", label: "Front desk layout", Icon: GripVertical },
  { view: "announcement", label: "Announcement", Icon: Megaphone },
] as const satisfies ReadonlyArray<{ view: AdminView; label: string; Icon: typeof LayoutDashboard }>;

type AdminWorkspaceNavProps = {
  activeView: AdminView;
  onNavigate?: (view: AdminView) => void;
};

function navigationClassName(isActive: boolean) {
  return `min-h-11 !h-auto w-auto shrink-0 justify-start gap-2 px-3 text-sm min-[971px]:w-full ${isActive ? styles.activeLink : "text-[#526875]"}`;
}

export function AdminWorkspaceNav({ activeView, onNavigate }: AdminWorkspaceNavProps) {
  return (
    <nav
      aria-label="Admin navigation"
      className={`admin-workspace-nav ${styles.navigation} sticky top-[calc(var(--app-header-height)+.75rem)] z-20 flex min-w-0 gap-2 overflow-x-auto pb-1 min-[971px]:sticky min-[971px]:top-[calc(var(--app-header-height)+1rem)] min-[971px]:flex-col min-[971px]:overflow-visible`}
    >
      {adminNavigationItems.map(({ view, label, Icon }) => {
        const isActive = activeView === view;
        return (
          <Button
            key={view}
            asChild
            size="sm"
            variant="navigation"
            className={navigationClassName(isActive)}
          >
            <Link
              href={adminViewPaths[view]}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate?.(view)}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              {label}
            </Link>
          </Button>
        );
      })}
      <span className="hidden flex-1 min-[971px]:block" aria-hidden="true" />
      <Button
        asChild
        size="sm"
        variant="navigation"
        className={navigationClassName(activeView === "settings")}
      >
        <Link
          href={adminViewPaths.settings}
          aria-current={activeView === "settings" ? "page" : undefined}
          onClick={() => onNavigate?.("settings")}
        >
          <Settings2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Center settings
        </Link>
      </Button>
    </nav>
  );
}
