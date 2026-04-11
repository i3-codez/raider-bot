const easternDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
  timeStyle: "short",
});

const easternDateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const easternMonthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
});

const easternShortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
});

const easternMonthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  year: "numeric",
});

export type SummaryCadence = "daily" | "weekly" | "monthly";

interface EasternDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface SummaryWindow {
  cadence: SummaryCadence;
  key: string;
  label: string;
  start: Date;
  end: Date;
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Expected a valid Date instance.");
  }
}

export function toEasternLabel(date: Date): string {
  assertValidDate(date);
  return easternDateTimeFormatter.format(date);
}

function getEasternDateTimeParts(date: Date): EasternDateTimeParts {
  assertValidDate(date);

  const partMap = new Map(
    easternDateTimePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: partMap.get("year") ?? 0,
    month: partMap.get("month") ?? 0,
    day: partMap.get("day") ?? 0,
    hour: partMap.get("hour") ?? 0,
    minute: partMap.get("minute") ?? 0,
    second: partMap.get("second") ?? 0,
  };
}

function resolveEasternDateTime(parts: EasternDateTimeParts): Date {
  const guess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  const actual = getEasternDateTimeParts(guess);
  const delta =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) -
    Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );

  return new Date(guess.getTime() + delta);
}

function shiftEasternCalendarDate(
  parts: Pick<EasternDateTimeParts, "year" | "month" | "day">,
  days: number,
) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function startOfEasternDay(date: Date): Date {
  const parts = getEasternDateTimeParts(date);

  return resolveEasternDateTime({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
  });
}

export function startOfEasternWeek(date: Date): Date {
  const parts = getEasternDateTimeParts(date);
  const dayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const startDate = shiftEasternCalendarDate(parts, -daysSinceMonday);

  return resolveEasternDateTime({
    ...startDate,
    hour: 0,
    minute: 0,
    second: 0,
  });
}

export function startOfEasternMonth(date: Date): Date {
  const parts = getEasternDateTimeParts(date);

  return resolveEasternDateTime({
    year: parts.year,
    month: parts.month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  });
}

export function formatEasternShortDate(date: Date): string {
  assertValidDate(date);
  return easternShortDateFormatter.format(date);
}

export function formatEasternMonthLabel(date: Date): string {
  assertValidDate(date);
  return easternMonthLabelFormatter.format(date);
}

export function getCompletedSummaryWindow(
  cadence: SummaryCadence,
  now: Date = new Date(),
): SummaryWindow {
  assertValidDate(now);

  if (cadence === "daily") {
    const end = startOfEasternDay(now);
    const previousDayParts = shiftEasternCalendarDate(getEasternDateTimeParts(end), -1);
    const start = resolveEasternDateTime({
      ...previousDayParts,
      hour: 0,
      minute: 0,
      second: 0,
    });

    return {
      cadence,
      key: deriveMonthKey(start) + `:${previousDayParts.day.toString().padStart(2, "0")}`,
      label: `Daily Summary for ${formatEasternShortDate(start)}`,
      start,
      end,
    };
  }

  if (cadence === "weekly") {
    const end = startOfEasternWeek(now);
    const previousWeekStartParts = shiftEasternCalendarDate(getEasternDateTimeParts(end), -7);
    const previousWeekEndParts = shiftEasternCalendarDate(getEasternDateTimeParts(end), -1);
    const start = resolveEasternDateTime({
      ...previousWeekStartParts,
      hour: 0,
      minute: 0,
      second: 0,
    });

    return {
      cadence,
      key: `${deriveMonthKey(start)}:week:${formatEasternShortDate(start)}`,
      label: `Weekly Summary for ${formatEasternShortDate(start)} - ${formatEasternShortDate(
        resolveEasternDateTime({
          ...previousWeekEndParts,
          hour: 0,
          minute: 0,
          second: 0,
        }),
      )}`,
      start,
      end,
    };
  }

  const currentMonthStart = startOfEasternMonth(now);
  const previousMonthEndParts = shiftEasternCalendarDate(getEasternDateTimeParts(currentMonthStart), -1);
  const start = startOfEasternMonth(
    resolveEasternDateTime({
      ...previousMonthEndParts,
      hour: 12,
      minute: 0,
      second: 0,
    }),
  );
  const end = currentMonthStart;

  return {
    cadence,
    key: deriveMonthKey(start),
    label: `Monthly Summary for ${formatEasternMonthLabel(start)}`,
    start,
    end,
  };
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
