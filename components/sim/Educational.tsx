"use client";

import { EDU_STAGES, formatDb, formatPct, type StageReadout } from "@/lib/dsp";
import { Button } from "@/components/ui/button";

export function EducationalPanel({
  stage,
  readout,
  onStage,
}: {
  stage: number;
  readout: StageReadout;
  onStage: (s: number) => void;
}) {
  const s = EDU_STAGES[stage] ?? EDU_STAGES[0];
  const live = liveText(stage, readout);

  return (
    <div className="rounded-xl bg-[#0b1520] p-4 ring-1 ring-violet-400/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-medium tracking-wide text-violet-300 uppercase">
          Step through the chain
        </div>
        <div className="flex gap-1">
          <Button
            size="xs"
            variant="outline"
            onClick={() => onStage((stage + EDU_STAGES.length - 1) % EDU_STAGES.length)}
          >
            Prev
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onStage((stage + 1) % EDU_STAGES.length)}
          >
            Next
          </Button>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {EDU_STAGES.map((st, i) => (
          <button
            key={st.id}
            type="button"
            onClick={() => onStage(i)}
            className={`rounded-md px-2 py-1 text-[10px] ring-1 ${
              i === stage
                ? "bg-violet-500/20 text-violet-100 ring-violet-400/40"
                : "text-muted-foreground ring-white/10"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <h3 className="text-sm font-medium text-foreground">{s.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-sky-100">
        {s.equation}
      </pre>
      <p className="mt-3 font-mono text-[12px] leading-relaxed text-lime-200">{live}</p>
    </div>
  );
}

function liveText(stage: number, r: StageReadout): string {
  switch (stage) {
    case 0:
      return `At the cursor, x = ${r.input.toFixed(5)} V.`;
    case 1:
      return `Rectified sample r = ${r.rectified.toFixed(5)} V.`;
    case 2:
      return `Envelope y = ${r.envelope.toFixed(5)} V (${formatDb(r.envelopeDb)}), currently in ${r.attacking ? "attack (charging)" : "release (discharging)"}.`;
    case 3:
      return `Level ${formatDb(r.envelopeDb)} vs threshold ${formatDb(r.thresholdDb)} → over ${formatDb(r.overDb)} → desired gain ${formatDb(r.desiredGainDb)}.`;
    case 4:
      return `Digital pair A = ${formatDb(r.attADb, 1)}, B = ${formatDb(r.attBDb, 1)}, leftover fraction α = ${formatPct(r.alpha)}.`;
    case 5:
      return `vA = x · 10^(A/20) = ${r.input.toFixed(4)} · 10^(${r.attADb.toFixed(1)}/20). Channel B uses ${formatDb(r.attBDb, 1)}.`;
    case 6:
      return `α = ${formatPct(r.alpha)}. Linear-amp mix ${formatDb(r.mixLinearDb, 3)}; linear-in-dB mix ${formatDb(r.mixDbLawDb, 3)}.`;
    default:
      return `Output sample ${r.output.toFixed(5)} V vs ideal VCA ${r.idealOut.toFixed(5)} V. Error ${formatDb(r.errorDb, 3)} before analog extras.`;
  }
}
