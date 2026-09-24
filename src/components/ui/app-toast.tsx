import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppToastProps = {
  message: string;
  onDismiss: () => void;
  tone?: "success" | "error" | "info";
};

export function AppToast({ message, onDismiss, tone = "success" }: AppToastProps) {
  const isError = tone === "error";
  const StatusIcon = tone === "error" ? CircleAlert : tone === "info" ? Info : CircleCheck;

  return (
    <div className="app-toast-positioner">
      <div
        className={cn("app-toast", `app-toast--${tone}`)}
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
      >
        <StatusIcon aria-hidden="true" className="app-toast__icon" />
        <span>{message}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss notification" onClick={onDismiss}>
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
