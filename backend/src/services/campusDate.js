const CAMPUS_TIME_ZONE = 'Asia/Kolkata';

export function campusDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+date)) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(
    parts.filter((part) => ['year', 'month', 'day'].includes(part.type)).map((part) => [part.type, part.value]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function parseCampusDate(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  let dateKey = '';

  if (isDateOnly) {
    const parsedDate = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isNaN(+parsedDate) && parsedDate.toISOString().slice(0, 10) === raw) dateKey = raw;
  } else if (raw) {
    // Accept ISO timestamps from older clients, interpreting their calendar
    // day in the campus timezone rather than the API server's timezone.
    dateKey = campusDateKey(new Date(raw));
  }

  if (!dateKey) return { key: '', date: new Date(Number.NaN) };
  return { key: dateKey, date: new Date(`${dateKey}T12:00:00+05:30`) };
}
