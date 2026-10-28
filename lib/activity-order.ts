export type ActivityOrder = { id: string; active: boolean; createdAt?: string };

/** Active first, then newest creation; missing legacy dates sort last. */
export function sortActivity<T extends ActivityOrder>(entries: T[]): T[] {
  const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return [...entries].sort((a, b) => Number(b.active) - Number(a.active)
    || timestamp(b.createdAt) - timestamp(a.createdAt) || a.id.localeCompare(b.id));
}
