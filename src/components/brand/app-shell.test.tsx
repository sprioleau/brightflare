import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "@/components/brand/app-shell";

afterEach(() => cleanup());

describe("AppShell", () => {
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
