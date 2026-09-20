import { GUITAR_HARMONICS, SINE_HARMONICS } from "./signals";
import type {
  AttenuatorParams,
  CompressorParams,
  EnvelopeParams,
  SignalParams,
  SimParams,
} from "./types";

export const DEFAULT_PARAMS: SimParams = {
  sampleRate: 48000,
  signal: {
    kind: "repeating",
    frequency: 440,
    amplitude: 0.85,
    dcOffset: 0,
    duration: 0.45,
    burstDuration: 0.018,
    repetitionHz: 7,
    decayMs: 140,
    amHz: 4,
    harmonics: GUITAR_HARMONICS,
    inharmonicity: 0.0003,
    noise: 0,
  },
  envelope: {
    rectifier: "full",
    attackMs: 10,
    releaseMs: 120,
    capacitor: 1,
  },
  compressor: {
    thresholdDb: -14,
    ratio: 4,
    maxGrDb: 24,
    makeupDb: 6,
    kneeDb: 3,
  },
  attenuator: {
    stepDb: 1,
    law: "linear-amplitude",
    pairUpdate: "atomic",
    staggerMs: 0,
    nonlinearity: 0,
    switchingGlitch: 0,
  },
  drive: "compressor",
  manualGrDb: 10.5,
  manualADb: -10,
  manualBDb: -11,
  manualMix: 0.5,
  grSweepStart: 9.6,
  grSweepEnd: 11.4,
  distortionGain: 10,
};

export type PresetId =
  | "transients"
  | "guitar"
  | "attack"
  | "release"
  | "interpolation"
  | "pair-wrap"
  | "pair-glitch"
  | "am"
  | "sine-distortion"
  | "manual-mix";

export interface Preset {
  id: PresetId;
  name: string;
  blurb: string;
  params: Omit<
    Partial<SimParams>,
    "signal" | "envelope" | "compressor" | "attenuator"
  > & {
    signal?: Partial<SignalParams>;
    envelope?: Partial<EnvelopeParams>;
    compressor?: Partial<CompressorParams>;
    attenuator?: Partial<AttenuatorParams>;
  };
}

