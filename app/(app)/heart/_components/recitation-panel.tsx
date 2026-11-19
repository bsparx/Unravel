"use client";

import { BookOpenText, Check, RotateCcw, Settings2 } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { SceneCard } from "@/components/scenes/scene-card";
import { Button } from "@/components/ui/button";
import type { RecitationView } from "@/lib/heart-data";
import { TIME_LABEL, itemTotal } from "@/lib/recitations";
import { cn } from "@/lib/utils";

/** An eight-point star, the set's numerals sit inside it. */
function StarNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full">
        <path
          d="M20 2 L24.6 8.9 L32.7 7.3 L31.1 15.4 L38 20 L31.1 24.6 L32.7 32.7 L24.6 31.1 L20 38 L15.4 31.1 L7.3 32.7 L8.9 24.6 L2 20 L8.9 15.4 L7.3 7.3 L15.4 8.9 Z"
          fill={done ? "var(--recite-sun)" : "var(--recite-glass)"}
          stroke={done ? "var(--recite-sun)" : "var(--recite-marker)"}
          strokeOpacity={done ? 1 : 0.45}
          strokeWidth={1.4}
        />
      </svg>
      <span className={cn("relative font-mono text-xs tabular-nums", done && "text-white")}>
        {done ? <Check className="size-3.5" /> : n}
      </span>
    </span>
  );
}

/**
 * The recitation tab: the oasis, then today's set on a dawn-coloured card
 * with the one thing to do (Begin, or Recite again once it's kept), and the
 * way to change what's in it.
 */
export function RecitationPanel({
  view,
  onBegin,
  onCustomize,
  onUndo,
}: {
  view: RecitationView;
  /** Open the reader; `at` opens on that recitation, `again` starts every count afresh. */
  onBegin: (at?: number, again?: boolean) => void;
  onCustomize: () => void;
  onUndo: () => void;
}) {
  const { items, tending } = view;
  const done = tending.today;
  const counts = items.reduce((sum, item) => sum + itemTotal(item), 0);

  return (
    <div className="space-y-6">
      <SceneCard tab="recitation" tending={tending} />

      <section
        aria-labelledby="recite-today"
        className="recite-sky overflow-hidden rounded-3xl ring-1 ring-[var(--recite-glass-edge)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-[var(--recite-ink-muted)] uppercase">
              Today&apos;s set <InfoTip term="recitation" className="ml-0.5 align-middle" />
            </p>
            <h2 id="recite-today" className="font-display mt-1 text-3xl leading-tight">
              {done ? "Recited today" : "Ready when you are"}
            </h2>
            <p className="mt-1 text-sm text-[var(--recite-ink-muted)]">
              {items.length} {items.length === 1 ? "recitation" : "recitations"} · {counts.toLocaleString("en-GB")}{" "}
              {counts === 1 ? "time" : "times"} said in all
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onCustomize}
            className="rounded-full border border-[var(--recite-glass-edge)] bg-[var(--recite-glass)] text-[var(--recite-ink)] backdrop-blur-md hover:bg-[var(--recite-glass)] hover:brightness-105"
          >
            <Settings2 className="size-4" aria-hidden />
            Customize
          </Button>
        </div>

        <ol className="mt-5 space-y-2 px-3 sm:px-5">
          {items.map((item, index) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onBegin(index, done)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--recite-glass-edge)] bg-[var(--recite-glass)] px-3 py-3 text-left backdrop-blur-md transition hover:brightness-[1.03] focus-visible:ring-2 focus-visible:ring-[var(--recite-accent)] focus-visible:outline-none sm:px-4"
              >
                <StarNumber n={index + 1} done={done} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{item.title}</span>
                    {item.arabicTitle && (
                      <span className="recite-arabic shrink-0 text-lg leading-none text-[var(--recite-marker)]" lang="ar" dir="rtl">
                        {item.arabicTitle}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--recite-ink-muted)]">
                    <span className="rounded-full border border-[var(--recite-line)] px-2 py-0.5 font-mono tabular-nums">
                      ×{item.rounds}
                    </span>
                    {item.parts.length > 1 && (
                      <span>
                        {item.parts.map((part) => part.title).join(" · ")}
                      </span>
                    )}
                    {item.when && item.parts.length === 1 && <span>{TIME_LABEL[item.when]}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-center gap-3 px-5 pt-6 pb-6 sm:px-7 sm:pb-7">
          {done ? (
            <>
              <p className="text-center text-sm text-[var(--recite-ink-muted)]">
                The oasis keeps today. Reciting again is still yours to do.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => onBegin(0, true)}
                  className="h-12 rounded-full bg-[var(--recite-accent)] px-6 text-[var(--recite-accent-ink)] hover:bg-[var(--recite-accent)]/90"
                >
                  <BookOpenText className="size-4" aria-hidden />
                  Recite again
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onUndo}
                  className="h-12 rounded-full text-[var(--recite-ink-muted)] hover:bg-[var(--recite-glass)] hover:text-[var(--recite-ink)]"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Not yet, take today back
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => onBegin()}
              className="h-12 min-w-48 rounded-full bg-[var(--recite-accent)] px-8 text-base text-[var(--recite-accent-ink)] shadow-[0_10px_30px_-10px_var(--recite-accent)] hover:bg-[var(--recite-accent)]/90"
            >
              <BookOpenText className="size-4" aria-hidden />
              Begin
            </Button>
          )}
        </div>
      </section>

      <details className="group text-sm text-[var(--recite-ink-muted)]">
        <summary className="hover:text-foreground cursor-pointer list-none text-center text-xs underline-offset-4 hover:underline">
          Where the words come from
        </summary>
        <p className="mx-auto mt-2 max-w-prose text-center text-xs leading-relaxed">
          Quran: the IndoPak script, ayah by ayah, from the Quranic Universal Library (Tarteel), drawn in the Digital
          Khatt IndoPak font; the word-by-word transliteration and the Saheeh International translation from
          quran.com. Remembrance and blessings are not in the Quran, so their Arabic is taken from the hadith that
          teaches them, with the transliteration and translation from the hadith&apos;s own English or Hisn
          al-Muslim. Every recitation carries its hadith, Sahih only, verbatim, with a link to it on sunnah.com.
          Learn the recitation from a teacher where you can; this is a companion, not a substitute.
        </p>
      </details>
    </div>
  );
}
