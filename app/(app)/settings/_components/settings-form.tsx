"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

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
import { WEEKDAYS } from "@/lib/dates";
import { idleState } from "@/lib/validation";

import { updateSettings } from "../actions";

export type SettingsValues = {
  timezone: string;
  weekStart: number;
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  returnAlertsEnabled: boolean;
  autoStartBreaks: boolean;
  autoStartNextFocus: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

export function SettingsForm({
  values,
  timezones,
}: {
  values: SettingsValues;
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateSettings,
    idleState,
  );

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={formAction} className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-title">Your day</h2>
          <p className="text-muted-foreground text-label">
            Everything is grouped by day in this timezone. Changing it affects
            what counts as &ldquo;today&rdquo; from now on — it doesn&apos;t
            move anything already logged.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select name="timezone" defaultValue={values.timezone}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error("timezone") && (
              <p role="alert" className="text-destructive text-label">
                {error("timezone")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="weekStart">Week starts on</Label>
            <Select name="weekStart" defaultValue={String(values.weekStart)}>
              <SelectTrigger id="weekStart" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.long}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-title">Timer defaults</h2>
          <p className="text-muted-foreground text-label">
            Used whenever a task doesn&apos;t say otherwise. Sessions already
            logged keep the settings they ran with.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="pomodoroMinutes"
            label="Focus block"
            suffix="minutes"
            defaultValue={values.pomodoroMinutes}
            min={1}
            max={180}
            error={error("pomodoroMinutes")}
          />
          <NumberField
            id="shortBreakMinutes"
            label="Short break"
            suffix="minutes"
            defaultValue={values.shortBreakMinutes}
            min={1}
            max={60}
            error={error("shortBreakMinutes")}
          />
          <NumberField
            id="longBreakMinutes"
            label="Long break"
            suffix="minutes"
            defaultValue={values.longBreakMinutes}
            min={1}
            max={120}
            error={error("longBreakMinutes")}
          />
          <NumberField
            id="longBreakEvery"
            label="Long break after"
            suffix="focus blocks"
            defaultValue={values.longBreakEvery}
            min={2}
            max={12}
            error={error("longBreakEvery")}
          />
        </div>

        <div className="space-y-3 pt-2">
          <CheckboxField
            id="autoStartBreaks"
            label="Start breaks automatically"
            hint="Otherwise the timer waits for you at the end of each focus block."
            defaultChecked={values.autoStartBreaks}
          />
          <CheckboxField
            id="autoStartNextFocus"
            label="Start the next focus block automatically"
            hint="Off by default — coming back deliberately is usually the better habit."
            defaultChecked={values.autoStartNextFocus}
          />
          <CheckboxField
            id="soundEnabled"
            label="Play a sound when a block ends"
            hint="A short chime. Useful when the tab isn't in front of you."
            defaultChecked={values.soundEnabled}
          />
          <CheckboxField
            id="hapticsEnabled"
            label="Buzz partway through a block"
            hint="A short pulse at halfway and again near the end, so you can feel the time passing without looking. Phones only."
            defaultChecked={values.hapticsEnabled}
          />
          <CheckboxField
            id="returnAlertsEnabled"
            label="Tell me when a break has run over"
            hint="A browser notification, then a few reminders if it keeps running. The only one that reaches you in another app, which is where a break usually goes."
            defaultChecked={values.returnAlertsEnabled}
          />
        </div>
      </section>

      <div className="border-border border-t pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  suffix,
  defaultValue,
  min,
  max,
  error,
}: {
  id: string;
  label: string;
  suffix: string;
  defaultValue: number;
  min: number;
  max: number;
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
          defaultValue={defaultValue}
          className="w-24 text-center tabular-nums"
        />
        <span className="text-muted-foreground text-label">{suffix}</span>
      </div>
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