export const PRESETS: Preset[] = [
  {
    id: "transients",
    name: "Repeating transients",
    blurb: "See attack grab each burst, then release between hits.",
    params: {
      drive: "compressor",
      signal: {
        kind: "repeating",
        frequency: 440,
        amplitude: 0.9,
        duration: 0.5,
        burstDuration: 0.016,
        repetitionHz: 6.5,
        dcOffset: 0,
      },
      envelope: { rectifier: "full", attackMs: 8, releaseMs: 90, capacitor: 1 },
      compressor: {
        thresholdDb: -16,
        ratio: 4,
        maxGrDb: 24,
        makeupDb: 4,
        kneeDb: 2,
      },
    },
  },
  {
    id: "guitar",
    name: "Guitar-like decay",
    blurb: "Harmonic plucked tone with gain reduction following the envelope.",
    params: {
      drive: "compressor",
      signal: {
        kind: "guitar",
        frequency: 196,
        amplitude: 0.95,
        duration: 0.7,
        decayMs: 180,
        harmonics: GUITAR_HARMONICS,
        inharmonicity: 0.0004,
        noise: 0.012,
        dcOffset: 0,
      },
      envelope: { rectifier: "full", attackMs: 12, releaseMs: 160, capacitor: 1 },
      compressor: {
        thresholdDb: -12,
        ratio: 4,
        maxGrDb: 20,
        makeupDb: 6,
        kneeDb: 4,
      },
    },
  },
  {
    id: "attack",
    name: "Attack delay",
    blurb: "Slow attack leaves the transient through, then GR catches up.",
    params: {
      drive: "compressor",
      signal: {
        kind: "transient",
        frequency: 500,
        amplitude: 1,
        duration: 0.22,
        burstDuration: 0.08,
        dcOffset: 0,
        noise: 0,
      },
      envelope: { rectifier: "full", attackMs: 30, releaseMs: 200, capacitor: 1 },
      compressor: {
        thresholdDb: -18,
        ratio: 8,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 0,
      },
    },
  },
  {
    id: "release",
    name: "Release tail",
    blurb: "After the input drops, GR returns toward 0 dB on the release constant.",
    params: {
      drive: "compressor",
      signal: {
        kind: "transient",
        frequency: 330,
        amplitude: 0.95,
        duration: 0.9,
        burstDuration: 0.05,
        dcOffset: 0,
      },
      envelope: { rectifier: "full", attackMs: 1, releaseMs: 400, capacitor: 1 },
      compressor: {
        thresholdDb: -14,
        ratio: 6,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 1,
      },
    },
  },
  {
    id: "interpolation",
    name: "1 dB interpolation",
    blurb: "Sine + GR sweep −9.6 → −11.4 dB. Watch α walk A→B, then the pair wrap.",
    params: {
      drive: "gr-sweep",
      signal: {
        kind: "sine",
        frequency: 440,
        amplitude: 0.7,
        duration: 0.6,
        harmonics: SINE_HARMONICS,
        dcOffset: 0,
        noise: 0,
      },
      grSweepStart: 9.6,
      grSweepEnd: 11.4,
      compressor: {
        thresholdDb: -40,
        ratio: 4,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 0,
      },
      envelope: { rectifier: "full", attackMs: 1, releaseMs: 20, capacitor: 1 },
      attenuator: {
        stepDb: 1,
        law: "linear-amplitude",
        pairUpdate: "atomic",
        staggerMs: 0,
        nonlinearity: 0,
        switchingGlitch: 0,
      },
    },
  },
  {
    id: "pair-wrap",
    name: "Pair transition",
    blurb: "Slow GR sweep across −10/−11 → −11/−12 with time stretched.",
    params: {
      drive: "gr-sweep",
      signal: {
        kind: "sine",
        frequency: 200,
        amplitude: 0.8,
        duration: 1.2,
        harmonics: SINE_HARMONICS,
        dcOffset: 0,
        noise: 0,
      },
      grSweepStart: 10.2,
      grSweepEnd: 11.8,
      compressor: {
        thresholdDb: -40,
        ratio: 4,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 0,
      },
      attenuator: {
        stepDb: 1,
        law: "linear-amplitude",
        pairUpdate: "atomic",
        staggerMs: 0,
        nonlinearity: 0,
        switchingGlitch: 0,
      },
    },
  },
  {
    id: "pair-glitch",
    name: "Staggered wrap glitch",
    blurb: "B updates before A. The 1 dB hole is highlighted, not hidden.",
    params: {
      drive: "gr-sweep",
      signal: {
        kind: "sine",
        frequency: 250,
        amplitude: 0.8,
        duration: 0.8,
        harmonics: SINE_HARMONICS,
        dcOffset: 0,
        noise: 0,
      },
      grSweepStart: 10.4,
      grSweepEnd: 11.6,
      compressor: {
        thresholdDb: -40,
        ratio: 4,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 0,
      },
      attenuator: {
        stepDb: 1,
        law: "linear-amplitude",
        pairUpdate: "stagger-b-first",
        staggerMs: 12,
        nonlinearity: 0,
        switchingGlitch: 0.04,
      },
    },
  },
  {
    id: "am",
    name: "Slow AM",
    blurb: "Level wanders through threshold so GR breathes with the amplitude.",
    params: {
      drive: "compressor",
      signal: {
        kind: "am",
        frequency: 440,
        amplitude: 0.8,
        duration: 0.8,
        amHz: 3,
        dcOffset: 0,
      },
      envelope: { rectifier: "full", attackMs: 5, releaseMs: 80, capacitor: 1 },
      compressor: {
        thresholdDb: -10,
        ratio: 4,
        maxGrDb: 18,
        makeupDb: 3,
        kneeDb: 3,
      },
    },
  },
  {
    id: "sine-distortion",
    name: "Crossfade distortion",
    blurb: "Pure sine, analog nonlinearity on. Spectrum shows harmonics; ×10 makes them obvious.",
    params: {
      drive: "manual-mix",
      signal: {
        kind: "sine",
        frequency: 440,
        amplitude: 0.7,
        duration: 0.25,
        harmonics: SINE_HARMONICS,
        dcOffset: 0,
        noise: 0,
      },
      manualADb: -10,
      manualBDb: -11,
      manualMix: 0.5,
      attenuator: {
        stepDb: 1,
        law: "linear-amplitude",
        pairUpdate: "atomic",
        staggerMs: 0,
        nonlinearity: 0.18,
        switchingGlitch: 0,
      },
      compressor: {
        thresholdDb: -40,
        ratio: 1,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 0,
      },
    },
  },
  {
    id: "manual-mix",
    name: "Manual A ↔ B mix",
    blurb: "Park the digital pair and sweep the analog crossfader yourself.",
    params: {
      drive: "manual-mix",
      signal: {
        kind: "sine",
        frequency: 440,
        amplitude: 0.75,
        duration: 0.3,
        harmonics: SINE_HARMONICS,
        dcOffset: 0,
      },
      manualADb: -10,
      manualBDb: -11,
      manualMix: 0.35,
      attenuator: {
        stepDb: 1,
        law: "linear-amplitude",
        pairUpdate: "atomic",
        staggerMs: 0,
        nonlinearity: 0,
        switchingGlitch: 0,
      },
      compressor: {
        thresholdDb: -40,
        ratio: 1,
        maxGrDb: 24,
        makeupDb: 0,
        kneeDb: 0,
      },
    },
  },
];

export function applyPreset(base: SimParams, preset: Preset): SimParams {
  return {
    ...base,
    ...preset.params,
    signal: { ...base.signal, ...preset.params.signal },
    envelope: { ...base.envelope, ...preset.params.envelope },
    compressor: { ...base.compressor, ...preset.params.compressor },
    attenuator: { ...base.attenuator, ...preset.params.attenuator },
  };
}
