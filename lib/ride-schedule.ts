/** Calendar choices are Sydney civil time, independent of the browser timezone. */
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function sydneyDateTime(value: Date | string | number = Date.now()) {
  const fields = Object.fromEntries(parts.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}` };
}
export function calendarDay(date: string, offset = 0) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
export function lastDepartureDate(now: Date | number = Date.now()) {
  const [y, m, d] = sydneyDateTime(now).date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 3, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + 2, Math.min(d, last))).toISOString().slice(0, 10);
}
/** Sydney has +10/+11 offsets. Missing DST times return null; repeated times use the earlier occurrence. */
export function sydneyInstant(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const nominal = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(nominal)) return null;
  for (const offset of [11, 10]) {
    const candidate = new Date(nominal - offset * 3600000);
    const local = sydneyDateTime(candidate);
    if (local.date === date && local.time === time) return candidate.toISOString();
  }
  return null;
}
export function scheduleDayBounds(date: string): [string, string] | null {
  const start = sydneyInstant(date, "00:00");
  if (!start) return null;
  const end = sydneyInstant(calendarDay(date, 1), "00:00");
  return end ? [start, end] : null;
}
export function initialDeparture(now = Date.now()) {
  return sydneyDateTime(Math.ceil((now + 30 * 60000) / (30 * 60000)) * 30 * 60000);
}
export function dateCaption(date: string) {
  return new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}
export function timeCaption(time: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(`2000-01-01T${time}:00Z`));
}
