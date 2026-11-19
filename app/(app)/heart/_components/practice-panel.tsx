"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Feather, Lamp, MoonStar, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { InfoTip } from "@/components/info-tip";
import { SceneCard } from "@/components/scenes/scene-card";
import { DuaArch, DuaWindow } from "@/components/dua-arch";
import { GratitudeEvening, GratitudePage } from "@/components/gratitude-page";
import { PracticeTemplatePicker, type TemplateChoice } from "@/components/practice-template-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PracticeView } from "@/lib/heart-data";
import {
  templateLabel,
  templateOrDefault,
  type PracticeKind,
  type PracticePage,
} from "@/lib/practices";

import { deletePractice, setPracticeTemplate } from "../actions";
import { CardTools, SkyEmpty } from "@/components/panel-shared";

export type PracticeWriteMode = "new" | "edit" | "rewrite";

const COPY: Record<
  PracticeKind,
  { emptyTitle: string; emptyBody: string; earlier: string; dot: string; term: "gratitude" | "dua" }
> = {
  gratitude: {
    emptyTitle: "Today's page is blank",
    emptyBody: "Light a lantern for each good thing from today.",
    earlier: "Earlier pages",
    dot: "bg-[var(--thanks-lantern)]",
    term: "gratitude",
  },
  dua: {
    emptyTitle: "Nothing asked yet today",
    emptyBody: "Write what you're asking for, from the first praise to ameen.",
    earlier: "Earlier du'as",
    dot: "bg-[var(--dua-accent)]",
    term: "dua",
  },
};

const PAGE_SIZE = 14;

/**
 * A daily practice: today's page on top, two quiet weeks of dots, and the
 * pages before. Writing is once a day; today's page can be reopened and
 * rewritten until midnight, and the past is a journal you read.
 */
