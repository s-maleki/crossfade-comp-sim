"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDb,
  formatHz,
  formatMs,
  formatPct,
  formatRatio,
  type DriveMode,
  type Harmonics,
  type SimParams,
} from "@/lib/dsp";
import type { ReactNode } from "react";
import { EnvelopeSchematic } from "./Architecture";
import { LogSlider, ParamSlider } from "./ParamSlider";

const PAIR_PRESETS = [
  [-1, -2],
  [-5, -6],
  [-10, -11],
  [-20, -21],
  [-30, -31],
  [-40, -41],
] as const;

const GR_STEPS = [10, 10.2, 10.5, 10.8, 11, 11.2];

export function ControlPanel({
  params,
  envelopeV,
  inputV,
  onChange,
}: {
  params: SimParams;
  envelopeV: number;
  inputV: number;
  onChange: (patch: DeepPatch) => void;
}) {
  const s = params.signal;
  const e = params.envelope;
  const c = params.compressor;
  const a = params.attenuator;

  return (
    <Tabs defaultValue="signal" className="w-full">
      <TabsList variant="line" className="mb-3 w-full justify-start overflow-x-auto">
        <TabsTrigger value="signal">Signal</TabsTrigger>
        <TabsTrigger value="envelope">Envelope</TabsTrigger>
        <TabsTrigger value="comp">Comp</TabsTrigger>
        <TabsTrigger value="gain">Xfade</TabsTrigger>
      </TabsList>

      <TabsContent value="signal" className="space-y-3">
        <Field label="Test signal">
          <Select
            value={s.kind}
            onValueChange={(v) => onChange({ signal: { kind: v as SimParams["signal"]["kind"] } })}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="sine">Sine</SelectItem>
              <SelectItem value="guitar">Guitar-like</SelectItem>
              <SelectItem value="multi">Multiple frequencies</SelectItem>
              <SelectItem value="transient">Short transient</SelectItem>
              <SelectItem value="repeating">Repeating transient</SelectItem>
              <SelectItem value="am">Slowly varying amplitude</SelectItem>
              <SelectItem value="custom">User-adjustable harmonics</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <LogSlider
          label="Frequency"
          value={s.frequency}
          min={40}
          max={2000}
          format={formatHz}
          onChange={(frequency) => onChange({ signal: { frequency } })}
        />
        <ParamSlider
          label="Amplitude (1.0 = 0 dBFS peak)"
          value={s.amplitude}
          min={0.02}
          max={1.4}
          step={0.01}
          format={(v) => `${v.toFixed(2)}  (${formatDb(20 * Math.log10(Math.max(v, 1e-9)), 1)} peak)`}
          onChange={(amplitude) => onChange({ signal: { amplitude } })}
        />
        <ParamSlider
          label="DC offset"
          value={s.dcOffset}
          min={-0.5}
          max={0.5}
          step={0.005}
          format={(v) => v.toFixed(3)}
          onChange={(dcOffset) => onChange({ signal: { dcOffset } })}
        />
        <ParamSlider
          label="Signal duration"
          value={s.duration}
          min={0.06}
          max={2}
          step={0.01}
          format={(v) => `${v.toFixed(2)} s`}
          onChange={(duration) => onChange({ signal: { duration } })}
        />
        <ParamSlider
          label="Burst duration"
          value={s.burstDuration}
          min={0.001}
          max={0.12}
          step={0.001}
          format={formatMsFromSec}
          onChange={(burstDuration) => onChange({ signal: { burstDuration } })}
        />
        <ParamSlider
          label="Repetition rate"
          value={s.repetitionHz}
          min={0.5}
          max={20}
          step={0.1}
          format={(v) => `${v.toFixed(1)} Hz`}
          onChange={(repetitionHz) => onChange({ signal: { repetitionHz } })}
        />
        <ParamSlider
          label="Decay (guitar / custom)"
          value={s.decayMs}
          min={20}
          max={800}
          step={1}
          format={formatMs}
          onChange={(decayMs) => onChange({ signal: { decayMs } })}
        />
        <ParamSlider
          label="AM rate"
          value={s.amHz}
          min={0.5}
          max={12}
          step={0.1}
          format={(v) => `${v.toFixed(1)} Hz`}
          onChange={(amHz) => onChange({ signal: { amHz } })}
        />
        <div className="rounded-lg bg-black/20 p-2 ring-1 ring-white/5">
          <div className="mb-2 text-[11px] text-muted-foreground">
            Harmonic mix (guitar / custom) — combine sines at f, 2f … 5f
          </div>
          {s.harmonics.map((h, i) => (
            <ParamSlider
              key={i}
              label={`H${i + 1}  (${i + 1}×f)`}
              value={h}
              min={0}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => {
                const harmonics = [...s.harmonics] as Harmonics;
                harmonics[i] = v;
                onChange({ signal: { harmonics } });
              }}
            />
          ))}
          <ParamSlider
            label="Inharmonicity"
            value={s.inharmonicity}
            min={0}
            max={0.002}
            step={0.00005}
            format={(v) => v.toFixed(5)}
            onChange={(inharmonicity) => onChange({ signal: { inharmonicity } })}
          />
          <ParamSlider
            label="Noise"
            value={s.noise}
            min={0}
            max={0.08}
            step={0.001}
            format={(v) => v.toFixed(3)}
            onChange={(noise) => onChange({ signal: { noise } })}
          />
        </div>
      </TabsContent>

      <TabsContent value="envelope" className="space-y-3">
        <EnvelopeSchematic
          rectifier={e.rectifier}
          envelope={envelopeV}
          input={inputV}
          capacitor={e.capacitor}
        />
        <Field label="Rectifier">
          <Select
            value={e.rectifier}
            onValueChange={(v) =>
              onChange({ envelope: { rectifier: v as SimParams["envelope"]["rectifier"] } })
            }
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="full">Full-wave |x|</SelectItem>
              <SelectItem value="half">Half-wave max(x, 0)</SelectItem>
              <SelectItem value="square-law">Square-law → √RMS</SelectItem>
              <SelectItem value="ideal-peak">Ideal peak |x|</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <LogSlider
          label="Attack"
          value={e.attackMs}
          min={0.1}
          max={100}
          format={formatMs}
          onChange={(attackMs) => onChange({ envelope: { attackMs } })}
        />
        <div className="flex flex-wrap gap-1">
          {[0.1, 1, 10, 30, 100].map((ms) => (
            <Button
              key={ms}
              size="xs"
              variant={approx(e.attackMs, ms) ? "default" : "outline"}
              onClick={() => onChange({ envelope: { attackMs: ms } })}
            >
              {ms} ms
            </Button>
          ))}
        </div>
        <LogSlider
          label="Release"
          value={e.releaseMs}
          min={10}
          max={2000}
          format={formatMs}
          onChange={(releaseMs) => onChange({ envelope: { releaseMs } })}
        />
        <div className="flex flex-wrap gap-1">
          {[10, 50, 100, 300, 1000, 2000].map((ms) => (
            <Button
              key={ms}
              size="xs"
              variant={approx(e.releaseMs, ms) ? "default" : "outline"}
              onClick={() => onChange({ envelope: { releaseMs: ms } })}
            >
              {ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`}
            </Button>
          ))}
        </div>
        <ParamSlider
          label="Envelope capacitor (scales τA and τR)"
          value={e.capacitor}
          min={0.25}
          max={4}
          step={0.05}
          format={(v) => `×${v.toFixed(2)}`}
          onChange={(capacitor) => onChange({ envelope: { capacitor } })}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          τ_A = attack × C, τ_R = release × C. Orange strip = charging (attack), teal = discharging
          (release). Threshold is the red dashed line on the ENV lane.
        </p>
      </TabsContent>

      <TabsContent value="comp" className="space-y-3">
        <ParamSlider
          label="Threshold"
          value={c.thresholdDb}
          min={-48}
          max={0}
          step={0.1}
          format={(v) => formatDb(v, 1)}
          onChange={(thresholdDb) => onChange({ compressor: { thresholdDb } })}
        />
        <ParamSlider
          label="Ratio"
          value={c.ratio}
          min={1}
          max={20}
          step={0.1}
          format={formatRatio}
          onChange={(ratio) => onChange({ compressor: { ratio } })}
        />
        <div className="flex flex-wrap gap-1">
          {[2, 4, 8, 20].map((ratio) => (
            <Button
              key={ratio}
              size="xs"
              variant={approx(c.ratio, ratio) ? "default" : "outline"}
              onClick={() => onChange({ compressor: { ratio } })}
            >
              {ratio === 20 ? "∞:1" : `${ratio}:1`}
            </Button>
          ))}
        </div>
        <ParamSlider
          label="Soft knee"
          value={c.kneeDb}
          min={0}
          max={12}
          step={0.1}
          format={(v) => `${v.toFixed(1)} dB`}
          onChange={(kneeDb) => onChange({ compressor: { kneeDb } })}
        />
        <ParamSlider
          label="Maximum gain reduction"
          value={c.maxGrDb}
          min={1}
          max={40}
          step={0.5}
          format={(v) => `${v.toFixed(1)} dB`}
          onChange={(maxGrDb) => onChange({ compressor: { maxGrDb } })}
        />
        <ParamSlider
          label="Makeup gain"
          value={c.makeupDb}
          min={-6}
          max={24}
          step={0.1}
          format={(v) => formatDb(v, 1)}
          onChange={(makeupDb) => onChange({ compressor: { makeupDb } })}
        />
      </TabsContent>

      <TabsContent value="gain" className="space-y-3">
        <Field label="What drives the gain element">
          <Select
            value={params.drive}
            onValueChange={(v) => onChange({ drive: v as DriveMode })}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="compressor">Auto — envelope compressor</SelectItem>
              <SelectItem value="manual-gr">Manual gain reduction</SelectItem>
              <SelectItem value="gr-sweep">GR sweep (1 dB walk)</SelectItem>
              <SelectItem value="manual-mix">Manual A / B / mix</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="flex flex-wrap gap-1">
          {PAIR_PRESETS.map(([aDb, bDb]) => (
            <Button
              key={aDb}
              size="xs"
              variant={
                params.manualADb === aDb && params.manualBDb === bDb ? "default" : "outline"
              }
              onClick={() =>
                onChange({
                  drive: "manual-mix",
                  manualADb: aDb,
                  manualBDb: bDb,
                })
              }
            >
              {aDb} / {bDb} dB
            </Button>
          ))}
        </div>

        <ParamSlider
          label="Channel A attenuation"
          value={-params.manualADb}
          min={0}
          max={48}
          step={params.attenuator.stepDb}
          format={(v) => formatDb(-v, 1)}
          onChange={(v) =>
            onChange({
              manualADb: -v,
              manualBDb: -v - a.stepDb,
            })
          }
          disabled={params.drive !== "manual-mix"}
        />
        <ParamSlider
          label="Channel B attenuation"
          value={-params.manualBDb}
          min={0}
          max={49}
          step={params.attenuator.stepDb}
          format={(v) => formatDb(-v, 1)}
          onChange={(v) => onChange({ manualBDb: -v })}
          disabled={params.drive !== "manual-mix"}
        />
        <ParamSlider
          label="Mix A ↔ B"
          value={params.manualMix}
          min={0}
          max={1}
          step={0.001}
          format={(v) => `${formatPct(v)} B`}
          onChange={(manualMix) => onChange({ drive: "manual-mix", manualMix })}
        />

        <Field label="Crossfade law">
          <Select
            value={a.law}
            onValueChange={(v) =>
              onChange({ attenuator: { law: v as SimParams["attenuator"]["law"] } })
            }
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="linear-amplitude">Mode A — linear amplitude</SelectItem>
              <SelectItem value="linear-db">Mode B — linear-in-dB</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <ParamSlider
          label="Digital step size"
          value={a.stepDb}
          min={0.5}
          max={6}
          step={0.5}
          format={(v) => `${v.toFixed(1)} dB`}
          onChange={(stepDb) => onChange({ attenuator: { stepDb } })}
        />

        <div className="rounded-lg bg-black/20 p-2 ring-1 ring-white/5">
          <div className="mb-2 text-[11px] text-muted-foreground">
            Walk desired GR through 1 dB (sets GR-sweep / manual GR)
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {GR_STEPS.map((g) => (
              <Button
                key={g}
                size="xs"
                variant={approx(params.manualGrDb, g) ? "default" : "outline"}
                onClick={() => onChange({ drive: "manual-gr", manualGrDb: g })}
              >
                −{g.toFixed(1)} dB
              </Button>
            ))}
          </div>
          <ParamSlider
            label="Manual GR"
            value={params.manualGrDb}
            min={0}
            max={c.maxGrDb}
            step={0.05}
            format={(v) => formatDb(-v, 2)}
            onChange={(manualGrDb) => onChange({ drive: "manual-gr", manualGrDb })}
          />
          <ParamSlider
            label="Sweep start (positive GR)"
            value={params.grSweepStart}
            min={0}
            max={24}
            step={0.1}
            format={(v) => formatDb(-v, 1)}
            onChange={(grSweepStart) => onChange({ grSweepStart })}
          />
          <ParamSlider
            label="Sweep end"
            value={params.grSweepEnd}
            min={0}
            max={24}
            step={0.1}
            format={(v) => formatDb(-v, 1)}
            onChange={(grSweepEnd) => onChange({ grSweepEnd })}
          />
        </div>

        <Field label="Pair update (glitch experiment)">
          <Select
            value={a.pairUpdate}
            onValueChange={(v) =>
              onChange({
                attenuator: { pairUpdate: v as SimParams["attenuator"]["pairUpdate"] },
              })
            }
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="atomic">Atomic wrap (continuous)</SelectItem>
              <SelectItem value="stagger-b-first">B updates first (1 dB hole)</SelectItem>
              <SelectItem value="stagger-alpha-first">α wraps before codes</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <LogSlider
          label="Transition stagger (slow-mo wrap)"
          value={Math.max(0.1, a.staggerMs)}
          min={0.1}
          max={40}
          format={formatMs}
          onChange={(staggerMs) => onChange({ attenuator: { staggerMs } })}
        />
        <ParamSlider
          label="Analog crossfader nonlinearity"
          value={a.nonlinearity}
          min={0}
          max={0.35}
          step={0.005}
          format={(v) => v.toFixed(3)}
          onChange={(nonlinearity) => onChange({ attenuator: { nonlinearity } })}
        />
        <ParamSlider
          label="Switching glitch on code change"
          value={a.switchingGlitch}
          min={0}
          max={0.12}
          step={0.002}
          format={(v) => v.toFixed(3)}
          onChange={(switchingGlitch) => onChange({ attenuator: { switchingGlitch } })}
        />
        <Badge variant="outline" className="font-normal">
          Digital IC = discrete steps. Analog crossfader = continuous α between them.
        </Badge>
      </TabsContent>
    </Tabs>
  );
}

export type DeepPatch = {
  drive?: DriveMode;
  manualGrDb?: number;
  manualADb?: number;
  manualBDb?: number;
  manualMix?: number;
  grSweepStart?: number;
  grSweepEnd?: number;
  distortionGain?: number;
  signal?: Partial<SimParams["signal"]>;
  envelope?: Partial<SimParams["envelope"]>;
  compressor?: Partial<SimParams["compressor"]>;
  attenuator?: Partial<SimParams["attenuator"]>;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function approx(a: number, b: number) {
  return Math.abs(a - b) < 1e-6 || Math.abs(a - b) / Math.max(Math.abs(b), 1e-9) < 0.02;
}

function formatMsFromSec(s: number) {
  return formatMs(s * 1000);
}
