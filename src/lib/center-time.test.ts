import { describe, expect, it } from "vitest";
import { centerDateBoundary } from "./center-time";

describe("center seasonal schedule boundaries", () => {
  it("uses the center's winter and summer offsets", () => {
    expect(new Date(centerDateBoundary("2026-01-15", false)).toISOString())
      .toBe("2026-01-15T05:00:00.000Z");
    expect(new Date(centerDateBoundary("2026-09-15", false)).toISOString())
      .toBe("2026-09-15T04:00:00.000Z");
  });

  it("keeps a seasonal FAQ visible until the end of its final local day", () => {
    expect(new Date(centerDateBoundary("2026-11-11", true)).toISOString())
      .toBe("2026-11-12T04:59:59.999Z");
  });
});
