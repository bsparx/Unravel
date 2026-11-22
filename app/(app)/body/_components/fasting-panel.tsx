"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Clock3,
  MoonStar,
  Pencil,
  Settings2,
  Sunrise,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DayStrip } from "@/components/fasting/day-strip";
import { FastDaysPicker } from "@/components/fasting/days-picker";
import { FastRing } from "@/components/fasting/fast-ring";
import { FastKindPicker } from "@/components/fasting/kind-picker";
import { useNow } from "@/components/fasting/use-now";
import { FastWindowPicker } from "@/components/fasting/window-picker";
import { InfoTip } from "@/components/info-tip";
import { ritualGhostClass, ritualPrimaryClass } from "@/components/ritual-frame";
import { SceneCard } from "@/components/scenes/scene-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FastingView, FastRow } from "@/lib/body-data";
import { instantToLocalInput, minuteOfDayLocal } from "@/lib/dates";
import {
  describeFastDays,
  fastMinutes,
  fastProgress,
  formatClockIn,
  formatHM,
  formatMinuteOfDay,
  islamicStripWindow,
  phaseAt,
  windowRatio,
  type FastKindId,
  type FastWindow,
} from "@/lib/fasting";
import type { ActionState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { deleteFast, endFast, setFastingPlan, startFast, updateFast } from "../fasting-actions";
import { FastEditDialog } from "./fast-edit-dialog";

const PAGE_SIZE = 14;

type Plan = { kind: FastKindId; window: FastWindow; daysOfWeek: number[] };

/**
 * Fasting: the plan (an eating window by the clock, or Islamic, Fajr to
 * Maghrib, plus which weekdays you fast on) and what really happened (fasts
 * you start and break with a tap).
 */
export function FastingPanel({ view }: { view: FastingView }) {
  const now = useNow(Date.parse(view.nowISO));
  const tz = view.timeZone;
  const nowDate = new Date(now);
  const minute = minuteOfDayLocal(tz, nowDate);

  // Local so the chip, ring and strip answer at once; the save is debounced,
  // the same way as the Mind template picker.
  const initial: Plan = {
    kind: view.kind,
    window: view.window,
    daysOfWeek: view.daysOfWeek,
  };
  const [plan, setPlan] = useState<Plan>(initial);
  const [savingPlan, startPlanSave] = useTransition();
  const saved = useRef<Plan>(initial);
  const queued = useRef<{ timer: ReturnType<typeof setTimeout>; next: Plan } | null>(null);

  const sendPlan = (next: Plan) => {
    const formData = new FormData();
    formData.set("kind", next.kind);
    formData.set("eatStart", String(next.window.eatStart));
    formData.set("eatEnd", String(next.window.eatEnd));
    formData.set("daysOfWeek", next.daysOfWeek.join(","));
    return setFastingPlan(formData);
  };

  const savePlan = (next: Plan) => {
    queued.current = null;
    startPlanSave(async () => {
      try {
        const state = await sendPlan(next);
        if (state.status === "error") throw new Error(state.message);
        saved.current = next;
      } catch {
        setPlan(saved.current);
        toast.error("Couldn't change the plan. Try again.");
      }
    });
  };

  // A choice still waiting when the popover closes is saved then, and one
  // waiting when the panel goes (another page) or the tab does (a reload,
  // a closed tab) is sent on the way out.
  const flush = () => {
    const waiting = queued.current;
    if (!waiting) return;
    clearTimeout(waiting.timer);
    savePlan(waiting.next);
  };

  useEffect(() => {
    const leave = () => {
      const waiting = queued.current;
      if (!waiting) return;
      clearTimeout(waiting.timer);
      queued.current = null;
      void sendPlan(waiting.next);
    };
    globalThis.addEventListener("pagehide", leave);
    return () => {
      globalThis.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  const choosePlan = (next: Plan) => {
    setPlan(next);
    if (queued.current) clearTimeout(queued.current.timer);
    queued.current = { timer: setTimeout(() => savePlan(next), 450), next };
  };

  const [editing, setEditing] = useState<FastRow | "open" | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  const today = view.islamic.today;
  // The chip names the plan; the prayer and meal names add width a phone
  // doesn't have, so they show from sm up.
  const scheduleSuffix =
    plan.daysOfWeek.length < 7 ? ` · ${describeFastDays(plan.daysOfWeek)}` : "";
  const planLabel =
    plan.kind === "ISLAMIC" ? (
      today ? (
        <>
          Islamic · <span className="hidden sm:inline">Fajr </span>
          {today.fajrLabel} to <span className="hidden sm:inline">Maghrib </span>
          {today.maghribLabel}
          {scheduleSuffix}
        </>
      ) : (
        `Islamic · Fajr to Maghrib${scheduleSuffix}`
      )
    ) : (
      <>
        {windowRatio(plan.window)} · <span className="hidden sm:inline">eat </span>
        {formatMinuteOfDay(plan.window.eatStart)} to {formatMinuteOfDay(plan.window.eatEnd)}
        {scheduleSuffix}
      </>
    );
  const target = plan.kind === "ISLAMIC" ? (today?.minutes ?? view.targetMinutes) : fastMinutes(plan.window);

  return (
    <div className="max-w-4xl space-y-10">
      {view.sceneEnabled && (
        <SceneCard
          tab="fasting"
          tending={view.tending}
          note={(day) => view.dayNotes[day.dateISO] ?? null}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="font-display text-title">Fasting</h2>
          <InfoTip term="fasting" />
        </div>

        <Popover onOpenChange={(open) => !open && flush()}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="max-w-full rounded-full">
              <Settings2 className="size-3.5" aria-hidden />
              <span className="text-muted-foreground hidden sm:inline">Plan:</span>
              <span className="truncate tabular-nums">{planLabel}</span>
              <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[min(44rem,80dvh)] w-[min(34rem,calc(100vw-2rem))] space-y-5 overflow-y-auto p-4">
            <FastKindPicker value={plan.kind} onChange={(kind) => choosePlan({ ...plan, kind })} />
            {plan.kind === "INTERMITTENT" ? (
              <div className="space-y-2">
                <p className="text-label flex items-center gap-1 font-medium">
                  Eating window <InfoTip term="fast-window" />
                </p>
                <FastWindowPicker value={plan.window} onChange={(window) => choosePlan({ ...plan, window })} />
              </div>
            ) : (
              <div className="bg-muted/40 space-y-1 rounded-2xl px-4 py-3">
                <p className="text-body">
                  {today ? (
                    <>
                      Today: Fajr <span className="tabular-nums">{today.fajrLabel}</span> to Maghrib{" "}
                      <span className="tabular-nums">{today.maghribLabel}</span>, {formatHM(today.minutes)}
                    </>
                  ) : (
                    "Today's prayer times couldn't be loaded."
                  )}
                </p>
                <p className="text-muted-foreground text-label">
                  Times for {view.islamic.city}.{" "}
                  <Link href="/settings#prayers" className="text-primary underline underline-offset-4">
                    Change the city
                  </Link>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-label font-medium">Fasting days</p>
              <FastDaysPicker
                value={plan.daysOfWeek}
                onChange={(daysOfWeek) => choosePlan({ ...plan, daysOfWeek })}
              />
            </div>
            <p aria-live="polite" className="text-muted-foreground text-micro">
              {savingPlan
                ? "Saving…"
                : "Saved as you choose, in your timezone. It sets the goal for fasts you start from now on; past fasts keep theirs."}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <Hero
        view={view}
        plan={plan}
        now={nowDate}
        minute={minute}
        onEditOpen={() => setEditing("open")}
      />

      <Bars days={view.days} targetMinutes={target} />

      <section aria-label="Your fasts" className="space-y-4">
        <h3 className="text-body font-medium">Your fasts</h3>
        {view.history.length === 0 ? (
          <p className="text-muted-foreground text-label border-border rounded-2xl border border-dashed px-5 py-8 text-center">
            Fasts you finish show up here, with their start, end and length.
          </p>
        ) : (
          <>
            <ol className="border-border divide-border divide-y rounded-2xl border">
              {view.history.slice(0, shown).map((fast) => (
                <HistoryRow key={fast.id} fast={fast} onEdit={() => setEditing(fast)} />
              ))}
            </ol>
            {view.history.length > shown && (
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show older
              </Button>
            )}
          </>
        )}
      </section>

      {editing && (
        <FastEditDialog
          key={editing === "open" ? "open" : editing.id}
          title={editing === "open" ? "When did this fast start?" : "Edit this fast"}
          id={editing === "open" ? view.open!.id : editing.id}
          start={editing === "open" ? view.open!.startInput : editing.startInput}
          end={editing === "open" ? null : editing.endInput}
          onSave={updateFast}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const mod = (n: number) => ((n % 1440) + 1440) % 1440;
const clock = (iso: string, tz: string) => formatClockIn(new Date(iso), tz);
const Time = ({ children }: { children: React.ReactNode }) => <span className="tabular-nums">{children}</span>;

/** What the hero shows: decided from the running fast, or from the plan. */
type HeroState = {
  sky: string;
  eyebrow: string;
  line: React.ReactNode;
  ring: React.ReactNode;
  primary: { label: string; icon: typeof Clock3; run: () => void; disabled?: boolean } | null;
  earlier: { label: string; heading: string; defaultValue: Date; onSave: (value: string) => Promise<boolean> } | null;
  strip: { window: FastWindow; eat: string; fast: string } | null;
};

/** The sky card: the ring, what the plan says, and the one button. */
function Hero({
  view,
  plan,
  now,
  minute,
  onEditOpen,
}: {
  view: FastingView;
  plan: Plan;
  now: Date;
  minute: number;
  onEditOpen: () => void;
}) {
  const tz = view.timeZone;
  const open = view.open;
  const [pending, startTransition] = useTransition();

  const progress = open ? fastProgress(new Date(open.startedAtISO), now, open.targetMinutes) : null;
  const latestEnd = view.history[0] ? Date.parse(view.history[0].endedAtISO) : 0;

  const run = (action: () => Promise<ActionState | void>, done: string) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const state = await action();
          if (state && state.status === "error") {
            toast.error(state.message);
            resolve(false);
            return;
          }
          toast.success(done);
          resolve(true);
        } catch {
          toast.error("Couldn't save that. Try again.");
          resolve(false);
        }
      });
    });

  const start = (at?: string) => {
    const formData = new FormData();
    formData.set("kind", plan.kind);
    if (at) formData.set("startedAt", at);
    return run(() => startFast(formData), plan.kind === "ISLAMIC" ? "Fast logged. May it be accepted." : "Fast started.");
  };

  const end = (at?: string) => {
    const formData = new FormData();
    formData.set("id", open!.id);
    if (at) formData.set("endedAt", at);
    return run(() => endFast(formData), progress?.reached ? "Fast complete. Well done." : "Fast ended.");
  };

  const state = heroState();

  function runningRing() {
    return (
      <>
        <span className="font-display text-5xl leading-none tabular-nums">{formatHM(progress!.elapsedMinutes)}</span>
        <span className="mt-2 text-sm text-[var(--woop-ink-muted)]">of {formatHM(open!.targetMinutes)}</span>
        {progress!.reached && <Sunrise className="mt-2 size-5 text-[var(--fast-reached)]" aria-label="Goal reached" />}
      </>
    );
  }

  function skyFor(ratio: number) {
    return ratio >= 0.85 ? "fast-sky-dawn" : ratio >= 0.2 ? "fast-sky-night" : "fast-sky-dusk";
  }

  function heroState(): HeroState {
    const islamic = open ? open.kind === "ISLAMIC" : plan.kind === "ISLAMIC";
    const day = view.islamic.today;
    const strip = islamic
      ? day
        ? {
            window: islamicStripWindow(new Date(day.fajrISO), new Date(day.maghribISO), tz),
            eat: "Eating (iftar to suhoor)",
            fast: "Fasting (Fajr to Maghrib)",
          }
        : null
      : { window: plan.window, eat: "Eating window", fast: "Fasting" };

    // ---- a fast is running
    if (open && progress) {
      const started = Date.parse(open.startedAtISO);
      if (open.kind === "ISLAMIC") {
        const maghrib = view.islamic.openMaghribISO ?? progress.goalAt.toISOString();
        if (started > now.getTime()) {
          return {
            sky: "fast-sky-night",
            eyebrow: "Suhoor",
            line: (
              <>
                Your fast begins at Fajr, <Time>{clock(open.startedAtISO, tz)}</Time>. Iftar at Maghrib,{" "}
                <Time>{clock(maghrib, tz)}</Time>.
              </>
            ),
            ring: (
              <>
                <MoonStar className="mb-2 size-5 text-[var(--woop-ink-muted)]" aria-hidden />
                <span className="font-display text-4xl leading-none tabular-nums">{formatHM(open.targetMinutes)}</span>
                <span className="mt-2 text-sm text-[var(--woop-ink-muted)]">Fajr to Maghrib</span>
              </>
            ),
            primary: {
              label: "Not fasting after all",
              icon: UtensilsCrossed,
              run: () => void run(() => deleteFast(open.id), "Removed."),
            },
            earlier: null,
            strip,
          };
        }
        const atMaghrib = now.getTime() >= Date.parse(maghrib);
        return {
          sky: skyFor(progress.ratio),
          eyebrow: atMaghrib ? "Iftar" : "Fasting",
          line: atMaghrib ? (
            <>It&apos;s Maghrib. Break your fast, and may it be accepted.</>
          ) : (
            <>
              {formatHM(open.targetMinutes - progress.elapsedMinutes)} to iftar · Maghrib at <Time>{clock(maghrib, tz)}</Time>
            </>
          ),
          ring: runningRing(),
          primary: {
            label: atMaghrib ? `Break fast at Maghrib, ${clock(maghrib, tz)}` : "Break fast",
            icon: UtensilsCrossed,
            run: () => void end(),
          },
          earlier: atMaghrib
            ? null
            : { label: "Broke it early…", heading: "When did you break the fast?", defaultValue: now, onSave: end },
          strip,
        };
      }

      const lastOpen = new Date(now.getTime() - mod(minute - plan.window.eatStart) * 60_000);
      return {
        sky: skyFor(progress.ratio),
        eyebrow: progress.reached ? "Goal reached" : "Fasting",
        line: progress.reached ? (
          <>Past the goal by {formatHM(progress.elapsedMinutes - open.targetMinutes)}. Break it whenever you&apos;re ready.</>
        ) : (
          <>
            {formatHM(open.targetMinutes - progress.elapsedMinutes)} to go · goal at <Time>{formatClockIn(progress.goalAt, tz)}</Time>
          </>
        ),
        ring: runningRing(),
        primary: { label: "Break fast", icon: UtensilsCrossed, run: () => void end() },
        earlier: {
          label: "Broke it earlier…",
          heading: "When did you break the fast?",
          defaultValue: lastOpen.getTime() > started ? lastOpen : now,
          onSave: end,
        },
        strip,
      };
    }

    // ---- no fast running, Islamic plan
    if (plan.kind === "ISLAMIC") {
      const tomorrow = view.islamic.tomorrow;
      if (!day) {
        return {
          sky: "fast-sky-dusk",
          eyebrow: "Prayer times unavailable",
          line: <>Couldn&apos;t load Fajr and Maghrib for {view.islamic.city}. They&apos;ll show here once they load.</>,
          ring: (
            <>
              <MoonStar className="mb-2 size-5 text-[var(--woop-ink-muted)]" aria-hidden />
              <span className="font-display text-3xl leading-none">Islamic</span>
            </>
          ),
          primary: null,
          earlier: null,
          strip: null,
        };
      }
      const beforeFajr = now.getTime() < Date.parse(day.fajrISO);
      const afterMaghrib = now.getTime() >= Date.parse(day.maghribISO);
      const shown = afterMaghrib && tomorrow ? tomorrow : day;
      const ring = (
        <>
          <MoonStar className="mb-2 size-5 text-[var(--woop-ink-muted)]" aria-hidden />
          <span className="font-display text-4xl leading-none tabular-nums">{formatHM(shown.minutes)}</span>
          <span className="mt-2 text-sm text-[var(--woop-ink-muted)]">Fajr to Maghrib</span>
        </>
      );
      if (beforeFajr) {
        return {
          sky: "fast-sky-night",
          eyebrow: "Suhoor",
          line: (
            <>
              Suhoor until Fajr at <Time>{day.fajrLabel}</Time>. Today&apos;s fast runs to Maghrib at{" "}
              <Time>{day.maghribLabel}</Time>.
            </>
          ),
          ring,
          primary: { label: "Fast today", icon: MoonStar, run: () => void start() },
          earlier: null,
          strip,
        };
      }
      if (afterMaghrib) {
        return {
          sky: "fast-sky-dusk",
          eyebrow: "After Maghrib",
          line: tomorrow ? (
            <>
              Tomorrow&apos;s fast: Fajr at <Time>{tomorrow.fajrLabel}</Time> to Maghrib at <Time>{tomorrow.maghribLabel}</Time>.
            </>
          ) : (
            <>Today&apos;s fast ended at Maghrib, {day.maghribLabel}.</>
          ),
          ring,
          primary: tomorrow ? { label: "Fast tomorrow", icon: MoonStar, run: () => void start() } : null,
          earlier: null,
          strip,
        };
      }
      if (latestEnd >= Date.parse(day.fajrISO)) {
        // Broken early today (illness, travel): nothing to log until tomorrow.
        return {
          sky: "fast-sky-day",
          eyebrow: "Fast broken",
          line: (
            <>
              You broke today&apos;s fast at <Time>{formatClockIn(new Date(latestEnd), tz)}</Time>.
              {tomorrow && (
                <>
                  {" "}Tomorrow&apos;s runs from Fajr at <Time>{tomorrow.fajrLabel}</Time> to Maghrib at{" "}
                  <Time>{tomorrow.maghribLabel}</Time>.
                </>
              )}
            </>
          ),
          ring,
          primary: null,
          earlier: null,
          strip,
        };
      }
      return {
        sky: "fast-sky-day",
        eyebrow: "Fasting hours",
        line: (
          <>
            Today&apos;s fast runs from Fajr at <Time>{day.fajrLabel}</Time> to Maghrib at <Time>{day.maghribLabel}</Time>.
            Fasting today? Log it from Fajr.
          </>
        ),
        ring,
        primary: { label: "Fasting today", icon: MoonStar, run: () => void start() },
        earlier: null,
        strip,
      };
    }

    // ---- no fast running, intermittent plan
    const window = plan.window;
    const phase = phaseAt(minute, window);
    const lastClose = new Date(now.getTime() - mod(minute - window.eatEnd) * 60_000);
    const ring = (
      <>
        <UtensilsCrossed className="mb-2 size-5 text-[var(--woop-ink-muted)]" aria-hidden />
        <span className="font-display text-4xl leading-none tabular-nums">{windowRatio(window)}</span>
        <span className="mt-2 text-sm text-[var(--woop-ink-muted)]">goal {formatHM(fastMinutes(window))}</span>
      </>
    );
    const base = {
      ring,
      primary: { label: "Start fast", icon: Clock3, run: () => void start() },
      strip,
    };
    const earlierFrom = (from: Date) => ({
      label: "Started earlier…",
      heading: "When did you stop eating?",
      defaultValue: from,
      onSave: start,
    });
    if (phase.phase === "eating") {
      return {
        ...base,
        sky: "fast-sky-day",
        eyebrow: "Eating window",
        line: (
          <>
            Open until <Time>{formatMinuteOfDay(window.eatEnd)}</Time>, {formatHM(phase.minutesLeft)} left. Start your fast after your
            last bite.
          </>
        ),
        earlier: earlierFrom(now),
      };
    }
    if (latestEnd > lastClose.getTime()) {
      // Fasting hours by the plan, but you've just eaten: no nudge to log.
      return {
        ...base,
        sky: "fast-sky-dusk",
        eyebrow: "Between fasts",
        line: (
          <>
            You broke your last fast at <Time>{formatClockIn(new Date(latestEnd), tz)}</Time>. The window opens at{" "}
            <Time>{formatMinuteOfDay(window.eatStart)}</Time>; start the next fast after your last bite.
          </>
        ),
        earlier: earlierFrom(now),
      };
    }
    return {
      ...base,
      sky: "fast-sky-dusk",
      eyebrow: "Fasting hours",
      line: (
        <>
          The window closed at <Time>{formatMinuteOfDay(window.eatEnd)}</Time> and opens at{" "}
          <Time>{formatMinuteOfDay(window.eatStart)}</Time>. Already fasting? Log it from when you stopped eating.
        </>
      ),
      earlier: earlierFrom(lastClose),
    };
  }

  const Primary = state.primary?.icon;

  return (
    <section
      aria-label="Current fast"
      className={cn("relative isolate overflow-hidden rounded-2xl px-5 py-8 text-[var(--woop-ink)] sm:px-10 sm:py-10", state.sky)}
    >
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
        <FastRing ratio={progress?.ratio ?? 0} reached={progress?.reached ?? false}>
          {state.ring}
        </FastRing>

        <div className="flex w-full min-w-0 flex-col items-center gap-4 text-center md:items-start md:text-left">
          <p className="flex items-center gap-2 text-micro font-medium tracking-wider text-[var(--woop-ink-muted)] uppercase">
            {open && progress && progress.elapsedMinutes > 0 && (
              <span aria-hidden className="fast-pulse size-1.5 rounded-full bg-[var(--fast-ring)]" />
            )}
            {state.eyebrow}
          </p>
          <p className="font-display max-w-prose text-xl leading-snug text-balance sm:text-2xl" aria-live="polite">
            {state.line}
          </p>
          {open && Date.parse(open.startedAtISO) <= now.getTime() && (
            <p className="text-sm text-[var(--woop-ink-muted)]">
              Started{" "}
              <button
                type="button"
                onClick={onEditOpen}
                className="rounded underline decoration-dotted underline-offset-4 hover:text-[var(--woop-ink)] focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none"
              >
                <Time>{formatClockIn(new Date(open.startedAtISO), tz)}</Time>
                <Pencil className="ml-1 inline size-3" aria-hidden />
                <span className="sr-only"> (change the start time)</span>
              </button>
            </p>
          )}

          {(state.primary || state.earlier) && (
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {state.primary && Primary && (
                <Button
                  type="button"
                  disabled={pending || state.primary.disabled}
                  className={ritualPrimaryClass}
                  onClick={state.primary.run}
                >
                  <Primary className="size-4" aria-hidden />
                  {state.primary.label}
                </Button>
              )}
              {state.earlier && (
                <EarlierPopover
                  key={`${open?.id ?? "start"}-${state.earlier.label}`}
                  label={state.earlier.label}
                  heading={state.earlier.heading}
                  defaultValue={instantToLocalInput(state.earlier.defaultValue, tz)}
                  max={instantToLocalInput(now, tz)}
                  pending={pending}
                  onSave={state.earlier.onSave}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {state.strip && (
        <div className="mt-8">
          <p className="mb-2 text-label text-[var(--woop-ink-muted)]">Today, as planned</p>
          <DayStrip window={state.strip.window} nowMinute={minute} eatLabel={state.strip.eat} fastLabel={state.strip.fast} />
        </div>
      )}
    </section>
  );
}

function EarlierPopover({
  label,
  heading,
  defaultValue,
  max,
  pending,
  onSave,
}: {
  label: string;
  heading: string;
  defaultValue: string;
  max: string;
  pending: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(defaultValue);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className={cn("rounded-full", ritualGhostClass)} disabled={pending}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 space-y-3 p-4">
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onSave(value)) setOpen(false);
          }}
        >
          <Label htmlFor="fast-earlier">{heading}</Label>
          <Input
            id="fast-earlier"
            type="datetime-local"
            value={value}
            max={max}
            required
            onChange={(event) => setValue(event.target.value)}
          />
          <p className="text-muted-foreground text-micro">In your timezone. You can fix it again later.</p>
          <Button type="submit" size="sm" className="w-full rounded-full" disabled={pending || !value}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Two weeks of fasts, one bar a day, with the goal as a line. */
function Bars({ days, targetMinutes }: { days: FastingView["days"]; targetMinutes: number }) {
  const scale = Math.max(targetMinutes, ...days.map((day) => day.minutes)) * 1.12;
  const goalAt = (targetMinutes / scale) * 100;

  return (
    <section aria-label="The last two weeks" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-body font-medium">Last two weeks</h3>
        <p className="text-muted-foreground text-label flex items-center gap-2 tabular-nums">
          <span aria-hidden className="border-muted-foreground/60 w-4 border-t border-dashed" />
          {formatHM(targetMinutes)} goal
        </p>
      </div>
      <div className="relative">
        <div
          aria-hidden
          className="border-muted-foreground/40 pointer-events-none absolute inset-x-0 border-t border-dashed"
          style={{ bottom: `${goalAt}%` }}
        />
        <ol className="flex h-28 items-end gap-1 sm:gap-1.5">
          {days.map((day, index) => {
            const isToday = index === days.length - 1;
            const height = day.minutes > 0 ? Math.max(4, (day.minutes / scale) * 100) : 0;
            const text =
              day.minutes > 0
                ? `${isToday ? "Today" : day.label} · ${formatHM(day.minutes)}${day.targetMinutes ? ` of ${formatHM(day.targetMinutes)}` : ""}`
                : `${isToday ? "Today" : day.label} · no fast logged`;
            return (
              <li key={day.dateISO} className="flex h-full flex-1 items-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={text}
                      className="focus-visible:ring-ring flex h-full w-full items-end rounded-md focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {height > 0 ? (
                        <span
                          className={cn(
                            "block w-full rounded-t-md rounded-b-sm transition-[height]",
                            day.reached ? "bg-[var(--fast-reached)]" : "bg-[var(--fast-ring)] opacity-70",
                          )}
                          style={{ height: `${height}%` }}
                        />
                      ) : (
                        <span className="bg-muted-foreground/25 mx-auto mb-0.5 block size-1.5 rounded-full" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{text}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      </div>
      <div aria-hidden className="text-muted-foreground flex justify-between font-mono text-micro">
        <span>{days[0]?.label}</span>
        <span>Today</span>
      </div>
    </section>
  );
}

function HistoryRow({ fast, onEdit }: { fast: FastRow; onEdit: () => void }) {
  return (
    <li className="group flex items-center gap-2 py-3 pr-2 pl-4 sm:gap-3 sm:px-5 sm:py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-label sm:text-body tabular-nums">
          <span className="whitespace-nowrap">{fast.startLabel}</span> <span className="text-muted-foreground">→</span>{" "}
          <span className="whitespace-nowrap">{fast.endLabel}</span>
        </p>
        <p className="text-muted-foreground text-micro">
          goal {formatHM(fast.targetMinutes)}
          {fast.kind === "ISLAMIC" && " · Fajr to Maghrib"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-right">
        <span className="font-display text-lg whitespace-nowrap tabular-nums sm:text-xl">{formatHM(fast.minutes)}</span>
        {fast.reached ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="text-[var(--fast-reached)]">
                <Check className="size-4" aria-hidden />
                <span className="sr-only">Goal reached</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Reached the {formatHM(fast.targetMinutes)} goal</TooltipContent>
          </Tooltip>
        ) : (
          <span className="size-4" aria-hidden />
        )}
      </div>
      <div className="flex items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Edit the fast from ${fast.startLabel}`} onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <ConfirmDialog
          title="Delete this fast?"
          description={`${fast.startLabel} → ${fast.endLabel}, ${formatHM(fast.minutes)}. It's gone for good.`}
          onConfirm={async () => {
            await deleteFast(fast.id);
            toast.success("Deleted.");
          }}
          trigger={(openDialog) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive rounded-full"
              aria-label={`Delete the fast from ${fast.startLabel}`}
              onClick={openDialog}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          )}
        />
      </div>
    </li>
  );
}
