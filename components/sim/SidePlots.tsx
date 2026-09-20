"use client";

import { useEffect, useRef } from "react";
import {
  compressorOutputDb,
  crossfadeGains,
  dbToLin,
  formatDb,
  formatHz,
  lawCurve,
  linToDb,
  type SimParams,
  type SimResult,
  type StageReadout,
} from "@/lib/dsp";

function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[]
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const render = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth || 280;
      const h = wrap.clientHeight || 180;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w, h);
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, wrapRef };
}

export function TransferPlot({
  params,
  readout,
}: {
  params: SimParams;
  readout: StageReadout;
}) {
  const { ref, wrapRef } = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, w, h);
      const pad = { l: 36, r: 8, t: 10, b: 22 };
      const pw = w - pad.l - pad.r;
      const ph = h - pad.t - pad.b;
      const xMin = -60;
      const xMax = 0;
      const yMin = -60;
      const yMax = 12;
      const xOf = (db: number) => pad.l + ((db - xMin) / (xMax - xMin)) * pw;
      const yOf = (db: number) => pad.t + ((yMax - db) / (yMax - yMin)) * ph;

      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      for (let db = -60; db <= 0; db += 12) {
        ctx.beginPath();
        ctx.moveTo(xOf(db), pad.t);
        ctx.lineTo(xOf(db), pad.t + ph);
        ctx.stroke();
        ctx.fillText(`${db}`, xOf(db) + 2, h - 8);
      }
      for (let db = -60; db <= 12; db += 12) {
        ctx.beginPath();
        ctx.moveTo(pad.l, yOf(db));
        ctx.lineTo(pad.l + pw, yOf(db));
        ctx.stroke();
        ctx.fillText(`${db}`, 4, yOf(db) + 3);
      }

      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xOf(xMin), yOf(xMin));
      ctx.lineTo(xOf(0), yOf(0));
      ctx.stroke();
      ctx.setLineDash([]);

      const thr = params.compressor.thresholdDb;
      ctx.strokeStyle = "#f87171aa";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xOf(thr), pad.t);
      ctx.lineTo(xOf(thr), pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = "#a3e635";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const xin = xMin + (i / 120) * (xMax - xMin);
        const yout = compressorOutputDb(xin, params.compressor);
        const x = xOf(xin);
        const y = yOf(yout);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const xin = readout.envelopeDb;
      const yout = compressorOutputDb(xin, params.compressor);
      ctx.fillStyle = "#e879f9";
      ctx.beginPath();
      ctx.arc(xOf(xin), yOf(yout), 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(226,232,240,0.75)";
      ctx.font = "10px ui-sans-serif, sans-serif";
      ctx.fillText("Input dB → output dB", pad.l, 12);
    },
    [params, readout]
  );

  return (
    <div className="flex h-[200px] flex-col">
      <div ref={wrapRef} className="min-h-0 flex-1">
        <canvas ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}

