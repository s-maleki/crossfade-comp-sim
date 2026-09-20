export function ArchitectureBanner() {
  return (
    <div className="overflow-x-auto rounded-xl bg-[#071018] px-3 py-2 ring-1 ring-white/10">
      <svg viewBox="0 0 920 78" className="h-[72px] min-w-[720px]">
        <defs>
          <linearGradient id="g" x1="0" x2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#a3e635" />
          </linearGradient>
        </defs>
        <text x="8" y="14" fill="#94a3b8" fontSize="10" fontFamily="ui-sans-serif">
          Audio path
        </text>
        <text x="8" y="58" fill="#94a3b8" fontSize="10" fontFamily="ui-sans-serif">
          Sidechain
        </text>
        <Box x={70} y={4} w={88} label="Input x(t)" color="#7dd3fc" />
        <Arrow x1={158} x2={178} y={22} />
        <Box x={180} y={4} w={92} label="Digital att A" color="#60a5fa" />
        <Box x={180} y={28} w={92} label="Digital att B" color="#4ade80" />
        <Arrow x1={272} x2={292} y={14} />
        <Arrow x1={272} x2={292} y={40} />
        <Box x={294} y={10} w={100} label="Analog xfade" color="#c4b5fd" />
        <Arrow x1={394} x2={414} y={28} />
        <Box x={416} y={10} w={88} label="Makeup" color="#fde047" />
        <Arrow x1={504} x2={524} y={28} />
        <Box x={526} y={10} w={88} label="Output y(t)" color="#a3e635" />

        <path d="M114 26 v28 H178" fill="none" stroke="#fb923c" strokeWidth="1.2" />
        <Box x={180} y={50} w={92} label="Rectifier" color="#fde047" />
        <Arrow x1={272} x2={292} y={64} />
        <Box x={294} y={50} w={100} label="Attack / release" color="#fb923c" />
        <Arrow x1={394} x2={414} y={64} />
        <Box x={416} y={50} w={88} label="Comp. curve" color="#e879f9" />
        <path
          d="M504 64 H548 v-22"
          fill="none"
          stroke="#e879f9"
          strokeWidth="1.2"
          markerEnd="url(#arr)"
        />
        <text x={552} y={48} fill="#e879f9" fontSize="9" fontFamily="ui-monospace">
          A, B + α
        </text>
      </svg>
    </div>
  );
}

function Box({
  x,
  y,
  w,
  label,
  color,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  color: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={4}
        fill="#0b1520"
        stroke={color}
        strokeWidth="1.2"
      />
      <text
        x={x + w / 2}
        y={y + 14}
        textAnchor="middle"
        fill={color}
        fontSize="10"
        fontFamily="ui-sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

function Arrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <line x1={x1} y1={y} x2={x2} y2={y} stroke="#64748b" strokeWidth="1.2" />
  );
}

export function EnvelopeSchematic({
  rectifier,
  envelope,
  input,
  capacitor,
}: {
  rectifier: string;
  envelope: number;
  input: number;
  capacitor: number;
}) {
  const fill = Math.max(0, Math.min(1, envelope * 1.1));
  return (
    <svg viewBox="0 0 260 92" className="h-[88px] w-full">
      <text x="4" y="12" fill="#94a3b8" fontSize="10">
        Detector: {rectifier}
      </text>
      <text x="4" y="86" fill="#7dd3fc" fontSize="10" fontFamily="ui-monospace">
        vin {input.toFixed(3)}
      </text>
      <line x1="10" y1="40" x2="48" y2="40" stroke="#7dd3fc" />
      <polygon points="48,28 72,40 48,52" fill="none" stroke="#fde047" />
      <line x1="48" y1="52" x2="72" y2="40" stroke="#fde047" />
      <line x1="72" y1="40" x2="118" y2="40" stroke="#fb923c" />
      <rect x="118" y="18" width="18" height="44" rx="2" fill="#0b1520" stroke="#fb923c" />
      <rect
        x="120"
        y={20 + 40 * (1 - fill)}
        width="14"
        height={40 * fill}
        fill="#fb923c"
        opacity="0.85"
      />
      <text x="140" y="30" fill="#94a3b8" fontSize="9">
        C×{capacitor.toFixed(2)}
      </text>
      <line x1="127" y1="62" x2="127" y2="78" stroke="#64748b" />
      <line x1="118" y1="78" x2="136" y2="78" stroke="#64748b" />
      <text x="150" y="54" fill="#fb923c" fontSize="10" fontFamily="ui-monospace">
        venv {envelope.toFixed(3)}
      </text>
    </svg>
  );
}
