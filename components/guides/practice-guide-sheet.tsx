"use client";

import {
  BookOpen,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  ListChecks,
  TriangleAlert,
} from "lucide-react";

import { Words } from "@/components/hadith-note";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EVIDENCE_LABEL,
  GUIDES,
  type GuideKey,
  type ResearchItem,
} from "@/lib/practice-guides";
import { cn } from "@/lib/utils";

import { GuideArt } from "./guide-art";
import { GuideExample } from "./guide-examples";

export type GuideTab = "how" | "example" | "research";

/**
 * Everything a beginner needs about one practice, in three tabs: how it
 * works, a filled-in example drawn with the real components, and what the
 * research (and, for the heart's practices, the Quran and sunnah) says.
 * Loaded on demand, so the panels don't carry it.
 */
export default function PracticeGuideSheet({
  guide: key,
  tab,
  onTabChange,
  open,
  onOpenChange,
}: {
  guide: GuideKey;
  tab: GuideTab;
  onTabChange: (tab: GuideTab) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guide = GUIDES[key];
  const scripture = guide.research.filter(
    (r) => r.kind === "quran" || r.kind === "hadith",
  );
  const studies = guide.research.filter(
    (r) => r.kind !== "quran" && r.kind !== "hadith",
  );
  // Du'a leads with its sources; the rest lead with the studies.
  const groups =
    key === "dua"
      ? [
          { title: "In the Quran and sunnah", items: scripture },
          { title: "What studies found", items: studies },
        ]
      : [
          { title: "What studies found", items: studies },
          { title: "In the Quran and sunnah", items: scripture },
        ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-background gap-0 overflow-y-auto max-sm:data-[side=right]:w-full sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="space-y-1 px-5 pt-5 pb-3 sm:px-7">
          <SheetTitle className="font-display text-2xl font-normal">
            {guide.title}
          </SheetTitle>
          <SheetDescription>{guide.promise}</SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as GuideTab)}
          className="px-5 pb-8 sm:px-7"
        >
          <TabsList className="w-full">
            <TabsTrigger value="how">How it works</TabsTrigger>
            <TabsTrigger value="example">Example</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
          </TabsList>

          <TabsContent value="how" className="mt-5 space-y-8">
            <div
              className={cn(
                "rounded-2xl px-6 py-5 text-[var(--woop-ink)] ring-1 ring-[var(--woop-glass-edge)]",
                guide.sky,
              )}
            >
              <GuideArt guide={key} className="mx-auto max-w-72" />
            </div>

            <ol className="space-y-5">
              {guide.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3"
                >
                  <span className="bg-primary/10 text-primary font-display grid size-8 place-items-center rounded-full text-base tabular-nums">
                    {i + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-body font-medium">{step.title}</p>
                    <p className="text-muted-foreground text-label leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <section className="space-y-3">
              <h3 className="text-body flex items-center gap-2 font-medium">
                <Lightbulb className="text-primary size-4" aria-hidden />
                What makes a good one
              </h3>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {guide.tips.map((tip) => (
                  <div key={tip.title} className="space-y-0.5">
                    <dt className="text-label font-medium">{tip.title}</dt>
                    <dd className="text-muted-foreground text-label">
                      {tip.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="space-y-3">
              <h3 className="text-body flex items-center gap-2 font-medium">
                <TriangleAlert
                  className="size-4 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                Common beginner mistakes
              </h3>
              <ul className="text-muted-foreground text-label list-disc space-y-1.5 pl-5">
                {guide.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>

            <button
              type="button"
              onClick={() => onTabChange("example")}
              className="text-primary text-label inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
            >
              <ListChecks className="size-4" aria-hidden />
              See a filled-in example
            </button>
          </TabsContent>

          <TabsContent value="example" className="mt-5 space-y-4">
            <p className="text-muted-foreground text-label">
              Yours will look like this. There&apos;s no wrong way to do it;
              this is just one.
            </p>
            <GuideExample guide={key} />
          </TabsContent>

          <TabsContent value="research" className="mt-5 space-y-8">
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <section key={group.title} className="space-y-3">
                  <h3 className="text-body flex items-center gap-2 font-medium">
                    {group.title === "What studies found" ? (
                      <FlaskConical
                        className="text-primary size-4"
                        aria-hidden
                      />
                    ) : (
                      <BookOpen className="text-primary size-4" aria-hidden />
                    )}
                    {group.title}
                  </h3>
                  {group.title === "What studies found" && (
                    <p className="text-muted-foreground text-micro">
                      Reading the numbers: an effect size (d) of about 0.2 is
                      small, 0.5 medium and 0.8 large. A correlation (r) runs
                      from −1 to 1; the further from 0, the stronger. A p under
                      .05 means the result is unlikely to be chance.
                    </p>
                  )}
                  <ul className="space-y-3">
                    {group.items.map((item) => (
                      <ResearchCard key={item.url + item.cite} item={item} />
                    ))}
                  </ul>
                </section>
              ))}

            <aside className="bg-muted/60 text-label space-y-1 rounded-xl px-4 py-3">
              <p className="font-medium">The honest version</p>
              <p className="text-muted-foreground leading-relaxed">
                {guide.limits}
              </p>
            </aside>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ResearchCard({ item }: { item: ResearchItem }) {
  const scripture = item.kind === "quran" || item.kind === "hadith";
  return (
    <li className="border-border space-y-2 rounded-2xl border px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
            scripture
              ? "bg-[var(--dua-accent)]/12 text-[var(--dua-accent)]"
              : "bg-primary/10 text-primary",
          )}
        >
          {EVIDENCE_LABEL[item.kind]}
        </span>
      </div>
      {item.stat ? (
        <div className="flex items-start gap-3">
          <p className="font-display text-primary shrink-0 text-3xl leading-none tabular-nums">
            {item.stat.value}
          </p>
          <div className="min-w-0 space-y-0.5">
            <p className="text-body leading-snug font-medium">{item.benefit}</p>
            <p className="text-muted-foreground text-micro">
              {item.stat.label}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-body font-medium leading-snug">{item.benefit}</p>
      )}
      {scripture ? (
        <blockquote className="text-label border-l-2 border-[var(--dua-accent)]/40 pl-3 leading-relaxed">
          <Words text={item.finding} />
        </blockquote>
      ) : (
        <p className="text-muted-foreground text-label leading-relaxed">
          {item.finding}
        </p>
      )}
      {item.note && (
        <p className="text-muted-foreground text-micro italic">{item.note}</p>
      )}
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="text-micro text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
      >
        {item.cite}
        <ExternalLink className="size-3 shrink-0" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}
