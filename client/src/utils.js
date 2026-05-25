export function todayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function addDays(key, offset) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

export function minutesFromTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function isOverdue(dose) {
  return dose.status === 'pending'
    && dose.dose_date === todayKey()
    && minutesFromTime(dose.scheduled_time) < nowMinutes();
}

export function statusKind(dose) {
  if (dose.status === 'pending' && isOverdue(dose)) return 'overdue';
  return dose.status;
}

export function statusLabel(dose) {
  const kind = statusKind(dose);
  if (kind === 'taken') return 'Taken';
  if (kind === 'missed') return 'Skipped';
  if (kind === 'overdue') return 'Overdue';
  return 'Pending';
}

export function formatScheduledTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatTakenTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDayName(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { weekday: 'short' });
}

export function sortDoses(doses) {
  return [...doses].sort((a, b) => {
    const overdueA = statusKind(a) === 'overdue' ? 0 : 1;
    const overdueB = statusKind(b) === 'overdue' ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;
    return minutesFromTime(a.scheduled_time) - minutesFromTime(b.scheduled_time);
  });
}

export function plural(value, one, many = `${one}s`) {
  return Number(value) === 1 ? one : many;
}

export function roundOne(value) {
  return Number.isInteger(value) ? value : Number(value).toFixed(1);
}
