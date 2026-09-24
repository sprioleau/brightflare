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

export type AdminView =
  | "dashboard"
  | "recommendations"
  | "questions"
  | "topics"
  | "handbook"
  | "featured"
  | "announcement"
  | "settings";

type AdminWorkspaceNavProps = {
  activeView: AdminView;
  onSelectView?: (view: Exclude<AdminView, "settings">) => void;
};

const adminNavigationItems = [
  { view: "dashboard", href: "/admin?view=dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { view: "recommendations", href: "/admin?view=recommendations", label: "Recommendations", Icon: ClipboardCheck },
  { view: "questions", href: "/admin?view=stream", label: "Questions", Icon: MessageCircle },
  { view: "topics", href: "/admin?view=inbox", label: "Question topics", Icon: CircleHelp },
  { view: "handbook", href: "/admin?view=handbook", label: "Handbook", Icon: BookOpen },
  { view: "featured", href: "/admin?view=featured", label: "Front desk layout", Icon: GripVertical },
  { view: "announcement", href: "/admin?view=announcement", label: "Announcement", Icon: Megaphone },
] as const;

function navigationClassName(isActive: boolean) {
  return `min-h-11 !h-auto w-auto shrink-0 justify-start gap-2 px-3 text-sm min-[971px]:w-full ${isActive ? "bg-[#E7EDF2] text-[#20364C] underline decoration-[#20364C] decoration-2 underline-offset-[7px]" : "text-[#526875]"}`;
}

export function AdminWorkspaceNav({ activeView, onSelectView }: AdminWorkspaceNavProps) {
  return (
    <nav
      aria-label="Admin navigation"
      className="admin-workspace-nav sticky top-[calc(var(--app-header-height)+.75rem)] z-20 flex min-w-0 gap-2 overflow-x-auto pb-1 min-[971px]:sticky min-[971px]:top-[calc(var(--app-header-height)+1rem)] min-[971px]:flex-col min-[971px]:overflow-visible"
    >
      {adminNavigationItems.map(({ view, href, label, Icon }) => {
        const isActive = activeView === view;
        const contents = <><Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />{label}</>;

        if (onSelectView) {
          return <Button key={view} type="button" size="sm" variant="navigation" aria-current={isActive ? "page" : undefined} className={navigationClassName(isActive)} onClick={() => onSelectView(view)}>{contents}</Button>;
        }

        return <Button key={view} asChild size="sm" variant="navigation" className={navigationClassName(isActive)}><Link href={href} aria-current={isActive ? "page" : undefined}>{contents}</Link></Button>;
      })}
      <span className="hidden flex-1 min-[971px]:block" aria-hidden="true" />
      <Button asChild size="sm" variant="navigation" className={navigationClassName(activeView === "settings")}>
        <Link href="/admin/settings" aria-current={activeView === "settings" ? "page" : undefined}>
          <Settings2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Center settings
        </Link>
      </Button>
    </nav>
  );
}
