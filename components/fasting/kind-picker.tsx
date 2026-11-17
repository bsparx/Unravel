"use client";

import { useId } from "react";
import { Clock3, MoonStar } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { cn } from "@/lib/utils";
import { FAST_KINDS, type FastKindId } from "@/lib/fasting";

const ICONS = { INTERMITTENT: Clock3, ISLAMIC: MoonStar } as const;

/**
 * Intermittent or Islamic. Two native radios in cards, so arrow keys move
 * between them; the card says what each one means without a hover.
 */
export function FastKindPicker({
  value,
  onChange,
  className,
}: {
  value: FastKindId;
  onChange: (next: FastKindId) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-label flex items-center gap-1 font-medium">
        Kind of fast <InfoTip term="islamic-fast" />
      </p>
      <div role="radiogroup" aria-label="Kind of fast" className="grid gap-2 sm:grid-cols-2">
        {FAST_KINDS.map((kind) => {
          const checked = value === kind.id;
          const Icon = ICONS[kind.id];
          return (
            <label
              key={kind.id}
              className={cn(
                "relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                checked
                  ? "border-primary/60 bg-primary/[0.06] shadow-[inset_0_0_0_1px_var(--color-primary)]"
                  : "border-border bg-card hover:border-foreground/25",
              )}
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={kind.id}
                checked={checked}
                onChange={() => onChange(kind.id)}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:ring-ring pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2" />
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="grid gap-0.5">
                <span className="text-body font-medium">{kind.label}</span>
                <span className="text-muted-foreground text-label">{kind.blurb}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
