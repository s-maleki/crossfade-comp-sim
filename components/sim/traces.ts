import type { SimParams, SimResult } from "@/lib/dsp";

export type TraceId =
  | "input"
  | "rectified"
  | "envelope"
  | "desiredGr"
  | "attA"
  | "chA"
  | "chB"
  | "alpha"
  | "mix"
  | "output";

export type LaneScale = "audio" | "uni" | "gr" | "alpha";

export interface LaneDef {
  id: TraceId;
  label: string;
  short: string;
  unit: string;
  color: string;
  color2?: string;
  color3?: string;
  scale: LaneScale;
  primary: (r: SimResult) => Float32Array;
  secondary?: (r: SimResult) => Float32Array;
  tertiary?: (r: SimResult, showEx: boolean) => Float32Array | null;
}

export const LANES: LaneDef[] = [
  {
    id: "input",
    label: "Original input",
    short: "IN",
    unit: "V",
    color: "#7dd3fc",
    scale: "audio",
    primary: (r) => r.input,
  },
  {
    id: "rectified",
    label: "Rectified / detector",
    short: "RECT",
    unit: "V",
    color: "#fde047",
    scale: "uni",
    primary: (r) => r.rectified,
  },
  {
    id: "envelope",
    label: "Smoothed envelope",
    short: "ENV",
    unit: "V",
    color: "#fb923c",
    scale: "uni",
    primary: (r) => r.envelope,
  },
  {
    id: "desiredGr",
    label: "Desired GR / actual gain",
    short: "GR",
    unit: "dB",
    color: "#e879f9",
    color2: "#a3e635",
    scale: "gr",
    primary: (r) => r.desiredGrDb,
    secondary: (r) => r.actualGainDb,
  },
  {
    id: "attA",
    label: "Digital att. A / B",
    short: "DIG",
    unit: "dB",
    color: "#60a5fa",
    color2: "#4ade80",
    scale: "gr",
    primary: (r) => r.attADb,
    secondary: (r) => r.attBDb,
  },
  {
    id: "chA",
    label: "Channel A audio",
    short: "A",
    unit: "V",
    color: "#38bdf8",
    scale: "audio",
    primary: (r) => r.chA,
  },
  {
    id: "chB",
    label: "Channel B audio",
    short: "B",
    unit: "V",
    color: "#86efac",
    scale: "audio",
    primary: (r) => r.chB,
  },
  {
    id: "alpha",
    label: "Crossfader α",
    short: "MIX",
    unit: "%",
    color: "#c4b5fd",
    scale: "alpha",
    primary: (r) => r.alpha,
  },
  {
    id: "mix",
    label: "Crossfader (lin / dB-law)",
    short: "XFD",
    unit: "V",
    color: "#f5d0fe",
    color2: "#67e8f9",
    scale: "audio",
    primary: (r) => r.mixLinear,
    secondary: (r) => r.mixDbLaw,
  },
  {
    id: "output",
    label: "Output vs ideal VCA",
    short: "OUT",
    unit: "V",
    color: "#a3e635",
    color2: "#94a3b8",
    color3: "#fb7185",
    scale: "audio",
    primary: (r) => r.output,
    secondary: (r) => r.idealOut,
    tertiary: (r, showEx) => (showEx ? r.exaggerated : null),
  },
];

export const DEFAULT_VISIBLE: Record<string, boolean> = Object.fromEntries(
  LANES.map((l) => [l.id, true])
);

export function laneYRange(
  lane: LaneDef,
  result: SimResult,
  params: SimParams,
  i0: number,
  i1: number
): { yMin: number; yMax: number } {
  if (lane.scale === "alpha") return { yMin: -0.05, yMax: 1.05 };
  if (lane.scale === "gr") {
    let lo = 0;
    let hi = 0;
    const scan = (arr: Float32Array) => {
      const a = Math.max(0, i0);
      const b = Math.min(arr.length, i1);
      for (let i = a; i < b; i++) {
        const v = arr[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    };
    scan(lane.primary(result));
    const s = lane.secondary?.(result);
    if (s) scan(s);
    let yMin = lo - 0.35;
    let yMax = hi + 0.35;
    if (yMax - yMin < 3) {
      const mid = (yMax + yMin) / 2;
      yMin = mid - 1.6;
      yMax = mid + 1.6;
    }
    return { yMin, yMax };
  }

  let peak = 0.05;
  const scan = (arr: Float32Array) => {
    const a = Math.max(0, i0);
    const b = Math.min(arr.length, i1);
    for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(arr[i]));
  };
  scan(lane.primary(result));
  const s = lane.secondary?.(result);
  if (s) scan(s);

  if (lane.scale === "uni") {
    const thr = Math.abs(10 ** (params.compressor.thresholdDb / 20));
    peak = Math.max(peak, thr, result.peakEnvelope, 0.05);
    return { yMin: -0.02 * peak, yMax: peak * 1.12 };
  }

  peak = Math.max(peak, result.peakInput * 0.25, 0.08);
  return { yMin: -peak * 1.12, yMax: peak * 1.12 };
}

export function formatLaneValue(lane: LaneDef, v: number): string {
  if (lane.scale === "gr") {
    const abs = Math.abs(v).toFixed(2);
    return `${v < 0 ? "−" : ""}${abs} dB`;
  }
  if (lane.scale === "alpha") return `${(v * 100).toFixed(1)}%`;
  const abs = Math.abs(v);
  const s = abs >= 1 ? abs.toFixed(3) : abs.toFixed(4);
  return `${v < 0 ? "−" : ""}${s}`;
}
