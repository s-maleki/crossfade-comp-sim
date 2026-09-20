"use client";

import { formatDb, formatPct, type StageReadout } from "@/lib/dsp";

function Row({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="border-b border-white/5 py-2 last:border-0">
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="font-mono text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function ControlChain({
  readout,
  lawLabel,
}: {
  readout: StageReadout;
  lawLabel: string;
}) {
  const gr = -readout.desiredGrDb;
  return (
    <div className="rounded-xl bg-[#071018] p-3 ring-1 ring-white/10">
      <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Control path
      </div>
      <Row
        label="Envelope"
        value={`${readout.envelope.toFixed(4)} V`}
        sub={`${formatDb(readout.envelopeDb)} · ${readout.attacking ? "attack" : "release"}`}
        color="#fb923c"
      />
      <div className="py-1 text-center text-[10px] text-muted-foreground">↓ compressor curve</div>
      <Row
        label="Desired gain reduction"
        value={formatDb(readout.desiredGrDb)}
        sub={`over threshold ${formatDb(readout.overDb)} · GR ${gr.toFixed(2)} dB`}
        color="#e879f9"
      />
      <div className="py-1 text-center text-[10px] text-muted-foreground">↓ 1 dB digital pair</div>
      <Row
        label="Digital attenuation"
        value={`A ${formatDb(readout.attADb, 1)}   B ${formatDb(readout.attBDb, 1)}`}
        sub={`adjacent codes, ${Math.abs(readout.attADb - readout.attBDb).toFixed(1)} dB apart`}
        color="#60a5fa"
      />
      <div className="py-1 text-center text-[10px] text-muted-foreground">↓ analog mix</div>
      <Row
        label="Crossfade control"
        value={`${formatPct(readout.alpha)} B  ·  ${readout.controlVolts.toFixed(2)} V`}
        sub={`0% = all A, 100% = all B`}
        color="#c4b5fd"
      />
      <Row
        label={`Actual gain (${lawLabel})`}
        value={formatDb(readout.actualGainDb, 3)}
        sub={`lin-amp ${formatDb(readout.mixLinearDb, 3)} · lin-dB ${formatDb(readout.mixDbLawDb, 3)}`}
        color="#a3e635"
      />
      <Row
        label="Error vs ideal VCA"
        value={formatDb(readout.errorDb, 3)}
        sub={`makeup ${formatDb(readout.makeupDb, 1)} · out ${readout.output.toFixed(4)}`}
        color={Math.abs(readout.errorDb) > 0.15 ? "#f87171" : "#86efac"}
      />
    </div>
  );
}
