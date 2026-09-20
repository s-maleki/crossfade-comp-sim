import { linToDb, nextPow2 } from "./math";
import type { Peak, SpectrumResult, ThdResult } from "./types";

function bitReversePermute(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
}

export function fftRadix2(re: Float32Array, im: Float32Array) {
  const n = re.length;
  bitReversePermute(re, im);
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vr = re[i + j + half];
        const vi = im[i + j + half];
        const vRe = vr * wRe - vi * wIm;
        const vIm = vr * wIm + vi * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nwRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nwRe;
      }
    }
  }
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  if (n <= 1) {
    w[0] = 1;
    return w;
  }
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}

function magAt(re: Float32Array, im: Float32Array, k: number): number {
  const n = re.length;
  const i0 = Math.max(0, Math.min(n - 1, Math.floor(k)));
  const i1 = Math.max(0, Math.min(n - 1, i0 + 1));
  const frac = k - i0;
  const m0 = Math.hypot(re[i0], im[i0]);
  const m1 = Math.hypot(re[i1], im[i1]);
  return m0 + (m1 - m0) * frac;
}

export function analyzeSpectrum(
  samples: Float32Array,
  sampleRate: number,
  start: number,
  end: number,
  f0: number | null
): SpectrumResult {
  const i0 = Math.max(0, Math.floor(start * sampleRate));
  const i1 = Math.min(samples.length, Math.ceil(end * sampleRate));
  const len = Math.max(0, i1 - i0);
  const N = Math.min(4096, nextPow2(Math.max(len, 32)));
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const take = Math.min(len, N);
  const w = hann(take);
  let wsum = 0;
  for (let i = 0; i < take; i++) wsum += w[i];
  const norm = wsum > 0 ? 2 / wsum : 1;
  for (let i = 0; i < take; i++) {
    re[i] = samples[i0 + i] * w[i];
  }
  fftRadix2(re, im);

  const bins = N / 2;
  const freqs = new Float32Array(bins);
  const magDb = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    freqs[k] = (k * sampleRate) / N;
    magDb[k] = linToDb(Math.hypot(re[k], im[k]) * norm);
  }

  const peaks: Peak[] = [];
  const used = new Uint8Array(bins);
  const count = 6;
  for (let p = 0; p < count; p++) {
    let bestK = 1;
    let best = -1e9;
    for (let k = 1; k < bins - 1; k++) {
      if (used[k]) continue;
      if (magDb[k] > best && magDb[k] >= magDb[k - 1] && magDb[k] >= magDb[k + 1]) {
        best = magDb[k];
        bestK = k;
      }
    }
    if (best < -90) break;
    for (let k = Math.max(1, bestK - 2); k <= Math.min(bins - 2, bestK + 2); k++) {
      used[k] = 1;
    }
    let harmonic: number | null = null;
    if (f0 && f0 > 1) {
      const ratio = freqs[bestK] / f0;
      const nearest = Math.round(ratio);
      if (nearest >= 1 && nearest <= 16 && Math.abs(ratio - nearest) < 0.08) {
        harmonic = nearest;
      }
    }
    peaks.push({ freq: freqs[bestK], magDb: magDb[bestK], harmonic });
  }

  return { freqs, magDb, peaks, sampleCount: take };
}

export function computeThd(
  samples: Float32Array,
  sampleRate: number,
  f0: number,
  start: number,
  end: number
): ThdResult {
  if (f0 < 20) {
    return {
      thd: null,
      thdPercent: null,
      thdDb: null,
      fundamentalDb: null,
      harmonics: [],
      noiseDb: null,
      note: "THD needs a tonal fundamental above 20 Hz.",
    };
  }

  const i0 = Math.max(0, Math.floor(start * sampleRate));
  const i1 = Math.min(samples.length, Math.ceil(end * sampleRate));
  const len = Math.max(0, i1 - i0);
  if (len < sampleRate / f0 * 4) {
    return {
      thd: null,
      thdPercent: null,
      thdDb: null,
      fundamentalDb: null,
      harmonics: [],
      noiseDb: null,
      note: "Window too short for a stable THD estimate.",
    };
  }

  const N = Math.min(8192, nextPow2(Math.max(len, 256)));
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const take = Math.min(len, N);
  const w = hann(take);
  let wsum = 0;
  for (let i = 0; i < take; i++) wsum += w[i];
  const norm = wsum > 0 ? 2 / wsum : 1;
  for (let i = 0; i < take; i++) re[i] = samples[i0 + i] * w[i];
  fftRadix2(re, im);

  const h1 = magAt(re, im, (f0 * N) / sampleRate) * norm;
  if (h1 < 1e-8) {
    return {
      thd: null,
      thdPercent: null,
      thdDb: null,
      fundamentalDb: null,
      harmonics: [],
      noiseDb: null,
      note: "Fundamental too small to measure THD.",
    };
  }

  const harmonics: { n: number; db: number }[] = [];
  let harmPow = 0;
  const nyquist = sampleRate / 2;
  for (let n = 2; n <= 10; n++) {
    const f = f0 * n;
    if (f >= nyquist * 0.98) break;
    const mag = magAt(re, im, (f * N) / sampleRate) * norm;
    harmonics.push({ n, db: linToDb(mag) });
    harmPow += mag * mag;
  }

  let totalPow = 0;
  const bins = N / 2;
  for (let k = 1; k < bins; k++) {
    const mag = Math.hypot(re[k], im[k]) * norm;
    totalPow += mag * mag;
  }
  const fundPow = h1 * h1;
  const noisePow = Math.max(0, totalPow - fundPow - harmPow);
  const thd = Math.sqrt(harmPow) / h1;
  const thdDb = linToDb(thd);

  return {
    thd,
    thdPercent: thd * 100,
    thdDb,
    fundamentalDb: linToDb(h1),
    harmonics,
    noiseDb: linToDb(Math.sqrt(noisePow)),
    note: "THD from harmonics 2–10 relative to the fundamental, Hann-windowed DFT.",
  };
}
