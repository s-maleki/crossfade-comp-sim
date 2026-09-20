"use client";

import { useEffect, useRef } from "react";
import type { SimParams, SimResult } from "@/lib/dsp";
import { dbToLin } from "@/lib/dsp";
import { formatLaneValue, LANES, laneYRange, type TraceId } from "./traces";

function formatTime(t: number): string {
  if (t < 1) return `${(t * 1000).toFixed(t < 0.01 ? 2 : 1)} ms`;
  return `${t.toFixed(3)} s`;
}

function sampleIndex(t: number, sr: number, n: number) {
  return Math.max(0, Math.min(n - 1, Math.round(t * sr)));
}

function strokeColumn(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  i0: number,
  i1: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  yMin: number,
  yMax: number,
  color: string,
  width = 1.25,
  negate = false
) {
  const n = Math.max(1, i1 - i0);
  const span = yMax - yMin || 1;
  const val = (i: number) => (negate ? -data[i] : data[i]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  if (n / w <= 1.2) {
    const count = i1 - i0;
    for (let i = 0; i <= count; i++) {
      const idx = Math.min(data.length - 1, i0 + i);
      const x = x0 + (i / Math.max(1, count)) * w;
      const y = y0 + ((yMax - val(idx)) / span) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    for (let px = 0; px < w; px++) {
      const a = i0 + Math.floor((px / w) * n);
      const b = i0 + Math.floor(((px + 1) / w) * n);
      let lo = Infinity;
      let hi = -Infinity;
      const aa = Math.max(0, a);
      const bb = Math.min(data.length, Math.max(aa + 1, b));
      for (let i = aa; i < bb; i++) {
        const v = val(i);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const x = x0 + px + 0.5;
      const yLo = y0 + ((yMax - hi) / span) * h;
      const yHi = y0 + ((yMax - lo) / span) * h;
      ctx.moveTo(x, yLo);
      ctx.lineTo(x, yHi);
    }
  }
  ctx.stroke();
}

export function Oscilloscope({
  result,
  params,
  viewStart,
  viewEnd,
  cursorTime,
  visible,
  showExaggerated,
  highlightTrace,
  onViewChange,
  onCursor,
}: {
  result: SimResult;
  params: SimParams;
  viewStart: number;
  viewEnd: number;
  cursorTime: number;
  visible: Record<string, boolean>;
  showExaggerated: boolean;
  highlightTrace?: string | null;
  onViewChange: (start: number, end: number) => void;
  onCursor: (t: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: "pan" | "cursor";
    x: number;
    start: number;
    end: number;
    moved: boolean;
  } | null>(null);

  const lanes = LANES.filter((l) => visible[l.id] !== false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = wrap.clientWidth || 800;
      const cssH = wrap.clientHeight || 520;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = cssW;
      const H = cssH;
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, W, H);

      const labelW = 70;
      const axisH = 22;
      const miniH = 30;
      const plotW = W - labelW - 10;
      const plotX = labelW;
      const stackH = H - axisH - miniH - 8;
      const laneH = lanes.length > 0 ? stackH / lanes.length : stackH;

      const t0 = viewStart;
      const t1 = Math.max(viewStart + 0.001, viewEnd);
      const sr = result.sampleRate;
      const i0 = sampleIndex(t0, sr, result.n);
      const i1 = Math.max(i0 + 1, sampleIndex(t1, sr, result.n) + 1);

      ctx.save();
      ctx.beginPath();
      ctx.rect(plotX, 0, plotW, stackH);
      ctx.clip();

      const glitchAlpha = 0.16;
      for (let i = i0; i < i1; i++) {
        if (result.glitchFlags[i]) {
          const x = plotX + ((i / sr - t0) / (t1 - t0)) * plotW;
          ctx.fillStyle = `rgba(248,113,113,${glitchAlpha})`;
          ctx.fillRect(x, 0, 2, stackH);
        }
      }

      for (const m of result.markers) {
        if (m.t < t0 || m.t > t1) continue;
        const x = plotX + ((m.t - t0) / (t1 - t0)) * plotW;
        ctx.strokeStyle = m.color + "99";
        ctx.lineWidth = 1;
        ctx.setLineDash(m.kind === "glitch" ? [3, 3] : [4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, stackH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      lanes.forEach((lane, li) => {
        const y = li * laneH;
          const dim =
          highlightTrace &&
          highlightTrace !== lane.id &&
          !(highlightTrace === "chA" && (lane.id === "chA" || lane.id === "chB"))
            ? 0.5
            : 1;
        ctx.globalAlpha = dim;
        ctx.fillStyle = li % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent";
        ctx.fillRect(0, y, W, laneH);

        ctx.strokeStyle = "rgba(148,163,184,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + laneH);
        ctx.lineTo(W, y + laneH);
        ctx.stroke();

        const { yMin, yMax } = laneYRange(lane, result, params, i0, i1);
        const innerH = laneH - 8;
        const innerY = y + 4;

        if (lane.scale === "audio" || lane.scale === "uni") {
          const zeroY = innerY + ((yMax - 0) / (yMax - yMin)) * innerH;
          ctx.strokeStyle = "rgba(148,163,184,0.18)";
          ctx.beginPath();
          ctx.moveTo(plotX, zeroY);
          ctx.lineTo(plotX + plotW, zeroY);
          ctx.stroke();
        }
        if (lane.scale === "gr") {
          const zeroY = innerY + ((yMax - 0) / (yMax - yMin)) * innerH;
          ctx.strokeStyle = "rgba(148,163,184,0.22)";
          ctx.beginPath();
          ctx.moveTo(plotX, zeroY);
          ctx.lineTo(plotX + plotW, zeroY);
          ctx.stroke();
        }

        if (lane.id === "envelope") {
          const atk = result.envAttack;
          for (let px = 0; px < plotW; px++) {
            const a = i0 + Math.floor((px / plotW) * (i1 - i0));
            const attacking = atk[Math.max(0, Math.min(atk.length - 1, a))] === 1;
            ctx.fillStyle = attacking
              ? "rgba(251,146,60,0.09)"
              : "rgba(45,212,191,0.08)";
            ctx.fillRect(plotX + px, innerY + innerH - 4, 1, 4);
          }
          const thr = dbToLin(params.compressor.thresholdDb);
          const span = yMax - yMin || 1;
          const ty = innerY + ((yMax - thr) / span) * innerH;
          ctx.strokeStyle = "#f87171";
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(plotX, ty);
          ctx.lineTo(plotX + plotW, ty);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#f87171";
          ctx.font = "10px ui-monospace, Geist Mono, monospace";
          ctx.fillText("THR", plotX + 4, Math.max(innerY + 10, ty - 3));
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(plotX, innerY, plotW, innerH);
        ctx.clip();

        const prim = lane.primary(result);
        const sec = lane.secondary?.(result);
        const ter = lane.tertiary?.(result, showExaggerated);

        if (sec) {
          strokeColumn(
            ctx,
            sec,
            i0,
            i1,
            plotX,
            innerY,
            plotW,
            innerH,
            yMin,
            yMax,
            lane.color2 ?? "#94a3b8",
            1.1
          );
        }
        if (ter) {
          strokeColumn(
            ctx,
            ter,
            i0,
            i1,
            plotX,
            innerY,
            plotW,
            innerH,
            yMin,
            yMax,
            lane.color3 ?? "#fb7185",
            1.1
          );
        }
        strokeColumn(
          ctx,
          prim,
          i0,
          i1,
          plotX,
          innerY,
          plotW,
          innerH,
          yMin,
          yMax,
          lane.color,
          1.35
        );
        if (lane.id === "input") {
          strokeColumn(
            ctx,
            result.envelope,
            i0,
            i1,
            plotX,
            innerY,
            plotW,
            innerH,
            yMin,
            yMax,
            "rgba(251,146,60,0.85)",
            1.15
          );
          strokeColumn(
            ctx,
            result.envelope,
            i0,
            i1,
            plotX,
            innerY,
            plotW,
            innerH,
            yMin,
            yMax,
            "rgba(251,146,60,0.85)",
            1.15,
            true
          );
        }
        ctx.restore();

        ctx.fillStyle = "rgba(7,16,24,0.92)";
        ctx.fillRect(0, y, labelW, laneH);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, labelW - 2, laneH);
        ctx.clip();
        ctx.fillStyle = lane.color;
        ctx.font = "600 11px ui-monospace, Geist Mono, monospace";
        ctx.fillText(lane.short, 8, y + 16);
        const ci = sampleIndex(cursorTime, sr, result.n);
        ctx.font = "10px ui-monospace, Geist Mono, monospace";
        ctx.fillText(formatLaneValue(lane, prim[ci] ?? 0), 8, y + laneH - 8);
        ctx.restore();

        ctx.globalAlpha = 1;
      });

      const cx = plotX + ((cursorTime - t0) / (t1 - t0)) * plotW;
      if (cx >= plotX && cx <= plotX + plotW) {
        ctx.strokeStyle = "rgba(250,250,210,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, stackH);
        ctx.stroke();
      }

      const axisY = stackH + 2;
      ctx.fillStyle = "rgba(148,163,184,0.85)";
      ctx.font = "10px ui-monospace, Geist Mono, monospace";
      const ticks = 8;
      for (let i = 0; i <= ticks; i++) {
        const t = t0 + (i / ticks) * (t1 - t0);
        const x = plotX + (i / ticks) * plotW;
        ctx.strokeStyle = "rgba(148,163,184,0.2)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, stackH);
        ctx.stroke();
        ctx.fillStyle = "rgba(203,213,225,0.8)";
        ctx.fillText(formatTime(t), x + 2, axisY + 12);
      }

      const miniY = H - miniH;
      ctx.fillStyle = "#050b11";
      ctx.fillRect(plotX, miniY, plotW, miniH - 4);
      strokeColumn(
        ctx,
        result.input,
        0,
        result.n,
        plotX,
        miniY + 2,
        plotW,
        miniH - 8,
        -result.peakInput * 1.1 || -1,
        result.peakInput * 1.1 || 1,
        "rgba(125,211,252,0.7)",
        1
      );
      const vx0 = plotX + (t0 / result.duration) * plotW;
      const vx1 = plotX + (t1 / result.duration) * plotW;
      ctx.fillStyle = "rgba(165,180,252,0.18)";
      ctx.fillRect(vx0, miniY, Math.max(2, vx1 - vx0), miniH - 4);
      ctx.strokeStyle = "rgba(196,181,253,0.8)";
      ctx.strokeRect(vx0, miniY, Math.max(2, vx1 - vx0), miniH - 4);

      ctx.fillStyle = "rgba(226,232,240,0.7)";
      ctx.font = "10px ui-sans-serif, Geist, sans-serif";
      ctx.fillText(
        `${formatTime(t1 - t0)} window  ·  wheel zoom  ·  drag pan  ·  click inspect`,
        plotX,
        miniY - 4
      );
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [
    result,
    params,
    viewStart,
    viewEnd,
    cursorTime,
    lanes,
    showExaggerated,
    highlightTrace,
  ]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = timeFromX(e.clientX);
      const zoom = e.deltaY > 0 ? 1.14 : 1 / 1.14;
      let start = t - (t - viewStart) * zoom;
      let end = t + (viewEnd - t) * zoom;
      const minW = 0.001;
      if (end - start < minW) {
        const m = (start + end) / 2;
        start = m - minW / 2;
        end = m + minW / 2;
      }
      start = Math.max(0, start);
      end = Math.min(result.duration, end);
      onViewChange(start, end);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
    // timeFromX is redefined each render; deps cover the values it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStart, viewEnd, result.duration, onViewChange, cursorTime]);

  function timeFromX(clientX: number): number {
    const wrap = wrapRef.current;
    if (!wrap) return cursorTime;
    const rect = wrap.getBoundingClientRect();
    const labelW = 70;
    const plotW = rect.width - labelW - 10;
    const x = clientX - rect.left - labelW;
    const u = Math.max(0, Math.min(1, x / Math.max(1, plotW)));
    return viewStart + u * (viewEnd - viewStart);
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-[min(62vh,640px)] min-h-[420px] w-full overflow-hidden rounded-xl overscroll-contain ring-1 ring-white/10"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        drag.current = {
          mode: e.shiftKey ? "pan" : "cursor",
          x: e.clientX,
          start: viewStart,
          end: viewEnd,
          moved: false,
        };
        if (!e.shiftKey) onCursor(timeFromX(e.clientX));
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
        if (d.mode === "pan" || e.buttons === 2 || e.shiftKey) {
          const wrap = wrapRef.current;
          if (!wrap) return;
          const plotW = wrap.clientWidth - 88;
          const dt = ((d.x - e.clientX) / Math.max(1, plotW)) * (d.end - d.start);
          let start = d.start + dt;
          let end = d.end + dt;
          const span = end - start;
          if (start < 0) {
            start = 0;
            end = span;
          }
          if (end > result.duration) {
            end = result.duration;
            start = Math.max(0, end - span);
          }
          onViewChange(start, end);
        } else {
          onCursor(timeFromX(e.clientX));
        }
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onDoubleClick={() => onViewChange(0, result.duration)}
    >
      <canvas ref={canvasRef} className="h-full w-full touch-none" />
    </div>
  );
}

export function TraceToggles({
  visible,
  onToggle,
}: {
  visible: Record<string, boolean>;
  onToggle: (id: TraceId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {LANES.map((lane) => {
        const on = visible[lane.id] !== false;
        return (
          <button
            key={lane.id}
            type="button"
            onClick={() => onToggle(lane.id)}
            className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ring-1 transition ${
              on
                ? "bg-white/5 text-foreground ring-white/15"
                : "text-muted-foreground ring-transparent line-through opacity-50"
            }`}
            style={{ color: on ? lane.color : undefined }}
          >
            {lane.short}
          </button>
        );
      })}
    </div>
  );
}
