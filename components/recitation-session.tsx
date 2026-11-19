"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { bead, buzz, readPrefs } from "@/components/meditation/sound";
import { OasisScene } from "@/components/scenes/oasis-scene";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HadithNote } from "@/components/hadith-note";
import {
  BISMILLAH,
  itemTotal,
  positionIn,
  type SessionItem,
} from "@/lib/recitations";
import {
  SCENES,
  stageAt,
  stageIdsAt,
  stageLine,
  wholeLine,
} from "@/lib/scenes";
import { TEND_DAYS, type Tending } from "@/lib/tending";
import { cn } from "@/lib/utils";

const SCENE = SCENES.recitation;
const PREFS_KEY = "recite:prefs";

type Show = { transliteration: boolean; translation: boolean };

/** Per-device: whether to show the transliteration and the translation. */
function readShow(): Show {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw)
      return {
        transliteration: true,
        translation: true,
        ...(JSON.parse(raw) as Partial<Show>),
      };
  } catch {
    // Private mode or bad JSON: show both.
  }
  return { transliteration: true, translation: true };
}

/** Today's set, as a key: a changed set starts its counts afresh. */
function progressKey(todayISO: string, items: SessionItem[]) {
  return `recite:${todayISO}:${items.map((item) => `${item.key}x${item.rounds}`).join(",")}`;
}

function readTaps(key: string, length: number): number[] {
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    if (
      Array.isArray(list) &&
      list.length === length &&
      list.every((n) => Number.isInteger(n) && n >= 0)
    ) {
      return list as number[];
    }
  } catch {
    // Nothing kept, or nothing readable: start from the top.
  }
  return Array.from({ length }, () => 0);
}

/**
 * The reader: today's set one recitation at a time, full screen. Arabic
 * large, the transliteration and the translation beneath (each can be
 * hidden), and a counter to tap at the foot. The sky brightens towards
 * sunrise as the set goes on. Counts are kept on the device for the day, so
 * closing the reader halfway loses nothing; finishing the last one keeps the
 * day for the oasis and grows it in front of you.
 */
