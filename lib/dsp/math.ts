export const MIN_DB = -120;
export const EPS = 1e-12;

export function dbToLin(db: number): number {
  if (db <= MIN_DB) return 0;
  return 10 ** (db / 20);
}

export function linToDb(x: number): number {
  const a = Math.abs(x);
  if (a < EPS) return MIN_DB;
  return 20 * Math.log10(a);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function logMap(t: number, min: number, max: number): number {
  const u = clamp(t, 0, 1);
  return Math.exp(Math.log(min) + u * (Math.log(max) - Math.log(min)));
}

export function logUnmap(x: number, min: number, max: number): number {
  const v = clamp(x, min, max);
  return (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function formatDb(db: number, digits = 2): string {
  if (!Number.isFinite(db) || db <= MIN_DB + 0.5) return "−∞ dB";
  const abs = Math.abs(db).toFixed(digits);
  return `${db < 0 ? "−" : db > 0 ? "+" : ""}${abs} dB`;
}

export function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz`;
  if (hz < 10) return `${hz.toFixed(2)} Hz`;
  return `${hz.toFixed(hz < 100 ? 1 : 0)} Hz`;
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)} s`;
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  return `${ms.toFixed(ms < 100 ? 1 : 0)} ms`;
}

export function formatPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function formatRatio(ratio: number): string {
  if (ratio >= 99) return "∞:1";
  if (Number.isInteger(ratio)) return `${ratio}:1`;
  return `${ratio.toFixed(1)}:1`;
}

export function unicodeMinus(n: number, digits = 1): string {
  const abs = Math.abs(n).toFixed(digits);
  return n < 0 ? `−${abs}` : abs;
}
