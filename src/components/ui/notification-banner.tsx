import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationTone = "info" | "success" | "warning" | "error";

type NotificationBannerProps = {
  title?: string;
  children: ReactNode;
  tone?: NotificationTone;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
};

const toneDetails = {
  info: { Icon: Info, role: "status", label: "Information" },
  success: { Icon: CheckCircle2, role: "status", label: "Success" },
  warning: { Icon: TriangleAlert, role: "status", label: "Warning" },
  error: { Icon: AlertCircle, role: "alert", label: "Error" },
} as const;

export function NotificationBanner({
  title,
  children,
  tone = "info",
  onDismiss,
  dismissLabel = "Dismiss notification",
  className,
}: NotificationBannerProps) {
  const { Icon, role, label } = toneDetails[tone];

  return (
    <section
      className={cn("notification-banner", `notification-banner--${tone}`, className)}
      role={role}
      aria-label={title || label}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <Icon aria-hidden="true" className="notification-banner__icon" />
      <div className="notification-banner__copy">
        {title ? <strong className="notification-banner__title">{title}</strong> : null}
        <div>{children}</div>
      </div>
      {onDismiss ? (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={dismissLabel} onClick={onDismiss}>
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </section>
  );
}
