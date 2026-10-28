import React from 'react';
import type { CSSProperties } from 'react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAME_MAP: Record<string, number> = MONTH_NAMES.reduce(
  (map, month, index) => {
    map[month.toLowerCase()] = index + 1;
    map[month.toLowerCase().slice(0, 3)] = index + 1;
    return map;
  },
  {} as Record<string, number>,
);

type Props = {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  style?: CSSProperties;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDisplayDate(value: string): Date | null {
  const text = String(value || '').trim();
  if (!text) return null;

  const named = text.match(/^(\d{1,2})\s+([A-Za-z.]+),?\s+(\d{4})$/);
  if (named) {
    const month = MONTH_NAME_MAP[named[2].toLowerCase().replace(/\./g, '')];
    if (month) {
      const parsed = new Date(Number(named[3]), month - 1, Number(named[1]));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const parsed = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const parsed = new Date(
      Number(numeric[3]),
      Number(numeric[2]) - 1,
      Number(numeric[1]),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toInputDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )}`;
}

function formatDisplayDate(value: Date): string {
  return `${value.getDate()} ${MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;
}

function fromInputDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDisplayTime(value: string): { hours: number; minutes: number } | null {
  const text = String(value || '').trim();
  if (!text) return null;

  const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?\s?[Mm]\.?$/);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();

    if (period === 'A' && hours === 12) hours = 0;
    else if (period === 'P' && hours !== 12) hours += 12;

    return { hours, minutes };
  }

  const twentyFour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    return { hours: Number(twentyFour[1]), minutes: Number(twentyFour[2]) };
  }

  return null;
}

function formatDisplayTime(value: { hours: number; minutes: number }): string {
  const period = value.hours >= 12 ? 'PM' : 'AM';
  let hours = value.hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${pad(value.minutes)} ${period}`;
}

const MINUTE_STEPS = Array.from({ length: 12 }, (_, index) => index * 5);

const FONT_FAMILY =
  "Inter_400Regular, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const BASE_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 7,
  border: '1px solid #C9E0E5',
  backgroundColor: '#E7F3F5',
  color: '#1D2B33',
  fontSize: 15,
  fontFamily: FONT_FAMILY,
};

const TIME_PARTS_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  minHeight: 48,
  padding: '0 8px',
  borderRadius: 7,
  border: '1px solid #C9E0E5',
  backgroundColor: '#E7F3F5',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const TIME_SELECT_STYLE: CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: '#1D2B33',
  fontSize: 15,
  fontFamily: FONT_FAMILY,
  height: 44,
  padding: '0 2px',
  cursor: 'pointer',
};

const PERIOD_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  marginLeft: 'auto',
};

const PERIOD_BUTTON_STYLE: CSSProperties = {
  minWidth: 40,
  height: 34,
  borderRadius: 6,
  border: '1px solid #C9E0E5',
  backgroundColor: '#FFFFFF',
  color: '#1D2B33',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT_FAMILY,
  cursor: 'pointer',
};

const PERIOD_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...PERIOD_BUTTON_STYLE,
  borderColor: '#1E76B6',
  backgroundColor: '#1E76B6',
  color: '#FFFFFF',
};

export default function WebDateTimeInput({
  mode,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
  style,
}: Props) {
  if (mode === 'time') {
    const parsed = parseDisplayTime(value);
    const hours24 = parsed ? parsed.hours : null;
    const minutes = parsed ? parsed.minutes : null;
    const period: 'AM' | 'PM' = hours24 !== null && hours24 >= 12 ? 'PM' : 'AM';
    const hour12 =
      hours24 === null ? null : hours24 % 12 === 0 ? 12 : hours24 % 12;

    const minuteOptions = minutes !== null && !MINUTE_STEPS.includes(minutes)
      ? [...MINUTE_STEPS, minutes].sort((a, b) => a - b)
      : MINUTE_STEPS;

    const commit = (
      nextHour12: number,
      nextMinutes: number,
      nextPeriod: 'AM' | 'PM',
    ) => {
      const baseHour = nextHour12 % 12;
      const nextHours24 =
        nextPeriod === 'PM' ? baseHour + 12 : baseHour;

      onChange(formatDisplayTime({ hours: nextHours24, minutes: nextMinutes }));
    };

    return (
      <div
        style={{ ...TIME_PARTS_STYLE, ...style, opacity: disabled ? 0.6 : 1 }}
      >
        <select
          aria-label={ariaLabel ? `${ariaLabel} hour` : 'Hour'}
          value={hour12 === null ? '' : String(hour12)}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) return;
            commit(Number(next), minutes ?? 0, period);
          }}
          style={TIME_SELECT_STYLE}
        >
          {hour12 === null && <option value="">HH</option>}

          {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>

        <span style={{ color: '#1D2B33', fontSize: 15, fontWeight: 600 }}>
          :
        </span>

        <select
          aria-label={ariaLabel ? `${ariaLabel} minutes` : 'Minutes'}
          value={minutes === null ? '' : pad(minutes)}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) return;
            commit(hour12 ?? 12, Number(next), period);
          }}
          style={TIME_SELECT_STYLE}
        >
          {minutes === null && <option value="">MM</option>}

          {minuteOptions.map((minute) => (
            <option key={minute} value={pad(minute)}>
              {pad(minute)}
            </option>
          ))}
        </select>

        <div style={PERIOD_GROUP_STYLE} role="group" aria-label="AM or PM">
          {(['AM', 'PM'] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={parsed ? period === option : false}
              onClick={() => commit(hour12 ?? 12, minutes ?? 0, option)}
              style={
                parsed && period === option
                  ? PERIOD_BUTTON_ACTIVE_STYLE
                  : PERIOD_BUTTON_STYLE
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const dateValue = (() => {
    const parsed = parseDisplayDate(value);
    return parsed ? toInputDate(parsed) : '';
  })();

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;

    if (!next) {
      onChange('');
      return;
    }

    const parsed = fromInputDate(next);
    if (parsed) onChange(formatDisplayDate(parsed));
  };

  return (
    <input
      type="date"
      value={dateValue}
      onChange={handleDateChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{ ...BASE_STYLE, ...style }}
    />
  );
}
