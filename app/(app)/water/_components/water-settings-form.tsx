"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { updateWaterSettings } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idleState } from "@/lib/validation";
import { formatMinuteOfDay, type WaterSettings } from "@/lib/water";

/** The reminder window is set in whole hours, 0:00–23:00. */
const WINDOW_HOURS = Array.from({ length: 24 }, (_, h) => h * 60);

/**
 * The goal and the reminder schedule.
 *
 * The reminders exist to catch the day that fell behind the pace line, so
 * everything here is in service of that one mechanism: the goal it paces
 * against, the window the day lives in, and the minimum gap between nudges.
 * The science note sits with the goal because that is where the number gets
 * judged.
 */
export function WaterSettingsForm({ values }: { values: WaterSettings }) {
  const [state, formAction, pending] = useActionState(
    updateWaterSettings,
    idleState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={formAction} className="border-border bg-card rounded-lg border px-4 py-3">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-title">Reminders &amp; goal</h2>
          <p className="text-muted-foreground mt-0.5 text-label">
            The goal is the day&rsquo;s target. The reminders only speak up
            when you fall behind the pace line.
          </p>
        </div>

        <NumberField
          id="goal"
          label="Daily goal"
          suffix="glasses"
          defaultValue={values.goal}
          min={4}
          max={16}
          error={error("goal")}
          hint="Most adults need 8–12 glasses of 250ml a day. 8 is the baseline — move it for heat, exercise, or how your days actually run."
        />

        <div className="space-y-3 pt-1">
          <CheckboxField
            id="remindersEnabled"
            label="Remind me to drink"
            hint="A browser notification when you fall behind the pace line. It goes quiet once your goal is met, and for the night."
            defaultChecked={values.remindersEnabled}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="intervalMin"
              label="Remind me every"
              suffix="minutes"
              defaultValue={values.intervalMin}
              min={60}
              max={240}
              step={30}
              error={error("intervalMin")}
            />

            <div className="space-y-2">
              <Label>Reminder window</Label>
              <div className="flex items-center gap-2">
                <Select name="startMin" defaultValue={String(values.startMin)}>
                  <SelectTrigger
                    className="w-full"
                    aria-label="Reminders start at"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_HOURS.map((minute) => (
                      <SelectItem key={minute} value={String(minute)}>
                        {formatMinuteOfDay(minute)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-label">to</span>
                <Select name="endMin" defaultValue={String(values.endMin)}>
                  <SelectTrigger
                    className="w-full"
                    aria-label="Reminders end at"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_HOURS.map((minute) => (
                      <SelectItem key={minute} value={String(minute)}>
                        {formatMinuteOfDay(minute)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error("endMin") && (
                <p role="alert" className="text-destructive text-label">
                  {error("endMin")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-border border-t pt-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  suffix,
  hint,
  defaultValue,
  min,
  max,
  step,
  error,
}: {
  id: string;
  label: string;
  suffix: string;
  hint?: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={id}
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          className="w-24 text-center tabular-nums"
        />
        <span className="text-muted-foreground text-label">{suffix}</span>
      </div>
      {hint && <p className="text-muted-foreground text-label">{hint}</p>}
      {error && (
        <p role="alert" className="text-destructive text-label">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckboxField({
  id,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} name={id} defaultChecked={defaultChecked} />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        <p className="text-muted-foreground text-label">{hint}</p>
      </div>
    </div>
  );
}
