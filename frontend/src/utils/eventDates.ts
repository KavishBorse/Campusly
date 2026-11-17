export function formatEventDateRange(
  startsAt: string | Date,
  endsAt: string | Date,
  dateOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  timeOptions: Intl.DateTimeFormatOptions = { timeStyle: 'short' },
) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dates = new Intl.DateTimeFormat('en-IN', dateOptions);
  const times = new Intl.DateTimeFormat('en-IN', timeOptions);
  const startDate = dates.format(start);
  const endDate = dates.format(end);
  const startTime = times.format(start);
  const endTime = times.format(end);
  const sameCalendarDay = start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth()
    && start.getDate() === end.getDate();

  return sameCalendarDay
    ? `${startDate} · ${startTime} – ${endTime}`
    : `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
}
