import { analyzeSpectrum, computeThd } from "./fft";
import { clamp, dbToLin, linToDb } from "./math";
import { generateSignal } from "./signals";
import type {
  CompressorParams,
  Marker,
  PairUpdateMode,
  RectifierType,
  SimParams,
  SimResult,
  StageReadout,
} from "./types";

export function rectify(x: number, type: RectifierType): number {
  switch (type) {
    case "half":
      return x > 0 ? x : 0;
    case "full":
      return Math.abs(x);
    case "square-law":
      return x * x;
    case "ideal-peak":
      return Math.abs(x);
  }
}

export function computeGainReduction(
  levelDb: number,
  p: CompressorParams
): number {
  if (p.ratio <= 1.0001) return 0;
  const slope = 1 - 1 / p.ratio;
  const over = levelDb - p.thresholdDb;
  const knee = Math.max(p.kneeDb, 0);
  const half = knee / 2;
  let gr = 0;
  if (over <= -half) {
    gr = 0;
  } else if (knee <= 1e-6 || over >= half) {
    gr = Math.max(0, over) * slope;
  } else {
    const t = over + half;
    gr = (slope * t * t) / (2 * knee);
  }
  return clamp(gr, 0, p.maxGrDb);
}

export function compressorOutputDb(
  inputDb: number,
  p: CompressorParams
): number {
  return inputDb - computeGainReduction(inputDb, p) + p.makeupDb;
}

export function pairFromDesired(
  desiredGainDb: number,
  stepDb: number
): { aDb: number; bDb: number; alpha: number } {
  const step = Math.max(stepDb, 0.1);
  const g = Math.min(0, desiredGainDb);
  const aDb = Math.ceil(g / step - 1e-9) * step;
  const bDb = aDb - step;
  const alpha = clamp((aDb - g) / step, 0, 1);
  return { aDb, bDb, alpha };
}

export function crossfadeGains(aDb: number, bDb: number, alpha: number) {
  const a = clamp(alpha, 0, 1);
  const gA = dbToLin(aDb);
  const gB = dbToLin(bDb);
  const gLin = (1 - a) * gA + a * gB;
  const dbInterp = (1 - a) * aDb + a * bDb;
  return {
    gA,
    gB,
    gLinearAmp: gLin,
    linearAmpDb: linToDb(gLin),
    gLinearDb: dbToLin(dbInterp),
    linearDbDb: dbInterp,
  };
}

export function lawCurve(
  aDb: number,
  bDb: number,
  points = 129
): { alpha: number; linearAmpDb: number; linearDbDb: number }[] {
  const out = [];
  for (let i = 0; i < points; i++) {
    const alpha = i / (points - 1);
    const g = crossfadeGains(aDb, bDb, alpha);
    out.push({
      alpha,
      linearAmpDb: g.linearAmpDb,
      linearDbDb: g.linearDbDb,
    });
  }
  return out;
}

function analogSaturate(y: number, amount: number): number {
  if (amount <= 0) return y;
  const c = amount * 4;
  return Math.tanh(y * (1 + c)) / Math.tanh(1 + c);
}

export function readoutAt(result: SimResult, params: SimParams, t: number): StageReadout {
  const i = clamp(Math.round(t * result.sampleRate), 0, result.n - 1);
  const envDb = result.envelopeDb[i];
  return {
    input: result.input[i],
    rectified: result.rectified[i],
    envelope: result.envelope[i],
    envelopeDb: envDb,
    attacking: result.envAttack[i] === 1,
    thresholdDb: params.compressor.thresholdDb,
    overDb: envDb - params.compressor.thresholdDb,
    desiredGrDb: result.desiredGrDb[i],
    desiredGainDb: result.idealGainDb[i],
    attADb: result.attADb[i],
    attBDb: result.attBDb[i],
    alpha: result.alpha[i],
    mixLinearDb: result.mixLinearDb[i],
    mixDbLawDb: result.mixDbLawDb[i],
    actualGainDb: result.actualGainDb[i],
    idealGainDb: result.idealGainDb[i],
    errorDb: result.actualGainDb[i] - result.idealGainDb[i],
    makeupDb: params.compressor.makeupDb,
    output: result.output[i],
    idealOut: result.idealOut[i],
    controlVolts: result.alpha[i] * 5,
  };
}

