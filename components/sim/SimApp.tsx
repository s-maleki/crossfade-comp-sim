"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play, RotateCcw, SkipForward, StepForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  applyPreset,
  DEFAULT_PARAMS,
  EDU_STAGES,
  formatDb,
  formatMs,
  PRESETS,
  readoutAt,
  simulate,
  type SimParams,
} from "@/lib/dsp";
import { ArchitectureBanner } from "./Architecture";
import { ControlChain } from "./ControlChain";
import { ControlPanel, type DeepPatch } from "./ControlPanel";
import { EducationalPanel } from "./Educational";
import { Oscilloscope, TraceToggles } from "./Oscilloscope";
import { LogSlider, ParamSlider } from "./ParamSlider";
import {
  CrossfadeLawPlot,
  GainReductionPlot,
  SpectrumPlot,
  TransferPlot,
} from "./SidePlots";
import { DEFAULT_VISIBLE, type TraceId } from "./traces";

function applyDeep(p: SimParams, patch: DeepPatch): SimParams {
  return {
    ...p,
    ...patch,
    signal: { ...p.signal, ...patch.signal },
    envelope: { ...p.envelope, ...patch.envelope },
    compressor: { ...p.compressor, ...patch.compressor },
    attenuator: { ...p.attenuator, ...patch.attenuator },
  };
}

