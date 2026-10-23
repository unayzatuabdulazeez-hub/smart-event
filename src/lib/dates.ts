const DAY = 86400000;
/** Whole days from `from` (default: today, local) to a yyyy-mm-dd date. Negative = past. */
export function daysUntil(dateStr: string, from = new Date()): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - today) / DAY);
}
export function countdownText(dateStr: string, from = new Date()): string {
  const n = daysUntil(dateStr, from);
  if (n > 1) return `${n} days to go`;
  if (n === 1) return 'Tomorrow';
  if (n === 0) return 'Today is the day!';
  return 'Event completed';
}
export function formatDate(dateStr: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}
export const formatShort = (s: string | null | undefined) => formatDate(s, { day: 'numeric', month: 'short' });
export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}
export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
export function greeting(h = new Date().getHours()): string {
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
