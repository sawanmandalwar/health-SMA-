import React, { useId, useState } from 'react';
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

const TIME_INPUT_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: 58,
  border: '1px solid transparent',
  borderRadius: 6,
  outline: 'none',
  background: 'transparent',
  color: '#1D2B33',
  fontSize: 15,
  fontFamily: FONT_FAMILY,
  height: 40,
  padding: '0 4px',
  textAlign: 'center',
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
  const [draft, setDraft] = useState<{
    source: string;
    hour: string;
    minute: string;
  } | null>(null);

  const hoursListId = useId();
  const minutesListId = useId();

  if (mode === 'time') {
    const parsed = parseDisplayTime(value);
    const period: 'AM' | 'PM' =
      parsed && parsed.hours >= 12 ? 'PM' : 'AM';
    const hour12 = parsed === null
      ? null
      : parsed.hours % 12 === 0
        ? 12
        : parsed.hours % 12;
    const minutes = parsed ? parsed.minutes : null;

    // A draft only applies while it belongs to the current value, so any
    // committed change falls straight back to the canonical value.
    const activeDraft = draft && draft.source === value ? draft : null;

    const hourText =
      activeDraft !== null
        ? activeDraft.hour
        : hour12 === null
          ? ''
          : String(hour12);

    const minuteText =
      activeDraft !== null
        ? activeDraft.minute
        : minutes === null
          ? ''
          : pad(minutes);

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

    const currentHour = (): number => {
      const fromText = Number(hourText);
      if (hourText !== '' && fromText >= 1 && fromText <= 12) return fromText;
      return hour12 ?? 12;
    };

    const currentMinutes = (): number => {
      const fromText = Number(minuteText);
      if (minuteText !== '' && fromText >= 0 && fromText <= 59) return fromText;
      return minutes ?? 0;
    };

    const handleHourChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 2);

      setDraft({ source: value, hour: digits, minute: minuteText });

      const next = Number(digits);
      if (digits && next >= 1 && next <= 12) {
        commit(next, currentMinutes(), period);
      }
    };

    const handleHourBlur = () => {
      if (hourText === '') {
        setDraft(null);
      }
    };

    const handleMinuteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 2);

      setDraft({ source: value, hour: hourText, minute: digits });

      const next = Number(digits);
      if (digits.length === 2 && next <= 59) {
        commit(currentHour(), next, period);
      }
    };

    const handleMinuteBlur = () => {
      if (minuteText === '') {
        setDraft(null);
        return;
      }

      if (minuteText.length === 1) {
        const next = Number(minuteText);

        setDraft({ source: value, hour: hourText, minute: pad(next) });
        commit(currentHour(), next, period);
      }
    };

    return (
      <div
        style={{ ...TIME_PARTS_STYLE, ...style, opacity: disabled ? 0.6 : 1 }}
      >
        <input
          type="text"
          list={hoursListId}
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel ? `${ariaLabel} hour` : 'Hour'}
          placeholder="HH"
          maxLength={2}
          value={hourText}
          disabled={disabled}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          style={TIME_INPUT_STYLE}
        />

        <datalist id={hoursListId}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
            <option key={hour} value={hour} />
          ))}
        </datalist>

        <span style={{ color: '#1D2B33', fontSize: 15, fontWeight: 600 }}>
          :
        </span>

        <input
          type="text"
          list={minutesListId}
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel ? `${ariaLabel} minutes` : 'Minutes'}
          placeholder="MM"
          maxLength={2}
          value={minuteText}
          disabled={disabled}
          onChange={handleMinuteChange}
          onBlur={handleMinuteBlur}
          style={TIME_INPUT_STYLE}
        />

        <datalist id={minutesListId}>
          {minuteOptions.map((minute) => (
            <option key={minute} value={pad(minute)} />
          ))}
        </datalist>

        <div style={PERIOD_GROUP_STYLE} role="group" aria-label="AM or PM">
          {(['AM', 'PM'] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={parsed ? period === option : false}
              onClick={() => commit(currentHour(), currentMinutes(), option)}
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
