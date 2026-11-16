"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Feather, Lamp, MoonStar, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { InfoTip } from "@/components/info-tip";
import { PracticePageCard } from "@/components/practice-page-card";
import { PracticeTemplatePicker, type TemplateChoice } from "@/components/practice-template-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PracticeView } from "@/lib/mind-data";
import { cn } from "@/lib/utils";
import {
  templateLabel,
  templateOrDefault,
  type PracticeKind,
  type PracticePage,
} from "@/lib/practices";

import { deletePractice, setPracticeTemplate } from "../actions";
import { CardTools, SkyEmpty } from "./shared";

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

  useEffect(
    () => () => {
      const waiting = queued.current;
      if (!waiting) return;
      clearTimeout(waiting.timer);
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("template", waiting.next.template);
      formData.set("count", String(waiting.next.count));
      void setPracticeTemplate(formData);
    },
    [kind],
  );

  const chooseTemplate = (next: TemplateChoice) => {
    setChoice(next);
    if (queued.current) clearTimeout(queued.current.timer);
    queued.current = { timer: setTimeout(() => save(next), 450), next };
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* The template, always in reach. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="font-display text-title">Today</h2>
          <InfoTip term={copy.term} />
        </div>

        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-full">
                <Settings2 className="size-3.5" aria-hidden />
                <span className="text-muted-foreground">Template:</span>
                {templateLabel(template, choice.count)}
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
            <PracticePageCard
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

      {/* Two weeks of dots. Written or not; no streak is counted, and a gap
          is just a day. */}
      <section aria-label="The last two weeks" className="space-y-2">
        <div className="flex items-center gap-1">
          <p className="text-muted-foreground text-micro font-medium tracking-wider uppercase">Last two weeks</p>
        </div>
        <ol className="flex flex-wrap gap-1.5">
          {view.days.map((day) => {
            const today = day.dateISO === view.todayISO;
            return (
              <li key={day.dateISO}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={`${day.label}, ${day.written ? "written" : "no page"}`}
                      className={cn(
                        "focus-visible:ring-ring block size-4 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        day.written ? copy.dot : "border-border border bg-transparent",
                        today && "ring-foreground/30 ring-2 ring-offset-2 ring-offset-[var(--background)]",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {today ? "Today" : day.label} · {day.written ? "written" : "no page"}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The journal. */}
      {view.past.length > 0 && (
        <section aria-label={copy.earlier} className="space-y-5">
          <p className="text-muted-foreground text-micro font-medium tracking-wider uppercase">{copy.earlier}</p>
          <ol className="space-y-6">
            {view.past.slice(0, shown).map((page) => (
              <PastPage
                key={page.id}
                kind={kind}
                page={page}
                expanded={open === page.id}
                onToggle={() => setOpen(open === page.id ? null : page.id)}
              />
            ))}
          </ol>
          {view.past.length > shown && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show older
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function PastPage({
  kind,
  page,
  expanded,
  onToggle,
}: {
  kind: PracticeKind;
  page: PracticePage;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="group relative">
      <PracticePageCard
        kind={kind}
        dateLabel={page.dateLabel}
        templateName={page.templateName}
        items={page.items}
        compact={!expanded}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-2 inline-flex items-center gap-1 rounded-full pl-1 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {expanded ? "Fold it back" : "Read the whole page"}
        <ChevronDown className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")} aria-hidden />
      </button>
      <CardTools
        label={`the page from ${page.dateLabel}`}
        items={[]}
        deleteTitle={`Delete the page from ${page.dateLabel}?`}
        deleteDescription="It's gone for good."
        onDelete={() => deletePractice(page.id)}
      />
    </li>
  );
}
