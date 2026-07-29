"use client";

import { useState } from "react";
import { Sparkles, TrendingUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeQuota,
  formatQuota,
  UNIT_DESCRIPTIONS,
  type HabitUnit,
} from "@/lib/quota";
import { cn } from "@/lib/utils";

const UNITS: { value: HabitUnit; label: string }[] = [
  { value: "MINUTES", label: "Minutes" },
  { value: "COUNT", label: "A count" },
];

/**
 * The two bars a habit is measured against.
 *
 * The framing here is the feature. The **minimum** is presented as the thing
 * that counts and is nudged toward being tiny, because it is the only number
 * the streak reads — a bar you can clear on your worst day is the one that
 * survives a worst day. The **optimal** is explicitly labelled as not what
 * keeps the streak, so nobody sets an ambitious minimum by accident and then
 * loses a 40-day run to one bad Tuesday.
 */
export function QuotaFields({
  defaultUnit = "MINUTES",
  defaultMinimum = 1,
  defaultOptimal = null,
  minimumError,
  optimalError,
}: {
  defaultUnit?: HabitUnit;
  defaultMinimum?: number;
  defaultOptimal?: number | null;
  minimumError?: string;
  optimalError?: string;
}) {
  const [unit, setUnit] = useState<HabitUnit>(defaultUnit);
  const [minimum, setMinimum] = useState<number | "">(defaultMinimum);
  const [optimal, setOptimal] = useState<number | "">(defaultOptimal ?? "");

  const quota = {
    unit,
    minimum: typeof minimum === "number" ? minimum : 0,
    optimal: typeof optimal === "number" ? optimal : null,
  };

  const collapsed =
    typeof optimal === "number" &&
    typeof minimum === "number" &&
    optimal <= minimum;

  return (
    <div className="space-y-4">
      <input type="hidden" name="unit" value={unit} />

      <div className="space-y-1.5">
        <Label className="text-label font-medium">Counted in</Label>
        <div className="flex gap-1.5">
          {UNITS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setUnit(option.value)}
              aria-pressed={unit === option.value}
              className={cn(
                "focus-visible:ring-ring rounded-full border px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                unit === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-label">
          {UNIT_DESCRIPTIONS[unit]}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-primary/40 bg-accent/40 space-y-1.5 rounded-lg border p-3">
          <Label
            htmlFor="minimumQuota"
            className="text-micro text-primary flex items-center gap-1.5 font-medium tracking-wider uppercase"
          >
            <Sparkles className="size-3" aria-hidden />
            The minimum
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="minimumQuota"
              name="minimumQuota"
              type="number"
              min={1}
              max={10000}
              required
              value={minimum}
              onChange={(event) =>
                setMinimum(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              className="h-9 w-24 text-center tabular-nums"
            />
            <span className="text-muted-foreground text-label">
              {unit === "MINUTES" ? "minutes" : "times"}
            </span>
          </div>
          <p className="text-muted-foreground text-label">
            This is all the streak asks for. Make it small enough that you could
            do it on your worst day — one page, two minutes — because that is
            the day it has to survive.
          </p>
          {minimumError && (
            <p role="alert" className="text-destructive text-label">
              {minimumError}
            </p>
          )}
        </div>

        <div className="border-border space-y-1.5 rounded-lg border p-3">
          <Label
            htmlFor="optimalQuota"
            className="text-micro text-muted-foreground flex items-center gap-1.5 font-medium tracking-wider uppercase"
          >
            <TrendingUp className="size-3" aria-hidden />
            A good day
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="optimalQuota"
              name="optimalQuota"
              type="number"
              min={1}
              max={10000}
              value={optimal}
              onChange={(event) =>
                setOptimal(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              placeholder="Optional"
              className="h-9 w-24 text-center tabular-nums"
            />
            <span className="text-muted-foreground text-label">
              {unit === "MINUTES" ? "minutes" : "times"}
            </span>
          </div>
          <p className="text-muted-foreground text-label">
            What you&apos;d do when it&apos;s going well. Tracked and celebrated,
            but never what keeps the streak alive.
          </p>
          {(optimalError || collapsed) && (
            <p role="alert" className="text-destructive text-label">
              {optimalError ?? "A good day has to be more than the minimum."}
            </p>
          )}
        </div>
      </div>

      {typeof minimum === "number" && minimum > 0 && (
        <p className="text-muted-foreground text-label">
          So: <span className="text-foreground">{describeQuota(quota)}</span>.
          {quota.optimal !== null && !collapsed && (
            <>
              {" "}
              A day where you do {formatQuota(quota.optimal, unit)} counts once,
              as optimal — not twice.
            </>
          )}
        </p>
      )}
    </div>
  );
}
