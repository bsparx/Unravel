"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DurationPicker } from "@/components/duration-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVERY_DAY, WEEKDAYS } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  WORK_MODES,
  type WorkMode,
} from "@/lib/timer-math";
import type { ActionState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { HabitCueFields, type CueMode } from "./habit-cue-fields";
import { QuotaFields } from "./quota-fields";
import { StepsEditor, type StepDraft } from "./steps-editor";

export type TaskFormValues = {
  id?: string;
  title?: string;
  notes?: string | null;
  priority?: "P1" | "P2" | "P3" | "P4";
  projectId?: string | null;
  dueDate?: string | null;
  estimateMinutes?: number | null;
  // WorkMode, not TimerMode: a task's default can never be recovery — you
  // don't schedule rest against a todo.
  defaultMode?: WorkMode;
  plannedIntervals?: number | null;
  daysOfWeek?: number[];
  startDate?: string | null;
  endDate?: string | null;
  steps?: StepDraft[];
  unit?: "MINUTES" | "COUNT";
  minimumQuota?: number;
  optimalQuota?: number | null;
  cueMode?: CueMode;
  cueTaskId?: string | null;
  cueLabel?: string | null;
  cueMinutes?: number;
};

const PRIORITIES: { value: "P1" | "P2" | "P3" | "P4"; label: string }[] = [
  { value: "P1", label: "Do it now" },
  { value: "P2", label: "Important" },
  { value: "P3", label: "Nice to do" },
  { value: "P4", label: "No flag" },
];

/** Days from today. "Someday" clears it, because undated is a legitimate state. */
const DEADLINE_PRESETS: { label: string; offset: number | null }[] = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "This week", offset: 7 },
  { label: "Someday", offset: null },
];

const DAY_PRESETS = [
  { label: "Every day", days: EVERY_DAY },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
];

