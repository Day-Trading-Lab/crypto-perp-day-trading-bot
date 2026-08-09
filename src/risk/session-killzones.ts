export interface Killzone { name: string; startHourUtc: number; endHourUtc: number; multiplier: number; allowNewPositions: boolean; }
export const defaultKillzones: Killzone[] = [
  { name: "asia", startHourUtc: 0, endHourUtc: 7, multiplier: 0.7, allowNewPositions: true },
  { name: "london", startHourUtc: 7, endHourUtc: 12, multiplier: 1, allowNewPositions: true },
  { name: "new-york", startHourUtc: 12, endHourUtc: 20, multiplier: 1, allowNewPositions: true },
  { name: "overnight", startHourUtc: 20, endHourUtc: 24, multiplier: 0, allowNewPositions: false },
];
export function activeKillzone(zones: Killzone[], now = new Date()): Killzone | undefined {
  const hour = now.getUTCHours();
  return zones.find((zone) => hour >= zone.startHourUtc && hour < zone.endHourUtc);
}
export function sessionRiskMultiplier(zones: Killzone[], now = new Date()): number {
  return activeKillzone(zones, now)?.multiplier ?? 0;
}
export function mayOpenPosition(zones: Killzone[], now = new Date()): boolean {
  const zone = activeKillzone(zones, now);
  return Boolean(zone?.allowNewPositions && zone.multiplier > 0);
}
export function nextTransition(zones: Killzone[], now = new Date()): Date {
  const hour = now.getUTCHours();
  const boundaries = zones.flatMap((zone) => [zone.startHourUtc, zone.endHourUtc]).filter((boundary) => boundary > hour);
  const target = Math.min(...boundaries, 24);
  const result = new Date(now);
  result.setUTCMinutes(0, 0, 0);
  result.setUTCHours(target % 24);
  if (target === 24) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}
