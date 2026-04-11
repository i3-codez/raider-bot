const easternDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
  timeStyle: "short",
});

const easternMonthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
});

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Expected a valid Date instance.");
  }
}

export function toEasternLabel(date: Date): string {
  assertValidDate(date);
  return easternDateTimeFormatter.format(date);
}

export function deriveMonthKey(date: Date): string {
  assertValidDate(date);

  const parts = easternMonthFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new RangeError("Could not derive a month key for the provided date.");
  }

  return `${year}-${month}`;
}

export function minutesBetween(later: Date, earlier: Date): number {
  assertValidDate(later);
  assertValidDate(earlier);

  const millisecondsPerMinute = 60_000;
  return Math.floor((later.getTime() - earlier.getTime()) / millisecondsPerMinute);
}
