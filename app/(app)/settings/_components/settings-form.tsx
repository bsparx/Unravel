"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FastKindPicker } from "@/components/fasting/kind-picker";
import { FastWindowPicker } from "@/components/fasting/window-picker";
import { Button } from "@/components/ui/button";
import { ResearchLink } from "@/components/guides/guide-card";
import { InfoTip } from "@/components/info-tip";
import {
  PracticeTemplatePicker,
  type TemplateChoice,
} from "@/components/practice-template-picker";
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
import type { FastKindId, FastWindow } from "@/lib/fasting";
import { idleState } from "@/lib/validation";

import { updateSettings } from "../actions";
import { ResetProgressButton } from "./reset-progress-button";

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
  prayerRemindersEnabled: boolean;
  prayerCity: string;
  mindWoopEnabled: boolean;
  mindDisputationEnabled: boolean;
  mindGratitudeEnabled: boolean;
  mindDuaEnabled: boolean;
  mindMeditationEnabled: boolean;
  mindReadingEnabled: boolean;
  mindBrainDumpEnabled: boolean;
  heartRecitationEnabled: boolean;
  gratitudeTemplate: string;
  gratitudeCount: number;
  duaTemplate: string;
  duaCount: number;
  bodyExercisesEnabled: boolean;
  bodyFastingEnabled: boolean;
  fastKind: FastKindId;
  fastEatStart: number;
  fastEatEnd: number;
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

  // The pickers only show under a practice that's on, so the boxes are
  // controlled; everything else on the form stays uncontrolled.
  const [gratitudeOn, setGratitudeOn] = useState(values.mindGratitudeEnabled);
  const [duaOn, setDuaOn] = useState(values.mindDuaEnabled);
  const [gratitude, setGratitude] = useState<TemplateChoice>({
    template: values.gratitudeTemplate,
    count: values.gratitudeCount,
  });
  const [dua, setDua] = useState<TemplateChoice>({
    template: values.duaTemplate,
    count: values.duaCount,
  });

  const [fastingOn, setFastingOn] = useState(values.bodyFastingEnabled);
  const [fastKind, setFastKind] = useState<FastKindId>(values.fastKind);
  const [fastWindow, setFastWindow] = useState<FastWindow>({
    eatStart: values.fastEatStart,
    eatEnd: values.fastEatEnd,
  });

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <>
      {/* Submitted through onSubmit, not `action`: a form action resets the
          form afterwards, and Radix answers a reset by setting each
          controlled checkbox back to its first value. A practice you had just
          switched off showed as on again, and the next save turned it on. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="space-y-10"
      >
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

        <section id="prayers" className="scroll-mt-8 space-y-4">
          <div>
            <h2 className="font-display text-title">Prayer reminders</h2>
            <p className="text-muted-foreground text-label">
              Shows Fajr, Zuhr, Asr, Maghrib and Isha as time windows on your
              day and on the calendar. Times are fetched daily from the Aladhan
              API for the city below — the windows move with sunrise and sunset
              on their own.
            </p>
          </div>

          <CheckboxField
            id="prayerRemindersEnabled"
            label="Show prayer windows"
            hint="Each prayer appears once its window opens and stays visible until the next day's dawn — an unchecked prayer is one you haven't prayed yet. The day restarts at 4 AM."
            defaultChecked={values.prayerRemindersEnabled}
          />

          <div className="space-y-2">
            <Label htmlFor="prayerCity">City</Label>
            <Input
              id="prayerCity"
              name="prayerCity"
              type="text"
              maxLength={80}
              placeholder="Karachi"
              defaultValue={values.prayerCity}
            />
            {error("prayerCity") && (
              <p role="alert" className="text-destructive text-label">
                {error("prayerCity")}
              </p>
            )}
          </div>
        </section>

        <section id="mind" className="scroll-mt-8 space-y-4">
          <div>
            <h2 className="font-display text-title flex items-center gap-1">
              Mind <InfoTip term="mind" />
            </h2>
            <p className="text-muted-foreground text-label">
              Choose which practices appear on the Mind page: all of them, some,
              or none. With all five off, Mind leaves the sidebar. Nothing you
              have written is deleted when a practice is switched off.
            </p>
          </div>

          <div className="space-y-5">
            <CheckboxField
              id="mindBrainDumpEnabled"
              label="Brain dump"
              hint="A few minutes writing out whatever is in your head, unfiltered. Circle what's actionable and it goes on your task list; the rest folds away. Done on paper counts too."
              defaultChecked={values.mindBrainDumpEnabled}
              extra={<ResearchLink guide="braindump" />}
            />
            <CheckboxField
              id="mindMeditationEnabled"
              label="Meditation"
              hint="Breathing (box, 4-7-8 and more), dhikr, body scan and stillness, from easy to hard, on a full-screen timer. Each day you sit keeps a moonlit garden."
              defaultChecked={values.mindMeditationEnabled}
              extra={<ResearchLink guide="meditate" />}
            />
            <CheckboxField
              id="mindReadingEnabled"
              label="Reading"
              hint="The books you're reading on a shelf. Log where you started and stopped, and what stayed with you; each book gathers its own notes."
              defaultChecked={values.mindReadingEnabled}
            />
            <CheckboxField
              id="mindWoopEnabled"
              label="Wishes (WOOP)"
              hint="Wish, Outcome, Obstacle, Plan. For something you want and the thing in you that gets in the way."
              defaultChecked={values.mindWoopEnabled}
              extra={<ResearchLink guide="wishes" />}
              />
            <CheckboxField
              id="mindDisputationEnabled"
              label="Disputations (ABCDE)"
              hint="For a gloomy thought after a setback: write it down and argue back."
              defaultChecked={values.mindDisputationEnabled}
              extra={<ResearchLink guide="disputations" />}
            />
          </div>
        </section>

        <section id="heart" className="scroll-mt-8 space-y-4">
          <div>
            <h2 className="font-display text-title flex items-center gap-1">
              Heart <InfoTip term="heart" />
            </h2>
            <p className="text-muted-foreground text-label">
              Choose which practices appear on the Heart page. With all three
              off, Heart leaves the sidebar. Your pages and recitation days are
              kept when a practice is switched off.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <CheckboxField
                id="mindGratitudeEnabled"
                label="Gratitude"
                hint="A page a day of what was good. Light a lantern for each one."
                checked={gratitudeOn}
                onCheckedChange={setGratitudeOn}
                extra={<ResearchLink guide="gratitude" />}
              />
              {gratitudeOn && (
                <div className="space-y-2 sm:pl-7">
                  <p className="text-label flex items-center gap-1 font-medium">
                    Gratitude template <InfoTip term="template" />
                  </p>
                  <PracticeTemplatePicker kind="gratitude" value={gratitude} onChange={setGratitude} />
                </div>
              )}
              <input type="hidden" name="gratitudeTemplate" value={gratitude.template} />
              <input type="hidden" name="gratitudeCount" value={gratitude.count} />
            </div>

            <div className="space-y-3">
              <CheckboxField
                id="mindDuaEnabled"
                label="Du'a"
                hint="A page a day of what you ask Allah for, in English prompts. Once a day; today's page stays editable."
                checked={duaOn}
                onCheckedChange={setDuaOn}
                extra={<ResearchLink guide="dua" />}
              />
              {duaOn && (
                <div className="space-y-2 sm:pl-7">
                  <p className="text-label flex items-center gap-1 font-medium">
                    Du&apos;a template <InfoTip term="template" />
                  </p>
                  <PracticeTemplatePicker kind="dua" value={dua} onChange={setDua} />
                </div>
              )}
              <input type="hidden" name="duaTemplate" value={dua.template} />
              <input type="hidden" name="duaCount" value={dua.count} />
            </div>

            <CheckboxField
              id="heartRecitationEnabled"
              label="Daily recitation"
              hint="A set you choose of Quran and remembrance (the three Quls, Ayat al-Kursi, the end of al-Baqarah and more) in Arabic with transliteration and translation, said with a counter. Each day you finish it keeps an oasis."
              defaultChecked={values.heartRecitationEnabled}
            />
          </div>
        </section>

        <section id="body" className="scroll-mt-8 space-y-4">
          <div>
            <h2 className="font-display text-title flex items-center gap-1">
              Body <InfoTip term="body" />
            </h2>
            <p className="text-muted-foreground text-label">
              Choose what appears on the Body page. With both off, Body leaves
              the sidebar and the bottom bar. Your routine and your fasts are
              kept when a section is switched off.
            </p>
          </div>

          <div className="space-y-5">
            <CheckboxField
              id="bodyExercisesEnabled"
              label="Exercises"
              hint="Your corrective week of yoga and dumbbells, and the body-map catalog."
              defaultChecked={values.bodyExercisesEnabled}
            />

            <div className="space-y-3">
              <CheckboxField
                id="bodyFastingEnabled"
                label="Fasting"
                hint="Intermittent (one eating window a day, by the clock) or Islamic (Fajr to Maghrib). A ring for the fast in progress and a log of real start and end times."
                checked={fastingOn}
                onCheckedChange={setFastingOn}
              />
              {fastingOn && (
                <div className="space-y-4 sm:pl-7">
                  <FastKindPicker value={fastKind} onChange={setFastKind} />
                  {fastKind === "INTERMITTENT" ? (
                    <div className="space-y-2">
                      <p className="text-label flex items-center gap-1 font-medium">
                        Eating window <InfoTip term="fast-window" />
                      </p>
                      <FastWindowPicker value={fastWindow} onChange={setFastWindow} />
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-label">
                      Fajr and Maghrib come from the city under Prayer reminders above, so
                      the fast follows the sun through the year.
                    </p>
                  )}
                  {error("fastEatEnd") && (
                    <p role="alert" className="text-destructive text-label">
                      {error("fastEatEnd")}
                    </p>
                  )}
                </div>
              )}
              <input type="hidden" name="fastKind" value={fastKind} />
              <input type="hidden" name="fastEatStart" value={fastWindow.eatStart} />
              <input type="hidden" name="fastEatEnd" value={fastWindow.eatEnd} />
            </div>
          </div>
        </section>

        <div className="border-border border-t pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>

      <section className="mt-16 space-y-4">
        <div>
          <h2 className="font-display text-title">Danger zone</h2>
          <p className="text-muted-foreground text-label">
            Wipes every day you have logged and every minute on the clock —
            done days, missed days, feedback notes, streaks, identity votes.
            Habits, identities, schedules and quotas stay exactly as they are.
          </p>
        </div>
        <ResetProgressButton />
      </section>
    </>
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
  checked,
  onCheckedChange,
  extra,
}: {
  id: string;
  label: string;
  hint: string;
  /** Under the hint: a "Research on this" link, say. */
  extra?: React.ReactNode;
  defaultChecked?: boolean;
  /** Controlled, when something else on the form depends on the box. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        name={id}
        {...(checked === undefined
          ? { defaultChecked }
          : { checked, onCheckedChange: (next) => onCheckedChange?.(next === true) })}
      />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        <p className="text-muted-foreground text-label">{hint}</p>
        {extra}
      </div>
    </div>
  );
}
