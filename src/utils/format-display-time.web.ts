function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toTwelveHour(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHours}:${pad(minutes)} ${period}`;
}

export function formatDisplayTime(value: string): string {
  const text = String(value ?? '').trim();

  if (!text) {
    return text;
  }

  const twelveHour = text.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])\.?\s?[Mm]\.?$/,
  );

  if (twelveHour) {
    const hours = Number(twelveHour[1]);

    if (hours >= 1 && hours <= 12) {
      return `${hours}:${twelveHour[2]} ${twelveHour[3].toUpperCase()}M`;
    }

    return text;
  }

  const twentyFour = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return toTwelveHour(hours, minutes);
    }
  }

  return text;
}
