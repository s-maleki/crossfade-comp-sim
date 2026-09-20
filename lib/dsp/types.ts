export type SignalKind =
  | "sine"
  | "guitar"
  | "multi"
  | "transient"
  | "repeating"
  | "am"
  | "custom";

export type RectifierType = "half" | "full" | "square-law" | "ideal-peak";

export type CrossfadeLaw = "linear-amplitude" | "linear-db";

export type DriveMode = "compressor" | "manual-gr" | "manual-mix" | "gr-sweep";

export type PairUpdateMode = "atomic" | "stagger-b-first" | "stagger-alpha-first";

export type Harmonics = [number, number, number, number, number];

export interface SignalParams {
  kind: SignalKind;
  frequency: number;
  amplitude: number;
  dcOffset: number;
  duration: number;
  burstDuration: number;
  repetitionHz: number;
  decayMs: number;
  amHz: number;
  harmonics: Harmonics;
  inharmonicity: number;
  noise: number;
}

export interface EnvelopeParams {
  rectifier: RectifierType;
  attackMs: number;
  releaseMs: number;
  capacitor: number;
}

export interface CompressorParams {
  thresholdDb: number;
  ratio: number;
  maxGrDb: number;
  makeupDb: number;
  kneeDb: number;
}

export interface AttenuatorParams {
  stepDb: number;
  law: CrossfadeLaw;
  pairUpdate: PairUpdateMode;
  staggerMs: number;
  nonlinearity: number;
  switchingGlitch: number;
}

export interface SimParams {
  sampleRate: number;
  signal: SignalParams;
  envelope: EnvelopeParams;
  compressor: CompressorParams;
  attenuator: AttenuatorParams;
  drive: DriveMode;
  manualGrDb: number;
  manualADb: number;
  manualBDb: number;
  manualMix: number;
  grSweepStart: number;
  grSweepEnd: number;
  distortionGain: number;
}

export type MarkerKind =
  | "transient"
  | "envelope"
  | "gr"
  | "glitch"
  | "pair";

export interface Marker {
  t: number;
  label: string;
  color: string;
  kind: MarkerKind;
}

export interface Peak {
  freq: number;
  magDb: number;
  harmonic: number | null;
}

export interface SpectrumResult {
  freqs: Float32Array;
  magDb: Float32Array;
  peaks: Peak[];
  sampleCount: number;
}

export interface ThdResult {
  thd: number | null;
  thdPercent: number | null;
  thdDb: number | null;
  fundamentalDb: number | null;
  harmonics: { n: number; db: number }[];
  noiseDb: number | null;
  note: string;
}

export interface StageReadout {
  input: number;
  rectified: number;
  envelope: number;
  envelopeDb: number;
  attacking: boolean;
  thresholdDb: number;
  overDb: number;
  desiredGrDb: number;
  desiredGainDb: number;
  attADb: number;
  attBDb: number;
  alpha: number;
  mixLinearDb: number;
  mixDbLawDb: number;
  actualGainDb: number;
  idealGainDb: number;
  errorDb: number;
  makeupDb: number;
  output: number;
  idealOut: number;
  controlVolts: number;
}

export interface SimResult {
  n: number;
  sampleRate: number;
  dt: number;
  duration: number;
  input: Float32Array;
  rectified: Float32Array;
  envelope: Float32Array;
  envelopeDb: Float32Array;
  envAttack: Uint8Array;
  desiredGrDb: Float32Array;
  attADb: Float32Array;
  attBDb: Float32Array;
  alpha: Float32Array;
  mixLinearDb: Float32Array;
  mixDbLawDb: Float32Array;
  actualGainDb: Float32Array;
  idealGainDb: Float32Array;
  chA: Float32Array;
  chB: Float32Array;
  mixLinear: Float32Array;
  mixDbLaw: Float32Array;
  output: Float32Array;
  idealOut: Float32Array;
  exaggerated: Float32Array;
  glitchFlags: Uint8Array;
  markers: Marker[];
  burstStarts: number[];
  pairTransitions: number[];
  spectrumOut: SpectrumResult;
  spectrumIdeal: SpectrumResult;
  thd: ThdResult;
  peakInput: number;
  peakOutput: number;
  peakEnvelope: number;
}

export interface AppState extends SimParams {
  viewStart: number;
  viewEnd: number;
  cursorTime: number;
  playing: boolean;
  speed: number;
  followPlayhead: boolean;
  educational: boolean;
  eduStage: number;
  showExaggerated: boolean;
  visibleTraces: Record<string, boolean>;
}
