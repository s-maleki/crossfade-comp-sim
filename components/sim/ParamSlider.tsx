"use client";

import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { logMap, logUnmap } from "@/lib/dsp";

export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", disabled && "pointer-events-none opacity-50", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[11px] font-normal text-muted-foreground">{label}</Label>
        <span className="font-mono text-[11px] tabular-nums text-foreground/90">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step ?? (max - min) / 200}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}

export function LogSlider({
  label,
  value,
  min,
  max,
  onChange,
  format,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const t = logUnmap(value, min, max);
  return (
    <div className={cn("space-y-1", disabled && "pointer-events-none opacity-50")}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[11px] font-normal text-muted-foreground">{label}</Label>
        <span className="font-mono text-[11px] tabular-nums text-foreground/90">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.001}
        value={[t]}
        disabled={disabled}
        onValueChange={(v) => onChange(logMap(v[0] ?? t, min, max))}
      />
    </div>
  );
}