export function CrossfadeLawPlot({
  aDb,
  bDb,
  alpha,
  law,
}: {
  aDb: number;
  bDb: number;
  alpha: number;
  law: SimParams["attenuator"]["law"];
}) {
  const curve = lawCurve(aDb, bDb, 97);
  const now = crossfadeGains(aDb, bDb, alpha);
  const { ref, wrapRef } = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, w, h);
      const pad = { l: 42, r: 8, t: 14, b: 22 };
      const pw = w - pad.l - pad.r;
      const ph = h - pad.t - pad.b;
      const yMin = Math.min(aDb, bDb) - 0.4;
      const yMax = Math.max(aDb, bDb) + 0.25;
      const xOf = (a: number) => pad.l + a * pw;
      const yOf = (db: number) => pad.t + ((yMax - db) / (yMax - yMin)) * ph;

      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      ctx.font = "9px ui-monospace, monospace";
      for (let p = 0; p <= 4; p++) {
        const a = p / 4;
        ctx.beginPath();
        ctx.moveTo(xOf(a), pad.t);
        ctx.lineTo(xOf(a), pad.t + ph);
        ctx.stroke();
        ctx.fillText(`${p * 25}%`, xOf(a) + 1, h - 8);
      }

      ctx.strokeStyle = "#f5d0fe";
      ctx.lineWidth = law === "linear-amplitude" ? 2.2 : 1.2;
      ctx.beginPath();
      curve.forEach((c, i) => {
        const x = xOf(c.alpha);
        const y = yOf(c.linearAmpDb);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = law === "linear-db" ? 2.2 : 1.2;
      ctx.beginPath();
      curve.forEach((c, i) => {
        const x = xOf(c.alpha);
        const y = yOf(c.linearDbDb);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.strokeStyle = "rgba(250,250,210,0.8)";
      ctx.beginPath();
      ctx.moveTo(xOf(alpha), pad.t);
      ctx.lineTo(xOf(alpha), pad.t + ph);
      ctx.stroke();
      ctx.fillStyle = "#f5d0fe";
      ctx.beginPath();
      ctx.arc(xOf(alpha), yOf(now.linearAmpDb), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#67e8f9";
      ctx.beginPath();
      ctx.arc(xOf(alpha), yOf(now.linearDbDb), 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "10px ui-sans-serif, sans-serif";
      ctx.fillStyle = "#f5d0fe";
      ctx.fillText("lin-amp", pad.l, 12);
      ctx.fillStyle = "#67e8f9";
      ctx.fillText("lin-dB", pad.l + 58, 12);
    },
    [aDb, bDb, alpha, law, curve, now]
  );

  const mid = crossfadeGains(aDb, bDb, 0.5);

  return (
    <div className="flex h-[200px] flex-col gap-1">
      <div ref={wrapRef} className="min-h-0 flex-1">
        <canvas ref={ref} className="h-full w-full" />
      </div>
      <p className="px-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
        A {formatDb(aDb, 2)} · B {formatDb(bDb, 2)} · mix {(alpha * 100).toFixed(1)}% → lin-amp{" "}
        <span className="text-[#f5d0fe]">{formatDb(now.linearAmpDb, 3)}</span>
        {" · "}lin-dB <span className="text-[#67e8f9]">{formatDb(now.linearDbDb, 3)}</span>
        {" · "}50% lin-amp is {formatDb(mid.linearAmpDb, 3)}, not {formatDb((aDb + bDb) / 2, 3)}
      </p>
    </div>
  );
}

export function SpectrumPlot({
  result,
  showIdeal,
}: {
  result: SimResult;
  showIdeal: boolean;
}) {
  const { ref, wrapRef } = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, w, h);
      const pad = { l: 36, r: 8, t: 14, b: 22 };
      const pw = w - pad.l - pad.r;
      const ph = h - pad.t - pad.b;
      const spec = result.spectrumOut;
      const fMax = 8000;
      const yMin = -96;
      const yMax = 6;
      const xOf = (f: number) => pad.l + (f / fMax) * pw;
      const yOf = (db: number) => pad.t + ((yMax - db) / (yMax - yMin)) * ph;

      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      ctx.font = "9px ui-monospace, monospace";
      for (const f of [0, 1000, 2000, 4000, 8000]) {
        ctx.beginPath();
        ctx.moveTo(xOf(f), pad.t);
        ctx.lineTo(xOf(f), pad.t + ph);
        ctx.stroke();
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : "0", xOf(f) + 2, h - 8);
      }

      const drawSpec = (s: typeof spec, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < s.freqs.length; i++) {
          const f = s.freqs[i];
          if (f > fMax) break;
          const x = xOf(f);
          const y = yOf(s.magDb[i]);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      if (showIdeal) drawSpec(result.spectrumIdeal, "rgba(148,163,184,0.55)", 1);
      drawSpec(spec, "#a3e635", 1.4);

      ctx.font = "9px ui-sans-serif, sans-serif";
      for (const peak of spec.peaks.slice(0, 5)) {
        if (peak.freq > fMax) continue;
        ctx.fillStyle = peak.harmonic === 1 ? "#7dd3fc" : "#fde047";
        ctx.fillText(
          peak.harmonic ? `H${peak.harmonic}` : formatHz(peak.freq),
          xOf(peak.freq) + 2,
          Math.max(pad.t + 10, yOf(peak.magDb) - 4)
        );
      }
      ctx.fillStyle = "rgba(226,232,240,0.75)";
      ctx.font = "10px ui-sans-serif, sans-serif";
      ctx.fillText("Spectrum (Hann)", pad.l, 12);
    },
    [result, showIdeal]
  );

  const thd = result.thd;

  return (
    <div className="flex h-[200px] flex-col">
      <div ref={wrapRef} className="min-h-0 flex-1">
        <canvas ref={ref} className="h-full w-full" />
      </div>
      <p className="px-1 font-mono text-[10px] text-muted-foreground">
        {thd.thdPercent != null
          ? `THD ${thd.thdPercent.toFixed(3)}%  (${thd.thdDb?.toFixed(1)} dB)  ·  H1 ${thd.fundamentalDb?.toFixed(1)} dB`
          : thd.note}
      </p>
    </div>
  );
}

