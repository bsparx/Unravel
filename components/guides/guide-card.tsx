"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { FlaskConical, ListChecks, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GUIDES, type GuideKey } from "@/lib/practice-guides";
import { cn } from "@/lib/utils";

import { GuideArt } from "./guide-art";
import type { GuideTab } from "./practice-guide-sheet";

// The guide's words, examples and research load only when it's opened.
const PracticeGuideSheet = dynamic(() => import("./practice-guide-sheet"), {
  ssr: false,
});

const dismissKey = (key: GuideKey) => `guide:dismissed:${key}`;

const DISMISS_EVENT = "guide-dismissed";

function readDismissed(key: GuideKey): boolean {
  try {
    return window.localStorage.getItem(dismissKey(key)) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}

/**
 * Whether this device has waved the welcome away. The server assumes not:
 * nearly everyone seeing a welcome hasn't dismissed it, so they get it on
 * first paint, and the rare one who has sees it swap to the row on hydration.
 */
function useDismissed(key: GuideKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readDismissed(key),
    () => false,
  );
}

/** The sheet's open state and tab, for whatever opens it. */
function useGuideSheet() {
  const [tab, setTab] = useState<GuideTab>("how");
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept, so closing animates out.
  const [mounted, setMounted] = useState(false);
  const show = (next: GuideTab) => {
    setTab(next);
    setMounted(true);
    setOpen(true);
  };
  return { tab, setTab, open, setOpen, mounted, show };
}

/**
 * Under each practice's scene: a welcome for someone who hasn't done it yet
 * (a moving picture, three steps, an example and the research), and once
 * they have, or once they wave it away, a quiet row with the same two ways
 * in. The welcome's dismissal is remembered on this device only.
 */
export function GuideCard({
  guide: key,
  firstTime,
}: {
  guide: GuideKey;
  firstTime: boolean;
}) {
  const guide = GUIDES[key];
  const sheet = useGuideSheet();
  const dismissed = useDismissed(key);

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey(key), "1");
    } catch {
      // Private mode: it just comes back next visit.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  const welcome = firstTime && !dismissed;

  return (
    <>
      {welcome ? (
        <section
          aria-labelledby={`guide-${key}`}
          className={cn(
            "relative isolate overflow-hidden rounded-3xl px-5 py-6 text-[var(--woop-ink)] ring-1 ring-[var(--woop-glass-edge)] shadow-[0_24px_60px_-38px_rgba(40,30,90,0.55)] sm:px-8 sm:py-7",
            guide.sky,
          )}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label={`Hide the ${guide.title.toLowerCase()} welcome`}
            className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-[var(--woop-ink-muted)] transition hover:bg-[var(--woop-hover)] hover:text-[var(--woop-ink)] focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>

          <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-8">
            <GuideArt guide={key} className="mx-auto max-w-56 sm:max-w-none" />

            <div className="space-y-4">
              <div className="space-y-1 pr-8">
                <p className="flex items-center gap-1.5 text-micro font-medium tracking-wide text-[var(--woop-ink-muted)] uppercase">
                  <Sparkles className="size-3.5" aria-hidden />
                  New here? Start with this
                </p>
                <h2
                  id={`guide-${key}`}
                  className="font-display text-title leading-snug"
                >
                  {guide.promise}
                </h2>
              </div>

              <ol className="space-y-2.5">
                {guide.steps.map((step, i) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2.5"
                  >
                    <span className="font-display grid size-7 place-items-center rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] text-sm tabular-nums">
                      {i + 1}
                    </span>
                    <p className="text-label pt-1 leading-snug">
                      <span className="font-medium">{step.title}.</span>{" "}
                      <span className="text-[var(--woop-ink-muted)]">
                        {step.body}
                      </span>
                    </p>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => sheet.show("example")}
                  className="rounded-full bg-[var(--woop-ink)] text-[var(--woop-on-ink)] hover:bg-[var(--woop-ink)]/90"
                >
                  <ListChecks className="size-4" aria-hidden />
                  See an example
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => sheet.show("research")}
                  className="rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] text-[var(--woop-ink)] hover:bg-[var(--woop-solid)]"
                >
                  <FlaskConical className="size-4" aria-hidden />
                  Research on this
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <GuideChip
            onClick={() => sheet.show("how")}
            icon={<ListChecks className="size-3.5" aria-hidden />}
          >
            How it works
          </GuideChip>
          <GuideChip
            onClick={() => sheet.show("research")}
            icon={<FlaskConical className="size-3.5" aria-hidden />}
          >
            Research on this
          </GuideChip>
        </div>
      )}

      {sheet.mounted && (
        <PracticeGuideSheet
          guide={key}
          tab={sheet.tab}
          onTabChange={sheet.setTab}
          open={sheet.open}
          onOpenChange={sheet.setOpen}
        />
      )}
    </>
  );
}

function GuideChip({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * "Research on this" beside a practice's switch in Settings. A plain button,
 * never a submit: it sits inside the settings form.
 */
export function ResearchLink({ guide: key }: { guide: GuideKey }) {
  const sheet = useGuideSheet();
  return (
    <>
      <button
        type="button"
        onClick={() => sheet.show("research")}
        className="text-primary focus-visible:ring-ring inline-flex w-fit items-center gap-1 rounded text-label font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        <FlaskConical className="size-3.5" aria-hidden />
        Research on this
        <span className="sr-only">: {GUIDES[key].title}</span>
      </button>
      {sheet.mounted && (
        <PracticeGuideSheet
          guide={key}
          tab={sheet.tab}
          onTabChange={sheet.setTab}
          open={sheet.open}
          onOpenChange={sheet.setOpen}
        />
      )}
    </>
  );
}