export function PracticePanel({
  kind,
  view,
  onWrite,
}: {
  kind: PracticeKind;
  view: PracticeView;
  onWrite: (mode: PracticeWriteMode) => void;
}) {
  const copy = COPY[kind];
  // Local so the chip answers at once; the server action follows.
  const [choice, setChoice] = useState<TemplateChoice>({ template: view.template, count: view.count });
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<string | null>(null);

  const template = templateOrDefault(kind, choice.template);
  // How many steps today's page was written with, for the counted template.
  const todayCount = view.today ? new Set(view.today.items.map((item) => item.key.split(":")[0])).size : 0;
  const changed =
    view.today !== null &&
    (view.today.template !== template.id || (Boolean(template.counted) && todayCount !== choice.count));
  const todayLabel = view.today
    ? view.today.template === template.id && template.counted
      ? templateLabel(template, todayCount)
      : view.today.templateName
    : "";

  // Clicking the stepper from 3 to 10 is seven clicks; saving each one
  // queued seven round trips, and leaving the page mid-queue stored a
  // number in between. Saves are debounced so only where you stop is sent,
  // and a save still waiting when the panel goes away is sent on the way out.
  const saved = useRef<TemplateChoice>({ template: view.template, count: view.count });
  const queued = useRef<{ timer: ReturnType<typeof setTimeout>; next: TemplateChoice } | null>(null);

  const save = (next: TemplateChoice) => {
    queued.current = null;
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("template", next.template);
    formData.set("count", String(next.count));
    startTransition(async () => {
      try {
        const state = await setPracticeTemplate(formData);
        if (state.status === "error") throw new Error(state.message);
        saved.current = next;
      } catch {
        setChoice(saved.current);
        toast.error("Couldn't change the template. Try again.");
      }
    });
  };

  // Saved when the popover closes, too, and sent on the way out if the
  // panel goes (another tab or page) or the browser tab does (a reload).
  const flush = () => {
    const waiting = queued.current;
    if (!waiting) return;
    clearTimeout(waiting.timer);
    save(waiting.next);
  };

  useEffect(() => {
    const leave = () => {
      const waiting = queued.current;
      if (!waiting) return;
      clearTimeout(waiting.timer);
      queued.current = null;
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("template", waiting.next.template);
      formData.set("count", String(waiting.next.count));
      void setPracticeTemplate(formData);
    };
    globalThis.addEventListener("pagehide", leave);
    return () => {
      globalThis.removeEventListener("pagehide", leave);
      leave();
    };
  }, [kind]);

  const chooseTemplate = (next: TemplateChoice) => {
    setChoice(next);
    if (queued.current) clearTimeout(queued.current.timer);
    queued.current = { timer: setTimeout(() => save(next), 450), next };
  };

  return (
    <div className="space-y-10">
      <SceneCard tab={kind} tending={view.tending} />

      <div className="mx-auto max-w-2xl space-y-10">
      {/* The template, always in reach. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="font-display text-title">Today</h2>
          <InfoTip term={copy.term} />
        </div>

        <div className="flex max-w-full min-w-0 items-center gap-1">
          <Popover onOpenChange={(open) => !open && flush()}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="max-w-full min-w-0 rounded-full">
                <Settings2 className="size-3.5" aria-hidden />
                <span className="text-muted-foreground">Template:</span>
                <span className="min-w-0 truncate">{templateLabel(template, choice.count)}</span>
                <ChevronDown className="size-3.5 opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[min(36rem,75dvh)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto p-4">
              <div className="mb-3 flex items-center gap-1">
                <p className="text-body font-medium">
                  {kind === "gratitude" ? "How to write gratitude" : "How to write du'a"}
                </p>
                <InfoTip term="template" />
              </div>
              <PracticeTemplatePicker kind={kind} value={choice} onChange={chooseTemplate} />
              <p aria-live="polite" className="text-muted-foreground text-micro mt-3">
                {pending ? "Saving…" : "Saved as you choose. Pages you've already written keep their own template."}
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Today. */}
      <section aria-label="Today's page" className="space-y-3">
        {view.today ? (
          <div className="group relative">
            <PracticeCard
              kind={kind}
              dateLabel={view.today.dateLabel}
              templateName={view.today.templateName}
              items={view.today.items}
            />
            <CardTools
              label="today's page"
              items={[{ label: "Edit today's page", icon: Feather, onSelect: () => onWrite("edit") }]}
              deleteTitle="Delete today's page?"
              deleteDescription="It's gone for good. You can write today's page again afterwards."
              onDelete={() => deletePractice(view.today!.id)}
            />
          </div>
        ) : (
          <SkyEmpty
            sky={kind === "gratitude" ? "thanks-sky-early" : "dua-sky-maghrib"}
            icon={kind === "gratitude" ? <Lamp className="size-4" aria-hidden /> : <MoonStar className="size-4" aria-hidden />}
            title={copy.emptyTitle}
            body={copy.emptyBody}
            action="Write today's page"
            onAction={() => onWrite("new")}
          >
            <p className="text-micro text-[var(--woop-ink-muted)]">
              {templateLabel(template, choice.count)} · about {template.minutes(choice.count)} min
            </p>
          </SkyEmpty>
        )}

        {changed && (
          <p className="text-muted-foreground text-label pl-1">
            Today&apos;s page used <span className="text-foreground">{todayLabel}</span>.{" "}
            <span className="text-foreground">{templateLabel(template, choice.count)}</span> starts tomorrow, or{" "}
            <button
              type="button"
              onClick={() => onWrite("rewrite")}
              className="text-primary focus-visible:ring-ring rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              rewrite today with it
            </button>
            .
          </p>
        )}
      </section>

      {/* The journal: gratitude as a list of evenings, du'a as a wall of
          windows. */}
      {view.past.length > 0 && (
        <section aria-label={copy.earlier} className="space-y-5">
          <h3 className="text-body font-medium">{copy.earlier}</h3>
          {kind === "gratitude" ? (
            <ol className="space-y-3">
              {view.past.slice(0, shown).map((page) => (
                <PastEvening
                  key={page.id}
                  page={page}
                  expanded={open === page.id}
                  onToggle={() => setOpen(open === page.id ? null : page.id)}
                />
              ))}
            </ol>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {view.past.slice(0, shown).map((page) => (
                <li key={page.id}>
                  <DuaWindow
                    dateLabel={page.dateLabel}
                    templateName={page.templateName}
                    items={page.items}
                    onOpen={() => setOpen(page.id)}
                  />
                </li>
              ))}
            </ol>
          )}
          {view.past.length > shown && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show older
            </Button>
          )}
        </section>
      )}

      </div>

      {kind === "dua" && (
        <PastDua
          page={view.past.find((page) => page.id === open) ?? null}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** Today's page, in its practice's own form. */
function PracticeCard({
  kind,
  ...page
}: {
  kind: PracticeKind;
  dateLabel?: string;
  templateName: string;
  items: PracticePage["items"];
}) {
  return kind === "gratitude" ? <GratitudePage {...page} /> : <DuaArch {...page} />;
}

/** A past evening: folded to one row, opened to the whole lantern page. */
function PastEvening({
  page,
  expanded,
  onToggle,
}: {
  page: PracticePage;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <GratitudeEvening dateLabel={page.dateLabel} items={page.items} expanded={expanded} onToggle={onToggle} />
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 group relative mt-3 duration-200">
          <GratitudePage templateName={page.templateName} items={page.items} />
          <CardTools
            label={`the page from ${page.dateLabel}`}
            items={[]}
            deleteTitle={`Delete the page from ${page.dateLabel}?`}
            deleteDescription="It's gone for good."
            onDelete={() => deletePractice(page.id)}
          />
        </div>
      )}
    </li>
  );
}

/**
 * A past du'a, opened from its window: the whole arch, in a dialog of its
 * own, so the wall of windows doesn't reflow under you.
 */
function PastDua({ page, onClose }: { page: PracticePage | null; onClose: () => void }) {
  const reading = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={page !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        sheetOnPhone
        className="gap-3 p-3 max-sm:content-start max-sm:pt-[max(0.75rem,env(safe-area-inset-top))] max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-w-xl lg:max-w-2xl"
        // Land on the page, not on its delete button (the first control).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          reading.current?.focus({ preventScroll: true });
        }}
      >
        {page && (
          <>
            <DialogTitle className="sr-only">Du&apos;a from {page.dateLabel}</DialogTitle>
            <DialogDescription className="sr-only">{page.templateName}</DialogDescription>
            <div ref={reading} tabIndex={-1} className="group relative outline-none">
              <DuaArch dateLabel={page.dateLabel} templateName={page.templateName} items={page.items} />
              <CardTools
                label={`the du'a from ${page.dateLabel}`}
                items={[]}
                className="md:opacity-100"
                deleteTitle={`Delete the du'a from ${page.dateLabel}?`}
                deleteDescription="It's gone for good."
                onDelete={async () => {
                  await deletePractice(page.id);
                  onClose();
                }}
              />
            </div>
            {/* On a phone the du'a is the whole screen and can run long, so
                the way out stays in reach at the bottom. */}
            <Button
              type="button"
              variant="ghost"
              className="justify-self-center rounded-full max-sm:sticky max-sm:bottom-[max(0.5rem,env(safe-area-inset-bottom))] max-sm:border max-sm:border-border max-sm:bg-background/85 max-sm:px-6 max-sm:backdrop-blur"
              onClick={onClose}
            >
              Close
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
