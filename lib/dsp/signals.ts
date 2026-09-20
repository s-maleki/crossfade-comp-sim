import type { Harmonics, SignalKind, SignalParams } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function harmonicTone(
  t: number,
  f: number,
  harmonics: Harmonics,
  inharmonicity: number
): number {
  let s = 0;
  let w = 0;
  for (let n = 1; n <= 5; n++) {
    const a = harmonics[n - 1] ?? 0;
    if (a === 0) continue;
    const fn = f * n * Math.sqrt(1 + inharmonicity * n * n);
    s += a * Math.sin(2 * Math.PI * fn * t);
    w += Math.abs(a);
  }
  return w > 1e-12 ? s / w : 0;
}

function multiTone(t: number, f: number, amp: number): number {
  return (
    amp *
    (0.55 * Math.sin(2 * Math.PI * f * t) +
      0.32 * Math.sin(2 * Math.PI * 2.5 * f * t + 0.4) +
      0.18 * Math.sin(2 * Math.PI * 4.1 * f * t + 1.1))
  );
}

function firstEventTime(duration: number): number {
  return Math.min(0.04, Math.max(0.008, duration * 0.12));
}

function burstGain(u: number, dur: number): number {
  if (u < 0 || u > dur) return 0;
  const tau = Math.max(dur * 0.22, 1e-4);
  return Math.exp(-u / tau);
}

export function generateSignal(
  out: Float32Array,
  p: SignalParams,
  sampleRate: number
): number[] {
  const n = out.length;
  const burstStarts: number[] = [];
  const rng = mulberry32(0xc0ffee);
  const t0 = firstEventTime(p.duration);
  const decayTau = p.decayMs > 0 ? p.decayMs / 1000 : Infinity;
  const amp = p.amplitude;
  const kind: SignalKind = p.kind;

  if (kind === "repeating") {
    const period = 1 / Math.max(p.repetitionHz, 0.1);
    for (let t = t0; t < p.duration; t += period) burstStarts.push(t);
  } else if (kind === "transient" || kind === "guitar") {
    burstStarts.push(t0);
  } else if (kind === "custom" && p.burstDuration > 0 && p.decayMs > 0) {
    burstStarts.push(t0);
  }

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let env = 1;
    let tone = 0;

    switch (kind) {
      case "sine":
        tone = Math.sin(2 * Math.PI * p.frequency * t);
        env = 1;
        break;
      case "guitar": {
        tone = harmonicTone(t, p.frequency, p.harmonics, p.inharmonicity);
        const u = t - t0;
        env = u < 0 ? 0 : Math.exp(-u / Math.max(decayTau, 0.03));
        break;
      }
      case "multi":
        tone = multiTone(t, p.frequency, 1);
        env = 1;
        break;
      case "transient": {
        tone = harmonicTone(
          t,
          p.frequency,
          [1, 0.35, 0.18, 0.1, 0.06],
          0.0004
        );
        env = burstGain(t - t0, p.burstDuration);
        break;
      }
      case "repeating": {
        tone = Math.sin(2 * Math.PI * p.frequency * t);
        env = 0;
        for (const b of burstStarts) {
          env = Math.max(env, burstGain(t - b, p.burstDuration));
        }
        break;
      }
      case "am": {
        tone = Math.sin(2 * Math.PI * p.frequency * t);
        env = 0.5 + 0.5 * Math.sin(2 * Math.PI * p.amHz * t - Math.PI / 2);
        break;
      }
      case "custom": {
        tone = harmonicTone(t, p.frequency, p.harmonics, p.inharmonicity);
        if (p.burstDuration > 0 && p.repetitionHz > 0.05 && p.decayMs > 0) {
          env = 0;
          const period = 1 / p.repetitionHz;
          for (let b = t0; b < p.duration; b += period) {
            env = Math.max(env, burstGain(t - b, p.burstDuration));
          }
        } else if (p.decayMs > 0) {
          const u = t - t0;
          env = u < 0 ? 0 : Math.exp(-u / decayTau);
        } else {
          env = 1;
        }
        break;
      }
    }

    const noise = p.noise > 0 ? (rng() * 2 - 1) * p.noise : 0;
    out[i] = amp * env * tone + noise * amp * env + p.dcOffset;
  }

  if (kind === "am" || kind === "sine" || kind === "multi") {
    burstStarts.length = 0;
    burstStarts.push(t0);
  }

  return burstStarts;
}

export const GUITAR_HARMONICS: Harmonics = [1, 0.58, 0.34, 0.2, 0.12];
export const SINE_HARMONICS: Harmonics = [1, 0, 0, 0, 0];
export const BRIGHT_HARMONICS: Harmonics = [1, 0.7, 0.5, 0.32, 0.22];
