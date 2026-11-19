"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";

import { BalloonScene } from "@/components/scenes/balloon-scene";
import { DumpEnvelopeFace } from "@/components/dump-envelope";
import { ritualGhostClass, ritualPrimaryClass } from "@/components/ritual-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DUMP_COPY,
  DUMP_MAX_CHARS,
  DUMP_MAX_TASKS,
  clock,
  dumpLines,
  wordCount,
  type DumpKind,
  type DumpMinutes,
} from "@/lib/brain-dump";
import { SCENES, stageAt, stageIdsAt, stageLine, wholeLine } from "@/lib/scenes";
import { TEND_DAYS, type Tending } from "@/lib/tending";
import { cn } from "@/lib/utils";

export type DumpResult = {
  kind: DumpKind;
  body: string;
  seconds: number;
  paper: boolean;
  tasks: string[];
};

type Stage = "write" | "rest" | "sort" | "done";

/** Seconds of quiet before a place to look is offered. */
const NUDGE_AFTER = 12;

/**
 * A brain dump, start to finish: a page and a timer, then (if you like) a
 * pass to circle what's actionable, then the page folds away unread. Older
 * lines fade as you go, so you keep writing rather than rereading, and
 * spellcheck is off: nothing on this page needs fixing.
 *
 * Presentational: the caller saves. `onSave` resolves true once stored, and
 * the fold waits for it.
 */
