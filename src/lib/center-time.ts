const CENTER_TIME_ZONE = "America/New_York";

function getOffsetMinutes(timestamp: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTER_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(timestamp);
  const value = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
}

export function centerDateBoundary(date: string, isEndOfDay: boolean): number {
  const wallTime = Date.parse(`${date}T${isEndOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  let timestamp = wallTime;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    timestamp = wallTime - getOffsetMinutes(timestamp) * 60_000;
  }
  return timestamp;
}
