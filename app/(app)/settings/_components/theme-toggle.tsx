"use client";

import { Check, Sunset } from "lucide-react";

import {
  useEveningShift,
  useMounted,
  useTheme,
} from "@/components/theme-provider";
import { Label } from "@/components/ui/label";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Each palette's canvas and action colour, for the swatch. Copied from the
 * tokens in globals.css rather than read from them: a swatch has to show a
 * theme that isn't the one on screen, and the tokens only exist for the
 * active one.
 */
const OPTIONS: { value: Theme; label: string; note: string; swatch: [string, string] }[] = [
  { value: "system", label: "System", note: "Follows your device", swatch: ["#f7f2fb", "#060a19"] },
  { value: "light", label: "Light", note: "Lilac and plum", swatch: ["#f7f2fb", "#654263"] },
  { value: "dark", label: "Dark", note: "Navy and blue-violet", swatch: ["#060a19", "#3652e9"] },
  { value: "eggplant", label: "Eggplant", note: "Aubergine and mauve", swatch: ["#0b0811", "#b089b2"] },
  { value: "sage", label: "Sage", note: "Mist and teal", swatch: ["#eff5f1", "#2f6f6a"] },
  { value: "grove", label: "Grove", note: "Forest and moss", swatch: ["#07110e", "#86c9a1"] },
  { value: "hearth", label: "Hearth", note: "Ember, for evenings", swatch: ["#110c0a", "#e29b62"] },
  { value: "clear", label: "Clear", note: "Flat, high contrast", swatch: ["#f3f3f1", "#1b1b1f"] },
];

const EVENING_HOURS = [19, 20, 21, 22];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { evening, setEvening } = useEveningShift();

  // The server has no idea which theme is active, so the selected state can
  // only be shown once we're on the client — otherwise the markup would
  // hydrate with the wrong option highlighted.
  const hydrated = useMounted();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label id="appearance-label">Appearance</Label>
        <div
          role="group"
          aria-labelledby="appearance-label"
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
        >
          {OPTIONS.map(({ value, label, note, swatch }) => {
            const active = hydrated && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={cn(
                  "focus-visible:ring-ring flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-foreground hover:bg-secondary",
                )}
              >
                <span
                  aria-hidden
                  className="border-border size-6 shrink-0 rounded-full border"
                  style={{
                    background: `linear-gradient(135deg, ${swatch[0]} 0 50%, ${swatch[1]} 50% 100%)`,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-semibold">{label}</span>
                  <span className="text-muted-foreground block text-micro">{note}</span>
                </span>
                <Check
                  className={cn("size-4 shrink-0", active ? "visible" : "invisible")}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Sunset className="text-accent-foreground mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p id="evening-label" className="text-label font-semibold">
              Evening shift
            </p>
            <p className="text-muted-foreground text-micro">
              Switch to Hearth in the evening, until 05:00. A warmer room makes
              the close easier.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hydrated && evening.on}
            aria-labelledby="evening-label"
            onClick={() => setEvening({ ...evening, on: !evening.on })}
            className={cn(
              "focus-visible:ring-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              hydrated && evening.on ? "bg-primary" : "bg-input",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "bg-background size-5 rounded-full shadow transition-transform",
                hydrated && evening.on ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </div>
        {hydrated && evening.on && (
          <label className="text-muted-foreground flex items-center gap-2 pl-8 text-label">
            From
            <select
              value={evening.from}
              onChange={(event) => setEvening({ on: true, from: Number(event.target.value) })}
              className="border-input bg-input-surface text-foreground min-h-11 rounded-lg border px-3"
            >
              {EVENING_HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}:00
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
