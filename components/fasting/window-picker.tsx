"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FAST_PROTOCOLS,
  eatMinutes,
  fastMinutes,
  formatHM,
  formatMinuteOfDay,
  parseMinuteOfDay,
  protocolOf,
  windowFor,
  type FastProtocolId,
  type FastWindow,
} from "@/lib/fasting";

import { DayStrip } from "./day-strip";

/**
 * Choose the eating window: a protocol and when it opens, or both ends by
 * hand. Native radios, so arrow keys move between protocols. Custom is its
 * own remembered choice: a custom 12:00-20:00 is still custom while you're
 * typing it, even though it happens to be 16:8.
 */
export function FastWindowPicker({
  value,
  onChange,
  className,
}: {
  value: FastWindow;
  onChange: (next: FastWindow) => void;
  className?: string;
}) {
  const id = useId();
  const [custom, setCustom] = useState(protocolOf(value) === "custom");
  const selected: FastProtocolId = custom ? "custom" : protocolOf(value);

  const choose = (next: FastProtocolId) => {
    if (next === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    const protocol = FAST_PROTOCOLS.find((p) => p.id === next)!;
    onChange(windowFor(protocol, value.eatStart));
  };

  const setStart = (raw: string) => {
    const minute = parseMinuteOfDay(raw);
    if (minute === null) return;
    if (custom) {
      if (minute !== value.eatEnd) onChange({ eatStart: minute, eatEnd: value.eatEnd });
      return;
    }
    const protocol = FAST_PROTOCOLS.find((p) => p.id === selected);
    onChange(protocol ? windowFor(protocol, minute) : { ...value, eatStart: minute });
  };

  const setEnd = (raw: string) => {
    const minute = parseMinuteOfDay(raw);
    if (minute === null || minute === value.eatStart) return;
    onChange({ eatStart: value.eatStart, eatEnd: minute });
  };

  const options = [
    ...FAST_PROTOCOLS.map((protocol) => ({
      id: protocol.id as FastProtocolId,
      label: protocol.label,
      name: protocol.name,
      blurb: protocol.blurb,
      detail: `Fast ${24 - protocol.eatHours}h · eat ${protocol.eatHours}h`,
    })),
    {
      id: "custom" as FastProtocolId,
      label: "Custom",
      name: "Your hours",
      blurb: "Set when the window opens and closes yourself. It can run past midnight.",
      detail: custom ? `Fast ${formatHM(fastMinutes(value))} · eat ${formatHM(eatMinutes(value))}` : "Any window",
    },
  ];

  return (
    <div className={cn("space-y-5", className)}>
      <div role="radiogroup" aria-label="Fasting protocol" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = selected === option.id;
          return (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>
                <label
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-0.5 rounded-2xl border px-3.5 py-3 transition-colors",
                    checked
                      ? "border-primary/60 bg-primary/[0.06] shadow-[inset_0_0_0_1px_var(--color-primary)]"
                      : "border-border bg-card hover:border-foreground/25",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-protocol`}
                    value={option.id}
                    checked={checked}
                    onChange={() => choose(option.id)}
                    className="peer sr-only"
                  />
                  <span className="peer-focus-visible:ring-ring pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2" />
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xl tabular-nums">{option.label}</span>
                    <span className="text-muted-foreground text-micro">{option.name}</span>
                  </span>
                  <span className="text-muted-foreground font-mono text-micro tabular-nums">{option.detail}</span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64">
                {option.blurb}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-start`}>Eating window opens</Label>
          <Input
            id={`${id}-start`}
            type="time"
            step={300}
            value={formatMinuteOfDay(value.eatStart)}
            onChange={(event) => setStart(event.target.value)}
            className="w-36 tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-end`}>Closes</Label>
          {custom ? (
            <Input
              id={`${id}-end`}
              type="time"
              step={300}
              value={formatMinuteOfDay(value.eatEnd)}
              onChange={(event) => setEnd(event.target.value)}
              className="w-36 tabular-nums"
            />
          ) : (
            <p id={`${id}-end`} className="text-body flex h-9 items-center tabular-nums">
              {formatMinuteOfDay(value.eatEnd)}
              <span className="text-muted-foreground text-label ml-2">set by {options.find((o) => o.id === selected)?.label}</span>
            </p>
          )}
        </div>
      </div>

      <DayStrip window={value} />
    </div>
  );
}
