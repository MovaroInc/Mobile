const WEEKDAYS = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];
const MONTHS = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May.',
  'Jun.',
  'Jul.',
  'Aug.',
  'Sep.',
  'Oct.',
  'Nov.',
  'Dec.',
];

const toISODateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatLabel = (d: Date) =>
  `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;

export type DateItem = {
  date: Date; // local midnight
  iso: string; // YYYY-MM-DD (local)
  label: string; // "Sat. Sep. 27"
};

/** Returns today + (days-1) forward, default 7 total. */
export function buildDateRange(days = 7, start = new Date()): DateItem[] {
  // normalize to local midnight
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    return { date: d, iso: toISODateLocal(d), label: formatLabel(d) };
  });
}

/** Convenience: just the labels like "Sat. Sep. 27" */
export const getNextWeekLabels = (days = 7) =>
  buildDateRange(days).map(d => d.label);