export function SimApp() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(DEFAULT_PARAMS.signal.duration);
  const [cursorTime, setCursorTime] = useState(0.05);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);
  const [educational, setEducational] = useState(false);
  const [eduStage, setEduStage] = useState(0);
  const [showExaggerated, setShowExaggerated] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>(DEFAULT_VISIBLE);
  const [presetId, setPresetId] = useState<string>("transients");

  const result = useMemo(() => simulate(params), [params]);

  const duration = result.duration;
  const t0 = Math.min(viewStart, Math.max(0, duration - 0.002));
  const t1 = Math.max(t0 + 0.001, Math.min(viewEnd, duration));
  const cursor = Math.min(Math.max(0, cursorTime), duration);

  const readout = useMemo(
    () => readoutAt(result, params, cursor),
    [result, params, cursor]
  );

  const viewRef = useRef({ start: t0, end: t1, follow, duration, speed });
  useEffect(() => {
    viewRef.current = { start: t0, end: t1, follow, duration, speed };
  }, [t0, t1, follow, duration, speed]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const v = viewRef.current;
      setCursorTime((t) => {
        let n = t + dt * v.speed;
        if (n > v.duration) n -= v.duration;
        if (n < 0) n = 0;
        if (v.follow && (n < v.start || n > v.end)) {
          const span = v.end - v.start;
          const start = Math.max(0, n - span * 0.25);
          setViewStart(start);
          setViewEnd(Math.min(v.duration, start + span));
        }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  function patch(p: DeepPatch) {
    setParams((prev) => applyDeep(prev, p));
    if (p.signal?.duration != null) {
      setViewStart(0);
      setViewEnd(p.signal.duration);
    }
  }

  function loadPreset(id: string) {
    const preset = PRESETS.find((x) => x.id === id);
    if (!preset) return;
    setPresetId(id);
    const next = applyPreset(params, preset);
    setParams(next);
    setViewStart(0);
    setViewEnd(next.signal.duration);
    setCursorTime(Math.min(0.04, next.signal.duration * 0.2));
  }

  const highlight = educational ? EDU_STAGES[eduStage]?.trace : null;
  const lawLabel =
    params.attenuator.law === "linear-amplitude" ? "linear amplitude" : "linear-in-dB";

  const glitchCount = result.markers.filter((m) => m.kind === "glitch").length;

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-white/10 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium tracking-tight">
              Analog-interpolated digital compressor
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Two adjacent digitally controlled attenuation levels, continuously interpolated by an
              analog crossfader — every trace is the actual sample at that node.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              GR {formatDb(readout.desiredGrDb, 2)}
            </Badge>
            <Badge variant="outline" className="font-mono" style={{ color: "#60a5fa" }}>
              A {formatDb(readout.attADb, 1)}
            </Badge>
            <Badge variant="outline" className="font-mono" style={{ color: "#4ade80" }}>
              B {formatDb(readout.attBDb, 1)}
            </Badge>
            <Badge variant="outline" className="font-mono" style={{ color: "#c4b5fd" }}>
              mix {(readout.alpha * 100).toFixed(1)}%
            </Badge>
            <Badge variant="outline" className="font-mono" style={{ color: "#a3e635" }}>
              actual {formatDb(readout.actualGainDb, 2)}
            </Badge>
            {glitchCount > 0 ? (
              <Badge variant="destructive">{glitchCount} discontinuities</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={presetId} onValueChange={loadPreset}>
            <SelectTrigger size="sm" className="w-[220px]">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent position="popper">
              {PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {PRESETS.find((p) => p.id === presetId)?.blurb}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={playing ? "secondary" : "default"}
              onClick={() => setPlaying((v) => !v)}
            >
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() =>
                setCursorTime((t) => Math.min(duration, t + 1 / result.sampleRate))
              }
              title="Advance one sample"
            >
              <StepForward />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setCursorTime((t) => Math.min(duration, t + 0.001))}
              title="Advance 1 ms"
            >
              <SkipForward />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => {
                setViewStart(0);
                setViewEnd(duration);
                setCursorTime(Math.min(0.04, duration * 0.2));
              }}
            >
              <RotateCcw />
            </Button>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1 ring-1 ring-white/10">
              <Switch
                size="sm"
                checked={showExaggerated}
                onCheckedChange={setShowExaggerated}
                id="dist10"
              />
              <Label htmlFor="dist10" className="text-xs font-normal">
                Distortion ×{params.distortionGain}
              </Label>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1 ring-1 ring-white/10">
              <Switch
                size="sm"
                checked={educational}
                onCheckedChange={(v) => {
                  setEducational(v);
                  if (v) setPlaying(false);
                }}
                id="edu"
              />
              <Label htmlFor="edu" className="text-xs font-normal">
                Step through
              </Label>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-4">
        <div className="space-y-3">
          <ArchitectureBanner />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TraceToggles
              visible={visible}
              onToggle={(id: TraceId) =>
                setVisible((v) => ({ ...v, [id]: v[id] === false ? true : false }))
              }
            />
            <div className="font-mono text-[11px] text-muted-foreground">
              t = {formatMs(cursor * 1000)} / {formatMs(duration * 1000)} · {result.sampleRate / 1000} kHz
            </div>
          </div>
          <Oscilloscope
            result={result}
            params={params}
            viewStart={t0}
            viewEnd={t1}
            cursorTime={cursor}
            visible={visible}
            showExaggerated={showExaggerated}
            highlightTrace={highlight}
            onViewChange={(a, b) => {
              setViewStart(a);
              setViewEnd(b);
            }}
            onCursor={setCursorTime}
          />
          {educational ? (
            <EducationalPanel stage={eduStage} readout={readout} onStage={setEduStage} />
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PlotCard title="Transfer characteristic">
              <TransferPlot params={params} readout={readout} />
            </PlotCard>
            <PlotCard title="Crossfade law">
              <CrossfadeLawPlot
                aDb={readout.attADb}
                bDb={readout.attBDb}
                alpha={readout.alpha}
                law={params.attenuator.law}
              />
            </PlotCard>
            <PlotCard title="Spectrum">
              <SpectrumPlot result={result} showIdeal />
            </PlotCard>
            <PlotCard title="Gain reduction">
              <GainReductionPlot
                result={result}
                viewStart={t0}
                viewEnd={t1}
                cursorTime={cursor}
              />
            </PlotCard>
          </div>
        </div>

        <aside className="space-y-3">
          <ControlChain
            readout={readout}
            lawLabel={lawLabel}
          />
          <div className="rounded-xl bg-[#071018] p-3 ring-1 ring-white/10">
            <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Transport
            </div>
            <LogSlider
              label="Simulation speed"
              value={speed}
              min={0.02}
              max={4}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={setSpeed}
            />
            <div className="mt-2 flex items-center justify-between">
              <Label htmlFor="follow" className="text-[11px] font-normal text-muted-foreground">
                Follow playhead
              </Label>
              <Switch id="follow" size="sm" checked={follow} onCheckedChange={setFollow} />
            </div>
            <ParamSlider
              label="Time window"
              value={t1 - t0}
              min={0.002}
              max={duration}
              step={0.001}
              format={(v) => formatMs(v * 1000)}
              onChange={(span) => {
                const mid = (t0 + t1) / 2;
                let a = mid - span / 2;
                let b = mid + span / 2;
                if (a < 0) {
                  a = 0;
                  b = span;
                }
                if (b > duration) {
                  b = duration;
                  a = Math.max(0, b - span);
                }
                setViewStart(a);
                setViewEnd(b);
              }}
            />
          </div>
          <div className="rounded-xl bg-[#071018] p-3 ring-1 ring-white/10">
            <ControlPanel
              params={params}
              envelopeV={readout.envelope}
              inputV={readout.input}
              onChange={patch}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlotCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#071018] ring-1 ring-white/10">
      <div className="border-b border-white/5 px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}