export function simulate(p: SimParams): SimResult {
  const sr = p.sampleRate;
  const duration = clamp(p.signal.duration, 0.03, 2.5);
  const n = Math.max(128, Math.floor(duration * sr));
  const dt = 1 / sr;

  const input = new Float32Array(n);
  const burstStarts = generateSignal(input, { ...p.signal, duration }, sr);

  const rectified = new Float32Array(n);
  const envelope = new Float32Array(n);
  const envelopeDb = new Float32Array(n);
  const envAttack = new Uint8Array(n);
  const desiredGrDb = new Float32Array(n);
  const attADb = new Float32Array(n);
  const attBDb = new Float32Array(n);
  const alphaArr = new Float32Array(n);
  const mixLinearDb = new Float32Array(n);
  const mixDbLawDb = new Float32Array(n);
  const actualGainDb = new Float32Array(n);
  const idealGainDb = new Float32Array(n);
  const chA = new Float32Array(n);
  const chB = new Float32Array(n);
  const mixLinear = new Float32Array(n);
  const mixDbLaw = new Float32Array(n);
  const output = new Float32Array(n);
  const idealOut = new Float32Array(n);
  const exaggerated = new Float32Array(n);
  const glitchFlags = new Uint8Array(n);

  const tauA = Math.max(1e-6, (p.envelope.attackMs / 1000) * p.envelope.capacitor);
  const tauR = Math.max(1e-6, (p.envelope.releaseMs / 1000) * p.envelope.capacitor);
  const coeffA = 1 - Math.exp(-dt / tauA);
  const coeffR = 1 - Math.exp(-dt / tauR);

  const makeupLin = dbToLin(p.compressor.makeupDb);
  const step = p.attenuator.stepDb;
  const update: PairUpdateMode = p.attenuator.pairUpdate;
  let staggerN = Math.max(0, Math.round((p.attenuator.staggerMs / 1000) * sr));
  if (update !== "atomic" && staggerN <= 0) staggerN = 1;

  let env = 0;
  let rms = 0;
  let liveA = 0;
  let liveB = -step;
  let pendingA: number | null = null;
  let pendingB: number | null = null;
  let delayLeft = 0;
  let glitchEnv = 0;
  let prevA = 0;
  let prevB = -step;
  const pairTransitions: number[] = [];

  let peakInput = 0;
  let peakOutput = 0;
  let peakEnvelope = 0;

  for (let i = 0; i < n; i++) {
    const x = input[i];
    peakInput = Math.max(peakInput, Math.abs(x));

    const rRaw = rectify(x, p.envelope.rectifier);
    let r = rRaw;
    if (p.envelope.rectifier === "square-law") {
      rms += (rRaw - rms) * (rRaw > rms ? coeffA : coeffR);
      r = Math.sqrt(Math.max(rms, 0));
    }

    if (r >= env) {
      env += (r - env) * coeffA;
      envAttack[i] = 1;
    } else {
      env += (r - env) * coeffR;
      envAttack[i] = 0;
    }

    rectified[i] = p.envelope.rectifier === "square-law" ? rRaw : r;
    envelope[i] = env;
    peakEnvelope = Math.max(peakEnvelope, env);
    const envDb = linToDb(env);
    envelopeDb[i] = envDb;

    let gr = 0;
    const tNorm = n > 1 ? i / (n - 1) : 0;
    switch (p.drive) {
      case "compressor":
        gr = computeGainReduction(envDb, p.compressor);
        break;
      case "manual-gr":
        gr = clamp(p.manualGrDb, 0, p.compressor.maxGrDb);
        break;
      case "gr-sweep":
        gr = clamp(
          p.grSweepStart + tNorm * (p.grSweepEnd - p.grSweepStart),
          0,
          p.compressor.maxGrDb
        );
        break;
      case "manual-mix":
        gr = computeGainReduction(envDb, p.compressor);
        break;
    }

    const desiredGain = -gr;
    desiredGrDb[i] = -gr;
    idealGainDb[i] = desiredGain;

    let targetA: number;
    let targetB: number;
    let alpha: number;

    if (p.drive === "manual-mix") {
      targetA = p.manualADb;
      targetB = p.manualBDb;
      alpha = clamp(p.manualMix, 0, 1);
    } else {
      const pair = pairFromDesired(desiredGain, step);
      targetA = pair.aDb;
      targetB = pair.bDb;
      alpha = pair.alpha;
    }

    if (update === "atomic" || staggerN <= 0 || p.drive === "manual-mix") {
      liveA = targetA;
      liveB = targetB;
    } else {
      const changed = targetA !== liveA || targetB !== liveB;
      if (changed && delayLeft === 0) {
        pairTransitions.push(i / sr);
        if (update === "stagger-b-first") {
          liveB = targetB;
          pendingA = targetA;
          pendingB = null;
          delayLeft = staggerN;
        } else {
          pendingA = targetA;
          pendingB = targetB;
          delayLeft = staggerN;
        }
      }
      if (delayLeft > 0) {
        delayLeft -= 1;
        if (delayLeft === 0) {
          if (pendingA !== null) liveA = pendingA;
          if (pendingB !== null) liveB = pendingB;
          pendingA = null;
          pendingB = null;
        }
      }
    }

    if (i > 0 && (liveA !== prevA || liveB !== prevB) && update === "atomic") {
      if (Math.abs(liveA - prevA) > 1e-6) pairTransitions.push(i / sr);
    }
    if (liveA !== prevA || liveB !== prevB) {
      glitchEnv = p.attenuator.switchingGlitch;
    }
    prevA = liveA;
    prevB = liveB;

    attADb[i] = liveA;
    attBDb[i] = liveB;
    alphaArr[i] = alpha;

    const gains = crossfadeGains(liveA, liveB, alpha);
    mixLinearDb[i] = gains.linearAmpDb;
    mixDbLawDb[i] = gains.linearDbDb;

    const gA = gains.gA;
    const gB = gains.gB;
    chA[i] = x * gA;
    chB[i] = x * gB;

    const yLin = (1 - alpha) * chA[i] + alpha * chB[i];
    const yDb = x * gains.gLinearDb;

    mixLinear[i] = yLin;
    mixDbLaw[i] = yDb;

    const yCore = p.attenuator.law === "linear-amplitude" ? yLin : yDb;
    glitchEnv *= Math.exp(-dt / 80e-6);
    const ySat = analogSaturate(yCore, p.attenuator.nonlinearity);
    const y = ySat + glitchEnv * Math.sign(x || 1);

    const gUsed =
      p.attenuator.law === "linear-amplitude" ? gains.gLinearAmp : gains.gLinearDb;
    actualGainDb[i] = linToDb(gUsed);

    output[i] = y * makeupLin;
    idealOut[i] = x * dbToLin(desiredGain) * makeupLin;
    peakOutput = Math.max(peakOutput, Math.abs(output[i]));

    if (i > 0) {
      const dG = Math.abs(actualGainDb[i] - actualGainDb[i - 1]);
      if (dG > 0.15) glitchFlags[i] = 1;
    }
  }

  const dist = Math.max(1, p.distortionGain);
  for (let i = 0; i < n; i++) {
    exaggerated[i] = idealOut[i] + dist * (output[i] - idealOut[i]);
  }

  const markers = buildMarkers({
    burstStarts,
    envelope,
    desiredGrDb,
    envAttack,
    glitchFlags,
    pairTransitions,
    n,
    sr,
    attackMs: p.envelope.attackMs * p.envelope.capacitor,
  });

  const specStart = Math.max(0, duration * 0.15);
  const specEnd = duration;
  const f0 = p.signal.kind === "multi" ? p.signal.frequency : p.signal.frequency;
  const spectrumOut = analyzeSpectrum(output, sr, specStart, specEnd, f0);
  const spectrumIdeal = analyzeSpectrum(idealOut, sr, specStart, specEnd, f0);
  const thd = computeThd(output, sr, f0, specStart, specEnd);

  return {
    n,
    sampleRate: sr,
    dt,
    duration: n / sr,
    input,
    rectified,
    envelope,
    envelopeDb,
    envAttack,
    desiredGrDb,
    attADb,
    attBDb,
    alpha: alphaArr,
    mixLinearDb,
    mixDbLawDb,
    actualGainDb,
    idealGainDb,
    chA,
    chB,
    mixLinear,
    mixDbLaw,
    output,
    idealOut,
    exaggerated,
    glitchFlags,
    markers,
    burstStarts,
    pairTransitions,
    spectrumOut,
    spectrumIdeal,
    thd,
    peakInput,
    peakOutput,
    peakEnvelope,
  };
}

