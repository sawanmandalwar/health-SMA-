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

function toInputTime(value: { hours: number; minutes: number }): string {
  return `${pad(value.hours)}:${pad(value.minutes)}`;
}

function formatDisplayTime(value: { hours: number; minutes: number }): string {
  const period = value.hours >= 12 ? 'PM' : 'AM';
  let hours = value.hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${pad(value.minutes)} ${period}`;
}

function fromInputTime(value: string): { hours: number; minutes: number } | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

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
  fontFamily:
    "Inter_400Regular, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
  const inputValue =
    mode === 'date'
      ? (() => {
          const parsed = parseDisplayDate(value);
          return parsed ? toInputDate(parsed) : '';
        })()
      : (() => {
          const parsed = parseDisplayTime(value);
          return parsed ? toInputTime(parsed) : '';
        })();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;

    if (!next) {
      onChange('');
      return;
    }

    if (mode === 'date') {
      const parsed = fromInputDate(next);
      if (parsed) onChange(formatDisplayDate(parsed));
      return;
    }

    const parsed = fromInputTime(next);
    if (parsed) onChange(formatDisplayTime(parsed));
  };

  return (
    <input
      type={mode}
      value={inputValue}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{ ...BASE_STYLE, ...style }}
    />
  );
}
