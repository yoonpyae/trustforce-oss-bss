// Deterministic PRNG shared by the seed script and any server-side simulation
// of network telemetry (optical jitter, session throughput, uptime) so the
// same object always produces the same "live" numbers within a time bucket.

export function makeRng(seed: number) {
  let s = seed >>> 0;
  return function rng() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function seedFromString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export class Rand {
  private next: () => number;
  constructor(seed: number) {
    this.next = makeRng(seed);
  }
  float() {
    return this.next();
  }
  int(lo: number, hi: number) {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number) {
    return this.next() < p;
  }
}

export const DAY_MS = 86400000;
export const REFERENCE_NOW = new Date("2026-09-18T09:20:00+06:30").getTime();