export function GainReductionPlot({
  result,
  viewStart,
  viewEnd,
  cursorTime,
}: {
  result: SimResult;
  viewStart: number;
  viewEnd: number;
  cursorTime: number;
}) {
  const { ref, wrapRef } = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, w, h);
      const pad = { l: 36, r: 8, t: 14, b: 18 };
      const pw = w - pad.l - pad.r;
      const ph = h - pad.t - pad.b;
      const t0 = viewStart;
      const t1 = Math.max(viewStart + 0.001, viewEnd);
      const yMin = -Math.max(6, Math.abs(minInView(result.desiredGrDb, result, t0, t1)) + 1);
      const yMax = 1;
      const xOf = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * pw;
      const yOf = (db: number) => pad.t + ((yMax - db) / (yMax - yMin)) * ph;

      ctx.strokeStyle = "rgba(148,163,184,0.15)";
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      ctx.font = "9px ui-monospace, monospace";
      for (let db = 0; db >= yMin; db -= 3) {
        ctx.beginPath();
        ctx.moveTo(pad.l, yOf(db));
        ctx.lineTo(pad.l + pw, yOf(db));
        ctx.stroke();
        ctx.fillText(`${db}`, 4, yOf(db) + 3);
      }

      const i0 = Math.max(0, Math.floor(t0 * result.sampleRate));
      const i1 = Math.min(result.n, Math.ceil(t1 * result.sampleRate));
      ctx.beginPath();
      ctx.moveTo(xOf(t0), yOf(0));
      for (let i = i0; i < i1; i++) {
        const t = i / result.sampleRate;
        ctx.lineTo(xOf(t), yOf(result.desiredGrDb[i]));
      }
      ctx.lineTo(xOf(t1), yOf(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(232,121,249,0.2)";
      ctx.fill();

      ctx.strokeStyle = "#e879f9";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = i0; i < i1; i++) {
        const t = i / result.sampleRate;
        const x = xOf(t);
        const y = yOf(result.desiredGrDb[i]);
        if (i === i0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = "#a3e635";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = i0; i < i1; i++) {
        const t = i / result.sampleRate;
        const x = xOf(t);
        const y = yOf(result.actualGainDb[i]);
        if (i === i0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = "rgba(250,250,210,0.8)";
      ctx.beginPath();
      ctx.moveTo(xOf(cursorTime), pad.t);
      ctx.lineTo(xOf(cursorTime), pad.t + ph);
      ctx.stroke();

      ctx.fillStyle = "rgba(226,232,240,0.75)";
      ctx.font = "10px ui-sans-serif, sans-serif";
      ctx.fillText("Gain reduction vs time", pad.l, 12);
    },
    [result, viewStart, viewEnd, cursorTime]
  );

  return (
    <div className="flex h-[200px] flex-col">
      <div ref={wrapRef} className="min-h-0 flex-1">
        <canvas ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}

function minInView(arr: Float32Array, result: SimResult, t0: number, t1: number) {
  const i0 = Math.max(0, Math.floor(t0 * result.sampleRate));
  const i1 = Math.min(arr.length, Math.ceil(t1 * result.sampleRate));
  let m = 0;
  for (let i = i0; i < i1; i++) m = Math.min(m, arr[i]);
  return m;
}

export function liveAttenuation(readout: StageReadout, law: SimParams["attenuator"]["law"]) {
  return law === "linear-amplitude" ? readout.mixLinearDb : readout.mixDbLawDb;
}

export { dbToLin, linToDb, formatDb };
