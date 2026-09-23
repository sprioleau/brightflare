import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("uses the real mark and supports mark, wordmark, and stacked layouts at the requested height", () => {
    const { rerender } = render(<Logo size={40} variant="mark" />);
    const mark = screen.getByRole("img", { name: "brightflare" });
    expect(mark).toHaveAttribute("height", "40");
    expect(mark).toHaveAttribute("src", expect.stringContaining("brightflare-logo.svg"));

    rerender(<Logo size={36} variant="wordmark" />);
    expect(screen.getByText("brightflare")).toBeInTheDocument();
    expect(screen.getByText("brightflare").parentElement).toHaveAttribute("data-variant", "wordmark");

    rerender(<Logo variant="stacked" />);
    expect(screen.getByText("brightflare").parentElement).toHaveAttribute("data-variant", "stacked");
  });
});