export function TaskForm({
  kind,
  action,
  values = {},
  projects,
  habits = [],
  submitLabel,
  redirectTo,
  hidden,
  showDeadline = true,
  autoFocusTitle = true,
  titleLabel,
  cancelLabel = "Cancel",
  onSuccess,
  onCancel,
}: {
  kind: "TODO" | "HABIT";
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: TaskFormValues;
  projects: { id: string; name: string }[];
  /**
   * Habits only: the candidate anchors for habit stacking. The habit being
   * edited must already be filtered out by the caller.
   */
  habits?: { id: string; title: string }[];
  submitLabel: string;
  /** Where to go on success. Omit when the form is embedded in a page that
   *  stays put and re-renders itself. */
  redirectTo?: string;
  /** Extra fields to submit alongside — e.g. which day this belongs to. */
  hidden?: Record<string, string>;
  /**
   * Todos only. Off where the deadline is implied by context and asking would
   * be a question with one possible answer.
   */
  showDeadline?: boolean;
  autoFocusTitle?: boolean;
  titleLabel?: string;
  cancelLabel?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {
    status: "idle" as const,
  });

  const [days, setDays] = useState<number[]>(values.daysOfWeek ?? EVERY_DAY);
  const [mode, setMode] = useState<WorkMode>(values.defaultMode ?? "POMODORO");
  // Mirrored, not controlled: the title input keeps its defaultValue and this
  // only exists so the stacking preview can read "…, I will read for a bit."
  // back as you type it.
  const [title, setTitle] = useState(values.title ?? "");

  // The deadline input stays uncontrolled — the presets just write into it.
  // Controlling it would mean re-rendering the whole form on every keystroke in
  // a native date field, for no gain.
  const dueDateRef = useRef<HTMLInputElement>(null);

  const setDueDate = (offset: number | null) => {
    const input = dueDateRef.current;
    if (!input) return;
    if (offset === null) {
      input.value = "";
      return;
    }
    // The browser's local day, which is what someone pressing "Tomorrow"
    // means. The server re-buckets it into the user's stored timezone.
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, "0");
    input.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}`;
  };

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
      if (redirectTo) router.push(redirectTo);
      else onSuccess?.();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
    // onSuccess is a fresh closure each render; depending on it would re-fire
    // the toast on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router, redirectTo]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={formAction} className="space-y-8">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {kind === "HABIT" &&
        days.map((day) => (
          <input key={day} type="hidden" name="daysOfWeek[]" value={day} />
        ))}
      <input type="hidden" name="defaultMode" value={mode} />

      <Field
        label={titleLabel ?? (kind === "HABIT" ? "Habit" : "Task")}
        htmlFor="title"
        error={error("title")}
      >
        <Input
          id="title"
          name="title"
          required
          autoFocus={autoFocusTitle}
          maxLength={200}
          defaultValue={values.title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            kind === "HABIT" ? "Read for a bit" : "Email the landlord"
          }
          className="h-11 text-body"
        />
      </Field>

      <Field
        label="What are the steps?"
        hint="The first one is doing a specific job: it's the thing you'll actually click Start on. Make it so small that starting isn't a decision."
        error={error("steps")}
      >
        <StepsEditor name="steps" defaultSteps={values.steps} />
      </Field>

      {kind === "HABIT" ? (
        <Field label="Which days" error={error("daysOfWeek")}>
          <div className="space-y-3">
            <ToggleGroup
              type="multiple"
              value={days.map(String)}
              onValueChange={(next) => setDays(next.map(Number).sort())}
              className="justify-start gap-1.5"
            >
              {WEEKDAYS.map((day) => (
                <ToggleGroupItem
                  key={day.value}
                  value={String(day.value)}
                  aria-label={day.long}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-10 rounded-full border"
                >
                  {day.letter}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex flex-wrap items-center gap-2">
              {DAY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDays(preset.days)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded text-label underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {preset.label}
                </button>
              ))}
              <span className="text-muted-foreground ml-auto text-label">
                {describeRecurrence(days)}
              </span>
            </div>
          </div>
        </Field>
      ) : null}

      {kind === "HABIT" ? (
        <Field
          label="What comes right before it?"
          hint="A habit sticks best when it's bolted to something that already happens without you deciding. Name that thing, and this one rides on it."
        >
          <HabitCueFields
            habits={habits}
            habitTitle={title}
            defaultMode={values.cueMode}
            defaultTaskId={values.cueTaskId}
            defaultLabel={values.cueLabel}
            defaultMinutes={values.cueMinutes}
            taskIdError={error("cueTaskId")}
            labelError={error("cueLabel")}
          />
        </Field>
      ) : null}

      {kind === "HABIT" ? (
        <Field
          label="How much counts as doing it?"
          hint="Two bars, and only the first one matters to the streak."
        >
          <QuotaFields
            defaultUnit={values.unit}
            defaultMinimum={values.minimumQuota}
            defaultOptimal={values.optimalQuota}
            minimumError={error("minimumQuota")}
            optimalError={error("optimalQuota")}
          />
        </Field>
      ) : showDeadline ? (
        <Field
          label="Deadline"
          htmlFor="dueDate"
          hint="Leave it empty and it lives in Anytime — which is a real answer, not a cop-out."
          error={error("dueDate")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={dueDateRef}
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={values.dueDate ?? ""}
              className="w-48"
            />
            {DEADLINE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDueDate(preset.offset)}
                className="border-border text-muted-foreground hover:border-primary/50 hover:text-foreground focus-visible:ring-ring rounded-full border px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <Field
        label="How long do you think it'll take?"
        htmlFor="estimateMinutes"
        hint="In minutes. This is what prefills the timer when you click the task, and what the calendar uses when it finds you a slot. A guess is fine — the point is comparing it with what actually happened."
        error={error("estimateMinutes")}
      >
        <DurationPicker
          id="estimateMinutes"
          name="estimateMinutes"
          defaultMinutes={values.estimateMinutes}
        />
      </Field>

      <Field label="Open the timer in" error={error("defaultMode")}>
        <div className="grid gap-2 sm:grid-cols-3">
          {WORK_MODES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "focus-visible:ring-ring rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                mode === value
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="block text-label font-medium">
                {MODE_LABELS[value]}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-micro leading-4 normal-case tracking-normal">
                {MODE_DESCRIPTIONS[value]}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {mode === "POMODORO" && (
        <Field
          label="Split into"
          htmlFor="plannedIntervals"
          hint="Leave blank and it'll work the split out from your estimate."
          error={error("plannedIntervals")}
        >
          <div className="flex items-center gap-2">
            <Input
              id="plannedIntervals"
              name="plannedIntervals"
              type="number"
              min={1}
              max={12}
              defaultValue={values.plannedIntervals ?? ""}
              placeholder="Auto"
              className="w-24 text-center tabular-nums"
            />
            <span className="text-muted-foreground text-label">sessions</span>
          </div>
        </Field>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Flag" htmlFor="priority">
          <Select name="priority" defaultValue={values.priority ?? "P4"}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="List" htmlFor="projectId">
          <Select name="projectId" defaultValue={values.projectId ?? "none"}>
            <SelectTrigger id="projectId">
              <SelectValue placeholder="No list" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No list</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={error("notes")}>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={values.notes ?? ""}
          placeholder="Anything you'll want in front of you when you start."
        />
      </Field>

      <div className="border-border flex items-center gap-3 border-t pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => (redirectTo ? router.push(redirectTo) : onCancel?.())}
        >
          {cancelLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-label font-medium">
        {label}
      </Label>
      {hint && <p className="text-muted-foreground text-label">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-destructive text-label">
          {error}
        </p>
      )}
    </div>
  );
}