function buildMarkers(args: {
  burstStarts: number[];
  envelope: Float32Array;
  desiredGrDb: Float32Array;
  envAttack: Uint8Array;
  glitchFlags: Uint8Array;
  pairTransitions: number[];
  n: number;
  sr: number;
  attackMs: number;
}): Marker[] {
  const markers: Marker[] = [];
  const { n, sr } = args;
  const search = Math.max(8, Math.floor((Math.max(args.attackMs, 1) / 1000) * sr * 8));

  for (const t0 of args.burstStarts) {
    const i0 = clamp(Math.floor(t0 * sr), 0, n - 1);
    markers.push({
      t: t0,
      label: "Transient start",
      color: "#7dd3fc",
      kind: "transient",
    });

    let peakEnv = 0;
    let peakGr = 0;
    const i1 = Math.min(n - 1, i0 + search);
    for (let i = i0; i <= i1; i++) {
      peakEnv = Math.max(peakEnv, args.envelope[i]);
      peakGr = Math.min(peakGr, args.desiredGrDb[i]);
    }
    const envTarget = peakEnv * 0.9;
    const grTarget = peakGr * 0.9;
    for (let i = i0; i <= i1; i++) {
      if (args.envelope[i] >= envTarget && peakEnv > 1e-4) {
        markers.push({
          t: i / sr,
          label: "Envelope 90%",
          color: "#fb923c",
          kind: "envelope",
        });
        break;
      }
    }
    if (peakGr < -0.2) {
      for (let i = i0; i <= i1; i++) {
        if (args.desiredGrDb[i] <= grTarget) {
          markers.push({
            t: i / sr,
            label: "GR 90%",
            color: "#e879f9",
            kind: "gr",
          });
          break;
        }
      }
    }
  }

  let lastGlitch = -1e9;
  for (let i = 1; i < n; i++) {
    if (args.glitchFlags[i] && i / sr - lastGlitch > 0.002) {
      lastGlitch = i / sr;
      markers.push({
        t: i / sr,
        label: "Gain discontinuity",
        color: "#f87171",
        kind: "glitch",
      });
    }
  }

  let lastPair = -1e9;
  for (const t of args.pairTransitions) {
    if (t - lastPair > 0.0005) {
      markers.push({
        t,
        label: "Pair wrap A/B",
        color: "#c4b5fd",
        kind: "pair",
      });
      lastPair = t;
    }
  }

  return markers;
}

