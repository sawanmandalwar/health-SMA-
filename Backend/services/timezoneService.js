const DEFAULT_TIME_ZONE = process.env.DEFAULT_TIMEZONE || "Asia/Kolkata";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function isValidTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(
      new Date()
    );
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(value) {
  return isValidTimeZone(value) ? value.trim() : DEFAULT_TIME_ZONE;
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getDayKeyForDate(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function parseDayKey(dayKey) {
  const match = String(dayKey || "").match(DATE_ONLY_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function addDaysToDayKey(dayKey, days) {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return null;

  const date = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + Number(days || 0))
  );

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

function getUtcRangeForDayKey(dayKey, timeZone) {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return null;

  const nextKey = addDaysToDayKey(dayKey, 1);
  const next = parseDayKey(nextKey);
  if (!next) return null;

  const start = zonedDateTimeToUtc(
    { ...parsed, hour: 0, minute: 0, second: 0 },
    timeZone
  );
  const end = zonedDateTimeToUtc(
    { ...next, hour: 0, minute: 0, second: 0 },
    timeZone
  );

  return { start, end };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

// Convert a wall-clock date/time in an IANA time zone to a UTC Date.
// The offset is recalculated after the first estimate so DST transitions are
// handled without relying on the server's local time zone.
function zonedDateTimeToUtc(
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone
) {
  const zone = normalizeTimeZone(timeZone);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = getTimeZoneOffsetMs(new Date(naiveUtc), zone);
  let result = new Date(naiveUtc - offset);
  const correctedOffset = getTimeZoneOffsetMs(result, zone);

  if (correctedOffset !== offset) {
    offset = correctedOffset;
    result = new Date(naiveUtc - offset);
  }

  return result;
}

// Parse the date formats accepted by the existing medicine UI into a
// timezone-independent YYYY-MM-DD key. Returns null for empty input.
function parseDateOnlyToDayKey(value) {
  if (!value) return null;

  const text = String(value).trim().replace(/\s+/g, " ");
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const key = `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;
    return parseDayKey(key) ? key : null;
  }

  const monthNames = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
  };

  let match = text.match(/^(\d{1,2})\s+([A-Za-z.]+),?\s+(\d{4})$/);
  if (match) {
    const month = monthNames[match[2].toLowerCase().replace(/\./g, "")];
    if (!month) return null;
    const key = `${match[3]}-${pad(month)}-${pad(Number(match[1]))}`;
    return parseDayKey(key) ? key : null;
  }

  match = text.match(/^([A-Za-z.]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const month = monthNames[match[1].toLowerCase().replace(/\./g, "")];
    if (!month) return null;
    const key = `${match[3]}-${pad(month)}-${pad(Number(match[2]))}`;
    return parseDayKey(key) ? key : null;
  }

  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const day = first > 12 && second <= 12 ? first : second;
    const month = first > 12 && second <= 12 ? second : first;
    const key = `${match[3]}-${pad(month)}-${pad(day)}`;
    return parseDayKey(key) ? key : null;
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) return null;

  return getDayKeyForDate(fallback, DEFAULT_TIME_ZONE);
}

function formatInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: normalizeTimeZone(timeZone),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

module.exports = {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  normalizeTimeZone,
  getZonedParts,
  getDayKeyForDate,
  parseDayKey,
  addDaysToDayKey,
  getUtcRangeForDayKey,
  zonedDateTimeToUtc,
  parseDateOnlyToDayKey,
  formatInTimeZone,
};
