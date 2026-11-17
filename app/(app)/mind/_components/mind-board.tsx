"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { DisputationRitual } from "@/components/disputation-ritual";
import type { MeditationChoice } from "@/components/meditation/meditation-picker";
import { MeditationSession, type SessionResult } from "@/components/meditation/meditation-session";
import { primeAudio } from "@/components/meditation/sound";
import { PracticeRitual } from "@/components/practice-ritual";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WoopRitual } from "@/components/woop-ritual";
import { cn } from "@/lib/utils";
import type { DisputationCard, DisputationFields } from "@/lib/disputation";
import type { MindView } from "@/lib/mind-data";
import { MIND_TABS, type MindTab } from "@/lib/mind-tabs";
import {
  itemsToAnswers,
  templateOrDefault,
  findTemplate,
  type PracticeKind,
} from "@/lib/practices";
import type { WishCard, WoopFields } from "@/lib/woop";
import { findMeditation } from "@/lib/meditations";

import { saveDisputation, saveMeditation, savePractice, saveWish } from "../actions";
import { DisputationsPanel } from "./disputations-panel";
import { MeditatePanel } from "./meditate-panel";
import { PracticePanel, type PracticeWriteMode } from "./practice-panel";
import { WishesPanel } from "./wishes-panel";


type Editing =
  | { kind: "wish"; card: WishCard | null }
  | { kind: "disputation"; card: DisputationCard | null }
  | { kind: "practice"; practice: PracticeKind; mode: PracticeWriteMode }
  | { kind: "meditation"; choice: MeditationChoice; before: number }
  | null;

const LABELS: Record<MindTab, string> = {
  gratitude: "Gratitude",
  dua: "Du'a",
  meditate: "Meditate",
  wishes: "Wishes",
  disputations: "Disputations",
};

/**
 * /mind: up to four practices behind one switch. The two daily pages come
 * first, because they're the ones you open every day; wishes and
 * disputations are there for when you need them.
 */
