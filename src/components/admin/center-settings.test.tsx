// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CenterSettings from "./center-settings";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("saves center details and writing guidance together", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      name: "Little Lantern Learning Center", hours: "Monday–Friday · 7:30 AM–5:30 PM",
      tagline: "Clear answers", timezone: "America/New_York", handbookLabel: "Family Handbook",
      websiteUrl: "", tone: "Warm and clear", audience: "Families", preferredTerms: [],
      forbiddenTerms: [], glossary: [],
    }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);

  render(<CenterSettings />);
  const hours = await screen.findByLabelText("Hours");
  fireEvent.change(hours, { target: { value: "Monday–Friday · 8 AM–5 PM" } });
  fireEvent.change(screen.getByLabelText("Tone of voice"), { target: { value: "Calm and concise" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Settings saved"));
  const [, options] = fetchMock.mock.calls[1];
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toMatchObject({ hours: "Monday–Friday · 8 AM–5 PM", tone: "Calm and concise" });
});