export const EDU_STAGES = [
  {
    id: "input",
    title: "1. Audio input",
    trace: "input",
    summary:
      "The source waveform x(t) is split into two identical analog paths plus a sidechain.",
    equation: "x[n] = A · s(n / fs) + x_DC",
  },
  {
    id: "rectify",
    title: "2. Rectification",
    trace: "rectified",
    summary:
      "The sidechain rectifier converts bipolar audio into a unipolar voltage the envelope capacitor can store.",
    equation: "r = |x|  (full-wave)  or  max(x, 0)  or  x²",
  },
  {
    id: "envelope",
    title: "3. Envelope (attack / release)",
    trace: "envelope",
    summary:
      "A peak detector with independent charge and discharge time constants tracks level. Attack is faster than release in a typical compressor.",
    equation: "y[n] = y[n−1] + (r − y) (1 − e^{−Δt / τ})   τ = τ_A if r > y else τ_R",
  },
  {
    id: "comp",
    title: "4. Compressor characteristic",
    trace: "desiredGr",
    summary:
      "Envelope level in dB is compared to threshold. Above threshold, excess is reduced by (1 − 1/ratio). Makeup is applied later.",
    equation: "GR = min( max(0, L − T) · (1 − 1/R) , GR_max )   g_des = −GR",
  },
  {
    id: "digital",
    title: "5. Digital attenuation pair",
    trace: "attA",
    summary:
      "The digital IC can only sit on a discrete dB step. Two adjacent codes bracket the desired gain; the leftover fraction becomes the analog mix.",
    equation: "A = Δ · ceil(g_des / Δ)     B = A − Δ     α = (A − g_des) / Δ",
  },
  {
    id: "channels",
    title: "6. Channel A and Channel B",
    trace: "chA",
    summary:
      "Identical audio is scaled by two different digital gains. Between integer dB codes the analog content of the two paths is the same signal at two nearby amplitudes.",
    equation: "v_A = x · 10^{A/20}     v_B = x · 10^{B/20}",
  },
  {
    id: "crossfade",
    title: "7. Analog crossfader",
    trace: "alpha",
    summary:
      "A linear voltage mix interpolates amplitude. That is not the same as interpolating dB. The analog path is what makes the gain look continuous.",
    equation: "v_lin = (1−α) v_A + α v_B     v_dB = x · 10^{((1−α)A + αB)/20}",
  },
  {
    id: "output",
    title: "8. Output",
    trace: "output",
    summary:
      "Makeup gain restores loudness after reduction. Compare the interpolated output to an ideal continuously-variable VCA to see residual error, glitches, and distortion.",
    equation: "y = v_mix · 10^{G_makeup / 20}     y_ideal = x · 10^{(−GR + G_makeup)/20}",
  },
] as const;