export function MindBoard({
  initialTab,
  view,
}: {
  initialTab: MindTab;
  view: MindView;
}) {
  const { enabled, active, settled, disputations } = view;
  const tabs = MIND_TABS.filter((tab) => enabled[tab]);
  const [tab, setTab] = useState<MindTab>(initialTab);
  const [editing, setEditing] = useState<Editing>(null);
  const selectedTab = useRef<HTMLButtonElement>(null);

  // On a phone the tab row scrolls; keep the open tab in view (a link to
  // ?tab=wishes otherwise lands with Wishes hidden off the right edge).
  useEffect(() => {
    selectedTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  // The tab lives in the URL so a reload lands where you were. Native
  // history keeps it a URL change, not a server round trip.
  const switchTab = (next: MindTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === tabs[0]) url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const onSaveWish = async (fields: WoopFields, id?: string) => {
    const formData = new FormData();
    if (id) formData.set("id", id);
    formData.set("wish", fields.wish);
    formData.set("outcome", fields.outcome);
    formData.set("obstacle", fields.obstacle);
    formData.set("plan", fields.plan);
    try {
      const state = await saveWish(formData);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      setEditing(null);
      toast.success(id ? "Wish rewritten." : "Wish sealed.");
      return true;
    } catch {
      toast.error("Couldn't save that. What you wrote is still here.");
      return false;
    }
  };

  const onSaveDisputation = async (fields: DisputationFields, id?: string) => {
    const formData = new FormData();
    if (id) formData.set("id", id);
    const keys: (keyof DisputationFields)[] = [
      "adversity", "belief", "beliefBefore", "consequences", "evidence",
      "alternatives", "implications", "usefulness", "energization", "beliefAfter",
    ];
    for (const key of keys) {
      const value = fields[key];
      formData.set(key, value === null ? "" : String(value));
    }
    try {
      const state = await saveDisputation(formData);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      setEditing(null);
      toast.success(id ? "Disputation updated." : "Filed. Well argued.");
      return true;
    } catch {
      toast.error("Couldn't save that. What you wrote is still here.");
      return false;
    }
  };

  const onSavePractice = async (
    practice: PracticeKind,
    template: string,
    count: number,
    answers: Record<string, string>,
  ) => {
    const formData = new FormData();
    formData.set("kind", practice);
    formData.set("template", template);
    formData.set("count", String(count));
    formData.set("answers", JSON.stringify(answers));
    try {
      const state = await savePractice(formData);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      setEditing(null);
      toast.success(practice === "gratitude" ? "Kept. Every lantern lit." : "Written. Ameen.");
      return true;
    } catch {
      toast.error("Couldn't save that. What you wrote is still here.");
      return false;
    }
  };

  const onSaveMeditation = async (choice: MeditationChoice, result: SessionResult) => {
    const formData = new FormData();
    formData.set("kind", choice.kind);
    formData.set("options", JSON.stringify(choice.options));
    formData.set("seconds", String(result.seconds));
    if (result.count !== null) formData.set("count", String(result.count));
    formData.set("completed", String(result.completed));
    formData.set("startedAt", result.startedAt.toISOString());
    try {
      const state = await saveMeditation(formData);
      return state.status !== "error";
    } catch {
      return false;
    }
  };

  const satToday = (view.meditation.days.at(-1)?.minutes ?? 0) > 0;

  const showNew =
    (tab === "wishes" && active.length > 0) || (tab === "disputations" && disputations.length > 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {/* Scrolls rather than wraps on a phone: four pills don't fit 375px. */}
        <div className="-mx-5 max-w-[calc(100%+2.5rem)] overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:px-0">
          <div
            role="tablist"
            aria-label="Mind sections"
            className="border-border bg-muted/40 inline-flex rounded-full border p-1"
          >
            {tabs.map((value) => {
              const selected = tab === value;
              const daily = value === "gratitude" || value === "dua" || value === "meditate";
              const writtenToday =
                value === "meditate" ? satToday : daily && view[value as "gratitude" | "dua"].today !== null;
              return (
                <button
                  key={value}
                  ref={selected ? selectedTab : undefined}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`mind-${value}`}
                  onClick={() => switchTab(value)}
                  className={cn(
                    "focus-visible:ring-ring inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-label font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LABELS[value]}
                  {daily ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            writtenToday
                              ? value === "gratitude"
                                ? "bg-[var(--thanks-lantern)]"
                                : value === "meditate"
                                  ? "bg-[var(--garden-light)]"
                                  : "bg-[var(--dua-accent)]"
                              : "border-muted-foreground/50 border",
                          )}
                        >
                          <span className="sr-only">
                            {value === "meditate"
                              ? writtenToday
                                ? "(sat today)"
                                : "(not yet today)"
                              : writtenToday
                                ? "(written today)"
                                : "(not written today)"}
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {value === "meditate"
                          ? writtenToday
                            ? "You've sat today"
                            : "No sitting yet today"
                          : writtenToday
                            ? "Today's page is written"
                            : "Not written yet today"}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="font-mono text-micro tabular-nums opacity-60">
                      {value === "wishes" ? active.length : disputations.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* An empty section carries its own call to action in the sky card;
            one button per intent on screen. */}
        {showNew && (
          <Button
            type="button"
            className="rounded-full"
            onClick={() =>
              setEditing(tab === "wishes" ? { kind: "wish", card: null } : { kind: "disputation", card: null })
            }
          >
            <Plus className="size-4" aria-hidden />
            {tab === "wishes" ? "New wish" : "New disputation"}
          </Button>
        )}
      </div>

      <section id={`mind-${tab}`} role="tabpanel" aria-label={LABELS[tab]}>
        {tab === "wishes" && (
          <WishesPanel
            active={active}
            settled={settled}
            onNew={() => setEditing({ kind: "wish", card: null })}
            onOpen={(card) => setEditing({ kind: "wish", card })}
          />
        )}
        {tab === "disputations" && (
          <DisputationsPanel
            entries={disputations}
            onNew={() => setEditing({ kind: "disputation", card: null })}
            onOpen={(card) => setEditing({ kind: "disputation", card })}
          />
        )}
        {tab === "meditate" && (
          <MeditatePanel
            view={view.meditation}
            onBegin={(choice) => {
              // The tap that begins is the gesture browsers want before sound.
              primeAudio();
              setEditing({ kind: "meditation", choice, before: view.meditation.totalMinutes });
            }}
          />
        )}
        {(tab === "gratitude" || tab === "dua") && (
          <PracticePanel
            // Keyed by tab only: keying by template remounted the panel on
            // every stepper click and shut the picker under your finger.
            key={tab}
            kind={tab}
            view={view[tab]}
            onWrite={(mode) => setEditing({ kind: "practice", practice: tab, mode })}
          />
        )}
      </section>

      {editing?.kind === "wish" && (
        <WoopRitual
          key={editing.card?.id ?? "new"}
          initial={editing.card}
          onSeal={(fields) => onSaveWish(fields, editing.card?.id)}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing?.kind === "disputation" && (
        <DisputationRitual
          key={editing.card?.id ?? "new"}
          initial={editing.card}
          onSave={(fields) => onSaveDisputation(fields, editing.card?.id)}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing?.kind === "meditation" && (() => {
        const meditation = findMeditation(editing.choice.kind);
        if (!meditation) return null;
        return (
          <MeditationSession
            key={`${editing.choice.kind}-${JSON.stringify(editing.choice.options)}`}
            meditation={meditation}
            options={editing.choice.options}
            totalMinutesBefore={editing.before}
            onSave={(result) => onSaveMeditation(editing.choice, result)}
            onClose={() => setEditing(null)}
          />
        );
      })()}
      {editing?.kind === "practice" && (() => {
        const practice = view[editing.practice];
        const page = editing.mode === "edit" ? practice.today : null;
        // Editing reopens today's page in the template it was written with;
        // a new page or a rewrite uses the current one.
        const template = (page && findTemplate(editing.practice, page.template)) ?? templateOrDefault(editing.practice, practice.template);
        const count =
          page && template.counted
            ? new Set(page.items.map((item) => item.key.split(":")[0])).size
            : practice.count;
        return (
          <PracticeRitual
            key={`${editing.practice}-${editing.mode}`}
            kind={editing.practice}
            template={template}
            count={count}
            seed={practice.seed}
            initial={page ? itemsToAnswers(page.items) : null}
            onSave={(answers) => onSavePractice(editing.practice, template.id, count, answers)}
            onCancel={() => setEditing(null)}
          />
        );
      })()}
    </div>
  );
}