export function RecitationSession({
  items,
  todayISO,
  tending,
  startAt,
  fresh = false,
  onComplete,
  onClose,
}: {
  items: SessionItem[];
  todayISO: string;
  tending: Tending;
  /** Open on this recitation rather than the first unfinished one. */
  startAt?: number;
  /** Start every count from nothing: reciting the set again. */
  fresh?: boolean;
  /** Keep the day. Resolves false if it couldn't be kept. */
  onComplete: () => Promise<boolean>;
  onClose: () => void;
}) {
  const key = progressKey(todayISO, items);
  const [taps, setTaps] = useState<number[]>(() =>
    fresh
      ? Array.from({ length: items.length }, () => 0)
      : readTaps(key, items.length),
  );
  const [at, setAt] = useState(() => {
    if (startAt !== undefined) return startAt;
    const first = fresh
      ? 0
      : items.findIndex(
          (item, i) => (readTaps(key, items.length)[i] ?? 0) < itemTotal(item),
        );
    return first === -1 ? 0 : first;
  });
  const [show, setShow] = useState<Show>(readShow);
  const [stage, setStage] = useState<"read" | "saving" | "done">("read");
  const [failed, setFailed] = useState(false);
  const [shownLevel, setShownLevel] = useState(tending.level);
  const prefs = useRef(readPrefs());
  const body = useRef<HTMLDivElement>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const item = items[at];
  const total = itemTotal(item);
  const done = taps[at] >= total;
  const pos = positionIn(item, taps[at]);
  const part = item.parts[pos.part];
  const finished = taps.every((n, i) => n >= itemTotal(items[i]));
  const allTaps = items.reduce((sum, it) => sum + itemTotal(it), 0);
  const tapped = taps.reduce(
    (sum, n, i) => sum + Math.min(n, itemTotal(items[i])),
    0,
  );
  const dawn = stage === "done" ? 1 : allTaps > 0 ? tapped / allTaps : 0;

  // What the day does for the oasis once it's kept.
  const after = tending.today ? tending.level : tending.ifDone;
  const brought = after > tending.level ? stageAt(SCENE, after) : null;
  const grown = stageIdsAt(SCENE, after).slice(tending.level);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(taps));
    } catch {
      // Full or blocked: the counts just won't survive a reload.
    }
  }, [key, taps]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(show));
    } catch {
      // Ignored, as above.
    }
  }, [show]);

  // A new part or a new recitation starts at the top of its words.
  useEffect(() => {
    body.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [at, pos.part, pos.round]);

  useEffect(() => () => clearTimeout(advance.current), []);

  useEffect(() => {
    if (stage !== "done") return;
    const rise = setTimeout(() => setShownLevel(after), 700);
    return () => clearTimeout(rise);
  }, [stage, after]);

  const finish = useCallback(async () => {
    setStage("saving");
    setFailed(false);
    const ok = await onComplete();
    if (ok) setStage("done");
    else {
      setStage("read");
      setFailed(true);
    }
  }, [onComplete]);

  /** After an item's last count: on to the next unfinished one, or the end. */
  const moveOn = useCallback(
    (next: number[]) => {
      clearTimeout(advance.current);
      advance.current = setTimeout(() => {
        const pending = items.findIndex((it, i) => next[i] < itemTotal(it));
        if (pending === -1) void finish();
        else {
          const after = items.findIndex(
            (it, i) => i > at && next[i] < itemTotal(it),
          );
          setAt(after === -1 ? pending : after);
        }
      }, 650);
    },
    [items, at, finish],
  );

  const tap = useCallback(() => {
    if (stage !== "read" || done) return;
    const count = taps[at] + 1;
    const next = taps.with(at, count);
    setTaps(next);
    const itemDone = count >= total;
    const nextPos = positionIn(item, count);
    const partEnded = !itemDone && nextPos.inPart === 0;
    if (prefs.current.sound) void bead(itemDone || partEnded);
    if (prefs.current.haptics)
      buzz(itemDone ? [20, 40, 20] : partEnded ? [12, 30, 12] : 6);
    if (itemDone) moveOn(next);
  }, [stage, done, taps, at, total, item, moveOn]);

  const recitedAll = () => {
    if (stage !== "read" || done) return;
    const next = taps.with(at, total);
    setTaps(next);
    if (prefs.current.haptics) buzz([20, 40, 20]);
    moveOn(next);
  };

  // Space or Enter counts, wherever focus is, unless it's on another control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, a, input, textarea, [role=menuitem], [role=menuitemcheckbox]",
        )
      )
        return;
      event.preventDefault();
      tap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tap]);

  const go = (step: -1 | 1) => {
    clearTimeout(advance.current);
    setAt((value) => Math.min(items.length - 1, Math.max(0, value + step)));
  };

  // The counter says what a tap counts: the next of n, a round, or a phrase.
  const single = item.parts.length === 1;
  const counter = single
    ? {
        big: String(Math.min(taps[at], total)),
        small: `of ${total}`,
        said: `${Math.min(taps[at], total)} of ${total}`,
      }
    : part.count > 1
      ? {
          big: String(done ? part.count : pos.inPart),
          small: `of ${part.count}`,
          said: `${part.title ?? ""} ${done ? part.count : pos.inPart} of ${part.count}`,
        }
      : {
          big: String(pos.round),
          small: `of ${item.rounds} ${item.rounds === 1 ? "round" : "rounds"}`,
          said: `${part.title ?? ""}, round ${pos.round} of ${item.rounds}`,
        };
  const ring = total > 0 ? Math.min(1, taps[at] / total) : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        // Nothing grabs focus on open, so no ring flashes on the close
        // button; Space and Enter count from anywhere.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="recite-session top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none"
        style={{ "--dawn": dawn } as React.CSSProperties}
      >
        <DialogTitle className="sr-only">Daily recitation</DialogTitle>
        <DialogDescription className="sr-only">
          Today&apos;s set, one recitation at a time. Tap the counter, or press
          Space, for each time you say it.
        </DialogDescription>

        {/* Top: leave, where you are in the set, and what to show. */}
        <header className="flex shrink-0 items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the reader"
            className="grid size-10 place-items-center rounded-full border border-[var(--recite-glass-edge)] bg-[var(--recite-glass)] backdrop-blur-md transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>
          <ol
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5"
            aria-label="Your set"
          >
            {items.map((it, i) => {
              const complete = taps[i] >= itemTotal(it);
              return (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={() => stage === "read" && setAt(i)}
                    aria-label={`${it.title}${complete ? ", recited" : ""}`}
                    aria-current={i === at ? "step" : undefined}
                    className="grid size-6 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "block rounded-full transition-all",
                        i === at ? "size-3" : "size-2",
                        complete
                          ? "bg-[var(--recite-sun)]"
                          : "bg-[var(--recite-bead)]",
                        i === at &&
                          !complete &&
                          "ring-2 ring-[var(--recite-sun)] ring-offset-1 ring-offset-transparent",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ol>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="What to show"
                className="grid size-10 place-items-center rounded-full border border-[var(--recite-glass-edge)] bg-[var(--recite-glass)] backdrop-blur-md transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show beneath the Arabic</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={show.transliteration}
                onCheckedChange={(value) =>
                  setShow((s) => ({ ...s, transliteration: value === true }))
                }
              >
                Transliteration
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={show.translation}
                onCheckedChange={(value) =>
                  setShow((s) => ({ ...s, translation: value === true }))
                }
              >
                Translation
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {stage === "done" ? (
          <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-6 text-center sm:px-8">
            <div className="space-y-2">
              <p
                className="recite-arabic text-3xl leading-[1.8] text-[var(--recite-marker)]"
                lang="ar"
                dir="rtl"
              >
                تَقَبَّلَ ٱللَّهُ
              </p>
              <p className="font-display text-3xl leading-tight sm:text-4xl">
                Today&apos;s set is recited
              </p>
              <p className="text-[var(--recite-ink-muted)]">
                May Allah accept it from you.
              </p>
            </div>
            <div className="w-full shrink-0 overflow-hidden rounded-2xl ring-1 ring-[var(--recite-glass-edge)]">
              <div className="relative aspect-[2/1]">
                <OasisScene
                  level={shownLevel}
                  fresh={shownLevel === after ? grown : []}
                  label={false}
                />
              </div>
            </div>
            <div className="space-y-1">
              {brought ? (
                <p className="text-sm font-medium">
                  The oasis grew:{" "}
                  <span className="rounded-full border border-[var(--recite-glass-edge)] bg-[var(--recite-glass)] px-2.5 py-0.5">
                    {brought.name.charAt(0).toUpperCase() +
                      brought.name.slice(1)}
                  </span>
                </p>
              ) : (
                <p className="text-sm font-medium">
                  {tending.today
                    ? "The oasis already counts today."
                    : "Today keeps the oasis as it is."}
                </p>
              )}
              <p className="text-xs text-[var(--recite-ink-muted)]">
                {after === TEND_DAYS ? wholeLine(SCENE) : stageLine(after)}
              </p>
            </div>
          </main>
        ) : (
          <div
            ref={body}
            className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]"
          >
            <article className="mx-auto w-full max-w-2xl px-5 pt-4 pb-10 text-center sm:px-8">
              <header className="mb-6 space-y-1">
                {item.arabicTitle && (
                  <p
                    className="recite-arabic text-2xl leading-[1.8] text-[var(--recite-marker)]"
                    lang="ar"
                    dir="rtl"
                  >
                    {item.arabicTitle}
                  </p>
                )}
                <h2 className="font-display text-2xl leading-tight sm:text-3xl">
                  {item.title}
                </h2>
                <p className="text-xs text-[var(--recite-ink-muted)]">
                  {at + 1} of {items.length} · {item.ref}
                </p>
                {item.parts.length > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                    {item.parts.map((p, i) => (
                      <span
                        key={i}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs",
                          i === pos.part
                            ? "border-[var(--recite-sun)] bg-[var(--recite-glass)] font-medium"
                            : "border-[var(--recite-line)] text-[var(--recite-ink-muted)]",
                        )}
                      >
                        {p.title}
                        {p.count > 1 && ` ×${p.count}`}
                      </span>
                    ))}
                    {item.rounds > 1 && (
                      <span className="text-xs text-[var(--recite-ink-muted)]">
                        · round {pos.round} of {item.rounds}
                      </span>
                    )}
                  </div>
                )}
                {item.note && (
                  <p className="mx-auto max-w-md pt-2 text-xs text-[var(--recite-ink-muted)]">
                    {item.note}
                  </p>
                )}
              </header>

              {part.bismillah && (
                <p
                  className="recite-arabic mb-5 text-2xl leading-[2] sm:text-[1.7rem]"
                  lang="ar"
                  dir="rtl"
                >
                  {BISMILLAH}
                </p>
              )}

              <div className="space-y-7">
                {part.verses.map((verse, i) => (
                  <section key={i} className="space-y-2.5">
                    {verse.ar && (
                      <p
                        className="recite-arabic text-[1.75rem] leading-[2.25] sm:text-[2.15rem] sm:leading-[2.3]"
                        lang="ar"
                        dir="rtl"
                      >
                        {verse.ar}
                      </p>
                    )}
                    {show.transliteration && verse.tr && (
                      <p className="mx-auto max-w-prose text-[0.95rem] leading-relaxed text-[var(--recite-ink-muted)] italic">
                        {verse.tr}
                      </p>
                    )}
                    {show.translation && verse.en && (
                      <p className="mx-auto max-w-prose text-[0.95rem] leading-relaxed">
                        {verse.en}
                      </p>
                    )}
                    {part.verses.length > 1 && i < part.verses.length - 1 && (
                      <span
                        aria-hidden
                        className="mx-auto block h-px w-16 bg-[var(--recite-line)]"
                      />
                    )}
                  </section>
                ))}
              </div>

              {/* Folded away so the words come first. */}
              <details className="group mt-10 text-left">
                <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-[var(--recite-line)] px-3 py-1.5 text-xs text-[var(--recite-ink-muted)] transition hover:text-[var(--recite-ink)] focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none">
                  {item.hadith.length > 0
                    ? "Why it's said, and where the words come from"
                    : "Where the words come from"}
                </summary>
                <HadithNote
                  className="mt-4"
                  hadith={item.hadith}
                  sources={item.parts.flatMap((p) =>
                    p.sources ? [p.sources] : [],
                  )}
                />
              </details>
            </article>
          </div>
        )}

        {/* Bottom: the counter, and the way between recitations. */}
        <footer className="shrink-0 border-t border-[var(--recite-line)] bg-[var(--recite-glass)] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:pb-6">
          {stage === "done" ? (
            <div className="flex justify-center">
              <Button
                type="button"
                autoFocus
                onClick={onClose}
                className="min-w-40 rounded-full bg-[var(--recite-accent)] text-[var(--recite-accent-ink)] hover:bg-[var(--recite-accent)]/90"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="mx-auto flex max-w-md flex-col items-center gap-2">
              {failed && (
                <p role="alert" className="text-destructive text-sm">
                  Couldn&apos;t keep the day. Check your connection, then tap
                  Keep today.
                </p>
              )}
              <div className="flex w-full items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={at === 0}
                  aria-label="Previous recitation"
                  className="grid size-11 place-items-center rounded-full text-[var(--recite-ink-muted)] transition hover:text-[var(--recite-ink)] focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none disabled:opacity-30"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>

                {finished ? (
                  <Button
                    type="button"
                    onClick={() => void finish()}
                    disabled={stage !== "read"}
                    className="h-14 min-w-44 rounded-full bg-[var(--recite-accent)] text-base text-[var(--recite-accent-ink)] hover:bg-[var(--recite-accent)]/90"
                  >
                    {stage === "saving" ? "Keeping…" : "Keep today"}
                  </Button>
                ) : total === 1 ? (
                  <Button
                    type="button"
                    onClick={tap}
                    disabled={done || stage !== "read"}
                    className="h-14 min-w-44 rounded-full bg-[var(--recite-accent)] text-base text-[var(--recite-accent-ink)] hover:bg-[var(--recite-accent)]/90 disabled:opacity-100"
                  >
                    {done ? <Check className="size-5" aria-hidden /> : null}
                    {done ? "Recited" : "I've recited it"}
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={tap}
                    disabled={stage !== "read"}
                    aria-label={`Count one. ${counter.said.trim()}.`}
                    className="group relative grid size-28 shrink-0 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none sm:size-32"
                  >
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 size-full -rotate-90"
                      aria-hidden
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="var(--recite-glass)"
                        stroke="var(--recite-bead)"
                        strokeWidth="5"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={
                          done ? "var(--recite-accent)" : "var(--recite-sun)"
                        }
                        strokeWidth="5"
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray={`${ring * 100} 100`}
                        className="transition-[stroke-dasharray] duration-300"
                      />
                    </svg>
                    <span className="relative flex flex-col items-center leading-none transition-transform group-active:scale-95">
                      {done ? (
                        <Check
                          className="size-9 text-[var(--recite-accent)]"
                          aria-hidden
                        />
                      ) : (
                        <>
                          <span
                            className="font-display text-4xl tabular-nums sm:text-5xl"
                            aria-live="polite"
                          >
                            {counter.big}
                          </span>
                          <span className="mt-1 text-[0.7rem] text-[var(--recite-ink-muted)]">
                            {counter.small}
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={at === items.length - 1}
                  aria-label="Next recitation"
                  className="grid size-11 place-items-center rounded-full text-[var(--recite-ink-muted)] transition hover:text-[var(--recite-ink)] focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none disabled:opacity-30"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
              <p className="text-xs text-[var(--recite-ink-muted)]">
                {stage === "saving" ? (
                  "Keeping today…"
                ) : done ? (
                  "Recited."
                ) : total > 1 ? (
                  <>
                    Tap for each time, or press Space ·{" "}
                    <button
                      type="button"
                      onClick={recitedAll}
                      className="underline underline-offset-2 hover:text-[var(--recite-ink)] focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none"
                    >
                      I&apos;ve said all {total}
                    </button>
                  </>
                ) : (
                  "Read it through, then mark it."
                )}
              </p>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
