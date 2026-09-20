# Analog-interpolated digital compressor

Interactive, equation-based simulation of a compressor whose gain element is **not** a continuous VCA.

The architecture under test:

```
Audio ──┬── digital attenuator A ──┐
        │                          ├── analog crossfader ── makeup ── output
        └── digital attenuator B ──┘
        │
        └── rectifier ── attack/release ── compressor curve ── (A, B, α)
```

The digital IC only offers discrete attenuation (typically 1 dB steps). Two adjacent codes, Channel A and Channel B, are mixed with an analog crossfader so the effective gain can sit *between* those codes. This app recalculates every sample when you change a control so you can see whether that interpolation behaves like a continuous compressor gain element.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43173](http://127.0.0.1:43173).

## What is calculated

- **Input** — sine, guitar-like harmonic series, multi-tone, transients, repeating bursts, slow AM, or a custom mix of five harmonics.
- **Rectifier** — half-wave, full-wave, square-law RMS, or ideal peak.
- **Envelope** — independent attack and release: `y += (r − y) (1 − e^{−Δt/τ})`, with τ scaled by the capacitor control.
- **Compressor** — threshold, ratio, soft knee, max GR, makeup. Transfer: `GR = (L − T)(1 − 1/R)` above the knee.
- **Digital pair** — `A = Δ·ceil(g/Δ)`, `B = A − Δ`, `α = (A − g)/Δ`.
- **Crossfade laws**
  - Mode A, linear amplitude: `v = (1−α)vA + α vB` → attenuation `20 log10((1−α)10^{A/20} + α 10^{B/20})`. A 50% mix of −10 dB and −11 dB is **not** −10.5 dB.
  - Mode B, linear-in-dB: `g = (1−α)A + α B`.
- **Pair wrap** — when desired GR crosses an integer, A/B jump to the next pair and α wraps 1 → 0. Atomic wrap is continuous; staggered B-first or α-first updates produce a visible 1 dB hole, which the sim **highlights**.
- **Spectrum / THD** — Hann-windowed DFT of the output vs an ideal continuous VCA. Distortion ×10 exaggerates `ideal + k(actual − ideal)` without changing the real output.

## Reading the scope

Every lane shares the same time axis. Wheel zooms around the cursor, drag pans, double-click resets, click sets the inspection time used by the control-path readouts. Orange/teal at the bottom of the ENV lane is attack vs release. Red dashed line is threshold. Red vertical bands are gain discontinuities.

Presets on the header jump to the experiments this architecture is meant to answer: attack delay, release tail, 1 dB interpolation, pair transition, and a deliberate wrap glitch.
