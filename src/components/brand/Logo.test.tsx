import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo } from "./Logo";

afterEach(() => cleanup());

describe("Logo", () => {
  it("uses the real mark and supports mark, wordmark, and stacked layouts at the requested height", () => {
    const { rerender } = render(<Logo size={40} variant="mark" />);
    const mark = screen.getByRole("img", { name: "brightflare" });
    expect(mark).toHaveAttribute("height", "40");
    expect(mark).toHaveAttribute("src", expect.stringContaining("/assets/brightflare-logo.svg"));

    rerender(<Logo size={36} variant="wordmark" />);
    expect(screen.getByText("brightflare")).toBeInTheDocument();
    expect(screen.getByText("brightflare").parentElement).toHaveAttribute("data-variant", "wordmark");

    rerender(<Logo variant="stacked" />);
    expect(screen.getByText("brightflare").parentElement).toHaveAttribute("data-variant", "stacked");
  });

  it("uses the full-logo asset with accessible branding and its intrinsic proportions", () => {
    render(<Logo size={32} variant="full" />);
    const fullLogo = screen.getByRole("img", { name: "brightflare" });
    const width = Number(fullLogo.getAttribute("width"));
    const height = Number(fullLogo.getAttribute("height"));

    expect(fullLogo).toHaveAttribute("src", expect.stringContaining("/assets/brightflare-logo-full.svg"));
    expect(height).toBe(32);
    expect(width / height).toBeCloseTo(698 / 128, 1);
    expect(screen.queryByText("brightflare")).not.toBeInTheDocument();
  });
});
