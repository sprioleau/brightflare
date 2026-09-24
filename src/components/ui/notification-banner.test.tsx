import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppToast } from "@/components/ui/app-toast";
import { NotificationBanner } from "@/components/ui/notification-banner";

afterEach(() => cleanup());

describe("notification surfaces", () => {
  it("announces an error banner and calls its dismiss handler", () => {
    const onDismiss = vi.fn();
    render(
      <NotificationBanner title="Could not save" tone="error" onDismiss={onDismiss}>
        Check your connection and try again.
      </NotificationBanner>,
    );

    expect(screen.getByRole("alert", { name: "Could not save" })).toHaveTextContent("Check your connection and try again.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("announces a toast and calls its dismiss handler", () => {
    const onDismiss = vi.fn();
    render(<AppToast message="Changes saved" onDismiss={onDismiss} />);

    expect(screen.getByRole("status")).toHaveTextContent("Changes saved");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
