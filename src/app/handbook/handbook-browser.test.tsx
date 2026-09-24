import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HandbookBrowser, type HandbookEntry } from "./handbook-browser";

const entries: HandbookEntry[] = [
  {
    id: "hours-id",
    title: "Center hours",
    shortAnswer: "Open on weekdays.",
    answer: "The center is open Monday through Friday.",
    sourceLabel: "Family Handbook · Hours",
    category: "Getting started",
    tags: ["schedule"],
    reviewedAt: Date.UTC(2026, 8, 1),
  },
  {
    id: "meals-id",
    title: "Lunch and snacks",
    shortAnswer: "Pack a labeled lunch.",
    answer: "Please pack lunch in a labeled container.",
    sourceLabel: "Family Handbook · Meals",
    category: "Everyday care",
    tags: ["food", "allergies"],
    reviewedAt: Date.UTC(2026, 8, 2),
  },
];

describe("HandbookBrowser", () => {
  afterEach(() => cleanup());

  it("shows one published article and preserves its real section link and review source", () => {
    render(<HandbookBrowser centerName="Little Meadow" handbookLabel="Family handbook" entries={entries} selectedEntryId="meals-id" />);

    expect(screen.getByRole("heading", { level: 2, name: "Lunch and snacks" })).toBeInTheDocument();
    expect(screen.getByText("Please pack lunch in a labeled container.")).toBeInTheDocument();
    expect(screen.getByText("Family Handbook · Meals")).toBeInTheDocument();
    expect(screen.getByText("Reviewed Sep 2, 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(within(screen.getByRole("navigation", { name: "Handbook answers" })).getByRole("link", { name: "Center hours" })).toHaveAttribute("href", "/handbook/hours-id");
  });

  it("searches published handbook fields while retaining the selected article until a result is opened", () => {
    render(<HandbookBrowser centerName="Little Meadow" handbookLabel="Family handbook" entries={entries} selectedEntryId="hours-id" />);
    const navigation = within(screen.getByRole("navigation", { name: "Handbook answers" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search handbook" }), { target: { value: "allergies" } });

    expect(navigation.getByRole("link", { name: "Lunch and snacks" })).toHaveAttribute("href", "/handbook/meals-id");
    expect(navigation.queryByRole("link", { name: "Center hours" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Center hours" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search handbook" }), { target: { value: "not in the handbook" } });
    expect(navigation.getByRole("status")).toHaveTextContent("No answers match your search.");
  });

  it("keeps the selected article visible while the mobile browse list is collapsed", () => {
    render(<HandbookBrowser centerName="Little Meadow" handbookLabel="Family handbook" entries={entries} selectedEntryId="meals-id" />);

    const browseButton = screen.getByRole("button", { name: "Browse answers" });
    expect(browseButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { level: 2, name: "Lunch and snacks" })).toBeInTheDocument();

    fireEvent.click(browseButton);
    expect(browseButton).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("navigation", { name: "Handbook answers" })).getByRole("link", { name: "Center hours" })).toHaveAttribute("href", "/handbook/hours-id");
  });
});