export function BrainDumpSession({
  kind,
  minutes,
  tending,
  onSave,
  onClose,
}: {
  kind: DumpKind;
  minutes: DumpMinutes;
  tending: Tending;
  onSave: (result: DumpResult) => Promise<boolean>;
  onClose: () => void;
}) {
  const copy = DUMP_COPY[kind];
  const [stage, setStage] = useState<Stage>("write");
  const [body, setBody] = useState("");
  const [planned, setPlanned] = useState(minutes * 60);
  const [elapsed, setElapsed] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [circled, setCircled] = useState<Set<number>>(new Set());
  const [lines, setLines] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [quiet, setQuiet] = useState(0);
  const [nudge, setNudge] = useState(-1);
  const [nudgeShown, setNudgeShown] = useState(false);
  const [sent, setSent] = useState(0);
  // The done screen draws the balloon where it was, then lets it rise.
  const [shownLevel, setShownLevel] = useState(tending.level);
  const page = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const started = useRef(0);
  const pausedAt = useRef(0);
  const lastKey = useRef(0);

  // The clock runs off the wall, so a backgrounded tab doesn't lose time.
  // Time spent off the page (on the rest card) doesn't count against it.
  useEffect(() => {
    if (stage !== "write") return;
    const now = Date.now();
    if (!started.current) started.current = now;
    else if (pausedAt.current) started.current += now - pausedAt.current;
    lastKey.current = now;
    const tick = setInterval(() => {
      const at = Date.now();
      setElapsed(Math.floor((at - started.current) / 1000));
      setQuiet(Math.floor((at - lastKey.current) / 1000));
    }, 250);
    return () => {
      clearInterval(tick);
      pausedAt.current = Date.now();
    };
  }, [stage]);

  // Time's up: the page stops taking words.
  if (stage === "write" && elapsed >= planned) {
    setStage("rest");
    setTimeUp(true);
    setLeaving(false);
  }

  // A quiet spell brings the next place to look; typing again puts it away.
  const nudgeDue = stage === "write" && quiet >= NUDGE_AFTER;
  if (nudgeDue !== nudgeShown) {
    setNudgeShown(nudgeDue);
    if (nudgeDue) setNudge((n) => (n + 1) % copy.nudges.length);
  }

  const remaining = Math.max(0, planned - elapsed);
  const written = body.trim().length > 0;
  const seconds = Math.min(elapsed, planned);

  const write = (value: string) => {
    setBody(value.slice(0, DUMP_MAX_CHARS));
    lastKey.current = Date.now();
    setQuiet(0);
    // Keep the newest line low on the page, with room below it.
    const el = page.current;
    if (el && el.selectionStart >= value.length - 1) el.scrollTop = el.scrollHeight;
  };

  const stop = () => {
    if (!written) return;
    setStage("rest");
    setTimeUp(false);
  };

  // Back to the page: a minute more once time's up, or the rest of it.
  const resume = () => {
    if (timeUp) setPlanned(elapsed + 60);
    setStage("write");
    setTimeUp(false);
    requestAnimationFrame(() => {
      const el = page.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const toSort = () => {
    const found = dumpLines(body);
    setLines(found);
    // A bedtime list is all to-dos; you take off what isn't.
    setCircled(new Set(kind === "TOMORROW" ? found.map((_, i) => i).slice(0, DUMP_MAX_TASKS) : []));
    setStage("sort");
  };

  const toggle = (i: number) =>
    setCircled((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else if (next.size < DUMP_MAX_TASKS) next.add(i);
      return next;
    });

  const fold = async (withTasks: boolean) => {
    if (saving) return;
    setSaving(true);
    const tasks = withTasks ? lines.filter((_, i) => circled.has(i)) : [];
    const ok = await onSave({ kind, body, seconds, paper: false, tasks });
    setSaving(false);
    if (ok) {
      setSent(tasks.length);
      setStage("done");
    }
  };

  // Closing mid-page asks first; there's nothing to lose before a word.
  const requestClose = () => {
    if (stage === "done" || saving) {
      if (!saving) onClose();
      return;
    }
    if (!written) {
      onClose();
      return;
    }
    setLeaving(true);
  };

  // What the day does for the balloon once this is kept.
  const after = tending.today ? tending.level : tending.ifDone;
  const brought = after > tending.level ? stageAt(SCENES.braindump, after) : null;
  const grown = stageIdsAt(SCENES.braindump, after).slice(tending.level);
  // The sort opens on its first line, so the keyboard lands where the choosing is.
  useEffect(() => {
    if (stage === "sort") list.current?.querySelector("button")?.focus();
  }, [stage]);

  useEffect(() => {
    if (stage !== "done") return;
    const rise = setTimeout(() => setShownLevel(after), 700);
    return () => clearTimeout(rise);
  }, [stage, after]);

  const count = circled.size;
  const progress = planned > 0 ? Math.min(1, elapsed / planned) : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          page.current?.focus();
        }}
        className="dump-sky top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 text-[var(--woop-ink)] ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Brain dump: {copy.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Write whatever is in your head until the timer ends. Then circle anything actionable, if you like, and the
          page folds away.
        </DialogDescription>

        <div className="relative flex h-full min-h-0 flex-col">
          {/* Top: what this is, the clock, a way out. */}
          <header className="flex shrink-0 items-center gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
            <p className="text-sm font-medium text-[var(--woop-ink-muted)]">
              {stage === "sort" ? "Sort" : stage === "done" ? "Folded away" : copy.name}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {(stage === "write" || stage === "rest") && (
                <div
                  className="flex items-center gap-2 rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] py-1 pr-3 pl-1.5 backdrop-blur-md"
                  role="timer"
                  aria-label={timeUp ? "Time's up" : stage === "rest" ? `Stopped with ${clock(remaining)} left` : `${clock(remaining)} left`}
                >
                  <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden>
                    <circle cx={12} cy={12} r={9} fill="none" stroke="var(--woop-line)" strokeWidth={2.5} />
                    <circle
                      cx={12}
                      cy={12}
                      r={9}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - progress}
                      className="transition-[stroke-dashoffset] duration-300"
                    />
                  </svg>
                  <span className="font-mono text-sm tabular-nums" aria-hidden>
                    {clock(remaining)}
                  </span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={saving}
                onClick={requestClose}
                aria-label="Close"
                className="rounded-full text-[var(--woop-ink-muted)] hover:bg-[var(--woop-hover)] hover:text-[var(--woop-ink)]"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          </header>

          {/* The page. */}
          {(stage === "write" || stage === "rest") && (
            <main className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-5 sm:px-8">
              <label htmlFor="dump-page" className="sr-only">
                Your brain dump
              </label>
              <textarea
                id="dump-page"
                ref={page}
                value={body}
                onChange={(event) => write(event.target.value)}
                onKeyDown={(event) => {
                  // Ctrl or Cmd + Enter: done early.
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    stop();
                  }
                }}
                readOnly={stage !== "write"}
                spellCheck={false}
                autoCapitalize="sentences"
                placeholder={copy.placeholder}
                className={cn(
                  "dump-page font-hand min-h-0 w-full flex-1 resize-none bg-transparent pb-10 text-[1.625rem] leading-snug text-[var(--woop-ink)] outline-none placeholder:text-[var(--woop-ink)]/50 sm:text-[2rem] xl:text-[2.25rem]",
                  stage === "rest" && "opacity-60 transition-opacity duration-700",
                )}
              />
              <p
                aria-live="polite"
                className={cn(
                  "pointer-events-none absolute inset-x-5 bottom-2 text-sm text-[var(--woop-ink-muted)] transition-opacity duration-700 sm:inset-x-8",
                  nudgeShown && nudge >= 0 ? "opacity-100" : "opacity-0",
                )}
              >
                {nudge >= 0 && nudgeShown ? <>Stuck? {copy.nudges[nudge]}</> : null}
              </p>
            </main>
          )}

          {/* The sort: circle what's actionable. */}
          {stage === "sort" && (
            <main className="woop-step-in mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-5 sm:px-8">
              <div className="shrink-0 space-y-1 pt-6 pb-4 sm:pt-10">
                <h2 className="font-display text-2xl leading-tight sm:text-3xl">{copy.sortTitle}</h2>
                <p className="text-sm text-[var(--woop-ink-muted)] sm:text-base">{copy.sortHint}</p>
              </div>
              {lines.length === 0 ? (
                <p className="py-10 text-center text-[var(--woop-ink-muted)]">Nothing to sort on this one.</p>
              ) : (
                <ul
                  ref={list}
                  aria-label="Lines from your dump"
                  className="dump-scroll -mx-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-6"
                >
                  {lines.map((line, i) => {
                    const on = circled.has(i);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(i)}
                          className={cn(
                            "group/line relative block w-full rounded-2xl px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none",
                            on ? "text-[var(--woop-ink)]" : "text-[var(--woop-ink-muted)] hover:bg-[var(--woop-hover)]",
                          )}
                        >
                          <span className="font-hand relative inline-block text-[1.375rem] leading-snug sm:text-2xl">
                            {line}
                            {on && (
                              <svg
                                viewBox="0 0 100 40"
                                preserveAspectRatio="none"
                                aria-hidden
                                className="dump-circle pointer-events-none absolute -top-1.5 -left-3 h-[calc(100%+0.75rem)] w-[calc(100%+1.5rem)] overflow-visible"
                              >
                                <path
                                  d="M54 3 C80 2 98 9 97 20 C96 32 74 38 48 38 C22 38 3 32 3 20 C3 9 24 3 50 4 C60 4 68 5 72 7"
                                  pathLength={1}
                                  fill="none"
                                  stroke="var(--balloon-env-1)"
                                  strokeWidth={2.4}
                                  strokeLinecap="round"
                                  vectorEffect="non-scaling-stroke"
                                />
                              </svg>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </main>
          )}

          {/* Folded away, and what the day did for the balloon. */}
          {stage === "done" && (
            <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-6 text-center sm:px-8">
              <div className="dump-fold w-[min(18rem,80%)] shrink-0" aria-hidden>
                <DumpEnvelopeFace kind={kind} sealed big />
              </div>
              <div className="space-y-1.5">
                <p className="font-display text-3xl leading-tight sm:text-4xl">Folded away</p>
                <p className="text-[var(--woop-ink-muted)]">
                  It&apos;s out of your head and somewhere safe. It opens tomorrow.
                  {sent > 0 && ` ${sent} ${sent === 1 ? "line went" : "lines went"} to your tasks${kind === "TOMORROW" ? ", due tomorrow" : ""}.`}
                </p>
              </div>
              <div className="w-full shrink-0 overflow-hidden rounded-2xl ring-1 ring-[var(--woop-glass-edge)]">
                <div className="relative aspect-[2/1]">
                  <BalloonScene level={shownLevel} fresh={shownLevel === after ? grown : []} label={false} />
                </div>
              </div>
              <div className="space-y-1">
                {brought ? (
                  <p className="text-sm font-medium">
                    The balloon rose:{" "}
                    <span className="rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] px-2.5 py-0.5">
                      {brought.name.charAt(0).toUpperCase() + brought.name.slice(1)}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-medium">
                    {tending.today ? "The balloon was already kept today." : "Today keeps the balloon where it is."}
                  </p>
                )}
                <p className="text-xs text-[var(--woop-ink-muted)]">
                  {after === TEND_DAYS ? wholeLine(SCENES.braindump) : stageLine(after)}
                </p>
              </div>
            </main>
          )}

          {/* Bottom: the one thing to do next. */}
          <footer className="flex shrink-0 flex-col items-center gap-3 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
            {leaving ? (
              <div className="woop-glass flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border border-[var(--woop-glass-edge)] bg-[var(--woop-scrim)] px-5 py-4 text-center backdrop-blur-md">
                <p className="text-sm">Leave without keeping it? What you&apos;ve written won&apos;t be saved.</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    autoFocus
                    onClick={() => {
                      setLeaving(false);
                      if (stage === "write") requestAnimationFrame(() => page.current?.focus());
                    }}
                    className={cn(ritualGhostClass, "rounded-full")}
                  >
                    Keep writing
                  </Button>
                  <Button type="button" onClick={onClose} className={ritualPrimaryClass}>
                    Leave
                  </Button>
                </div>
              </div>
            ) : stage === "write" ? (
              <div className="flex w-full max-w-3xl items-center justify-between gap-3">
                <p className="text-xs text-[var(--woop-ink-muted)] tabular-nums" aria-live="off">
                  {written ? `${wordCount(body)} words` : "Don't stop to fix anything."}
                </p>
                <Button type="button" disabled={!written} onClick={stop} className={ritualPrimaryClass}>
                  <Check className="size-4" aria-hidden />
                  Done
                </Button>
              </div>
            ) : stage === "rest" ? (
              <div className="woop-step-in woop-glass flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border border-[var(--woop-glass-edge)] bg-[var(--woop-scrim)] px-5 py-5 text-center backdrop-blur-md">
                <div className="space-y-1">
                  <p className="font-display text-xl">{timeUp ? "Time. Let the pen rest." : "That's it. Let the pen rest."}</p>
                  <p className="text-sm text-[var(--woop-ink-muted)]">
                    {written ? "Sort it now if you like, or fold it away as it is." : "Nothing on the page. That's fine too."}
                  </p>
                </div>
                {written ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={saving}
                      loading={saving}
                      onClick={() => void fold(false)}
                      className={cn(ritualGhostClass, "rounded-full")}
                    >
                      Fold it away
                    </Button>
                    <Button type="button" autoFocus disabled={saving} onClick={toSort} className={ritualPrimaryClass}>
                      {kind === "TOMORROW" ? "Check the list" : "Pick out to-dos"}
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" autoFocus onClick={onClose} className={ritualPrimaryClass}>
                    Close
                  </Button>
                )}
                <button
                  type="button"
                  onClick={resume}
                  disabled={saving}
                  className="text-xs text-[var(--woop-ink-muted)] underline-offset-4 hover:text-[var(--woop-ink)] hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {timeUp ? "One more minute" : "Keep writing"}
                </button>
              </div>
            ) : stage === "sort" ? (
              <div className="flex w-full max-w-3xl items-center justify-between gap-3">
                <p className="text-xs text-[var(--woop-ink-muted)] sm:text-sm">
                  {count === 0
                    ? "Nothing circled"
                    : kind === "TOMORROW"
                      ? `${count} for tomorrow`
                      : `${count} to your task list`}
                </p>
                <Button
                  type="button"
                  loading={saving}
                  disabled={saving}
                  onClick={() => void fold(count > 0)}
                  className={ritualPrimaryClass}
                >
                  {saving ? "Folding…" : count > 0 ? `Send ${count} and fold` : "Fold it away"}
                </Button>
              </div>
            ) : (
              <Button type="button" autoFocus onClick={onClose} className={cn(ritualPrimaryClass, "min-w-40")}>
                Done
              </Button>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
