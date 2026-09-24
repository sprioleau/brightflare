import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "@/components/brand/app-shell";

afterEach(() => cleanup());

describe("AppShell", () => {
  it("progressively discloses mobile navigation and keeps the current route marked", () => {
    const { container } = render(
      <AppShell section="handbook">
        <main>Handbook content</main>
      </AppShell>,
    );

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveAttribute("aria-controls", "app-shell-mobile-navigation");
    expect(container.querySelector("#app-shell-mobile-navigation")).toHaveAttribute("hidden");

    fireEvent.click(menuButton);
    expect(screen.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile main navigation" });
    expect(within(mobileNavigation).getByRole("link", { name: "Handbook" })).toHaveAttribute("aria-current", "page");
    expect(within(mobileNavigation).getByRole("link", { name: "Family desk" })).toHaveAttribute("href", "/");
    expect(within(mobileNavigation).getByRole("link", { name: "Staff" })).toHaveAttribute("href", "/admin");
  });

  it("closes mobile navigation after a link is selected", () => {
    const { container } = render(
      <AppShell section="family">
        <main>Family desk content</main>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Mobile main navigation" })).getByRole("link", { name: "Handbook" }));

    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("#app-shell-mobile-navigation")).toHaveAttribute("hidden");
  });

  it("discloses preview and motion utilities with the mobile navigation", () => {
    render(
      <AppShell section="family" actions={<button type="button">Parent iPad preview</button>}>
        <main>Family desk content</main>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const mobilePanel = document.querySelector("#app-shell-mobile-navigation");
    expect(mobilePanel).not.toHaveAttribute("hidden");
    expect(within(mobilePanel as HTMLElement).getByRole("button", { name: "Parent iPad preview" })).toBeInTheDocument();
    expect(within(mobilePanel as HTMLElement).getByRole("button", { name: "Pause motion" })).toBeInTheDocument();
  });

  it("closes mobile navigation on Escape and returns focus to its trigger", () => {
    const { container } = render(
      <AppShell section="family">
        <main>Family desk content</main>
      </AppShell>,
    );

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(menuButton);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveFocus();
    expect(container.querySelector("#app-shell-mobile-navigation")).toHaveAttribute("hidden");
  });

  it("lets people pause and resume the ambient motion", () => {
    render(
      <AppShell section="family">
        <main>Family desk content</main>
      </AppShell>,
    );

    const pauseButton = screen.getByRole("button", { name: "Pause motion" });
    expect(pauseButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pauseButton);
    const resumeButton = screen.getByRole("button", { name: "Resume motion" });
    expect(resumeButton).toHaveAttribute("aria-pressed", "true");
    expect(resumeButton.closest(".app-shell")).toHaveClass("motion-paused");

    fireEvent.click(resumeButton);
    expect(screen.getByRole("button", { name: "Pause motion" })).toHaveAttribute("aria-pressed", "false");
  });
});
