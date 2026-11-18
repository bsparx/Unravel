"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { DisputationRevisit } from "@/components/disputation-revisit";
import { DisputationRitual } from "@/components/disputation-ritual";
import type { MeditationChoice } from "@/components/meditation/meditation-picker";
import { MeditationSession, type SessionResult } from "@/components/meditation/meditation-session";
import { primeAudio } from "@/components/meditation/sound";
import { PracticeRitual } from "@/components/practice-ritual";
import { BookDialog } from "@/components/reading/book-dialog";
import { LogReadingDialog } from "@/components/reading/log-reading-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WishRehearsal } from "@/components/wish-rehearsal";
import { WoopRitual } from "@/components/woop-ritual";
import { cn } from "@/lib/utils";
import type { DisputationCard, DisputationFields } from "@/lib/disputation";
import type { MindView } from "@/lib/mind-data";
import type { ShelfBook } from "@/lib/reading-data";
import type { Tending } from "@/lib/tending";
import { MIND_TABS, type MindTab } from "@/lib/mind-tabs";
import {
  itemsToAnswers,
  templateOrDefault,
  findTemplate,
  type PracticeKind,
} from "@/lib/practices";
import type { WishCard, WoopFields } from "@/lib/woop";
import { findMeditation } from "@/lib/meditations";

import {
  rehearseWish,
  revisitDisputation,
  saveDisputation,
  saveMeditation,
  savePractice,
  saveWish,
} from "../actions";
import { DisputationsPanel } from "./disputations-panel";
import { MeditatePanel } from "./meditate-panel";
import { PracticePanel, type PracticeWriteMode } from "./practice-panel";
import { ReadingPanel } from "./reading-panel";
import { WishesPanel } from "./wishes-panel";


type Editing =
  | { kind: "wish"; card: WishCard | null }
  | { kind: "disputation"; card: DisputationCard | null }
  | { kind: "practice"; practice: PracticeKind; mode: PracticeWriteMode }
  | { kind: "meditation"; choice: MeditationChoice; tending: Tending }
  | { kind: "rehearse"; card: WishCard }
  | { kind: "revisit"; card: DisputationCard }
  | { kind: "book" }
  | { kind: "log"; book: ShelfBook }
  | null;

const LABELS: Record<MindTab, string> = {
  gratitude: "Gratitude",
  dua: "Du'a",
  meditate: "Meditate",
  reading: "Reading",
  wishes: "Wishes",
  disputations: "Disputations",
};

// What each tab's dot says, done or not yet.
const DOT: Record<MindTab, { colour: string; done: string; not: string; srDone: string; srNot: string }> = {
  gratitude: { colour: "bg-[var(--thanks-lantern)]", done: "Today's page is written", not: "Not written yet today", srDone: "(written today)", srNot: "(not written today)" },
  dua: { colour: "bg-[var(--dua-accent)]", done: "Today's page is written", not: "Not written yet today", srDone: "(written today)", srNot: "(not written today)" },
  meditate: { colour: "bg-[var(--garden-light)]", done: "You've sat today", not: "No sitting yet today", srDone: "(sat today)", srNot: "(not yet today)" },
  reading: { colour: "bg-[var(--reading-dot)]", done: "You've read today", not: "No reading yet today", srDone: "(read today)", srNot: "(not yet today)" },
  wishes: { colour: "bg-[var(--woop-wish)]", done: "You've rehearsed a wish today", not: "No wish rehearsed yet today", srDone: "(rehearsed today)", srNot: "(not yet today)" },
  disputations: { colour: "bg-[var(--abcde-energization)]", done: "You've argued one back today", not: "None written or revisited today", srDone: "(done today)", srNot: "(not yet today)" },
};

/**
 * /mind: up to six practices behind one switch. The two daily pages come
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

  // Whether today counts yet, per tab: the same day the scene counts.
  const doneToday: Record<MindTab, boolean> = {
    gratitude: view.gratitude.tending.today,
    dua: view.dua.tending.today,
    meditate: view.meditation.tending.today,
    reading: view.reading.tending.today,
    wishes: view.wishTending.today,
    disputations: view.disputationTending.today,
  };

  const onRehearse = async (card: WishCard) => {
    try {
      const state = await rehearseWish(card.id);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      setEditing(null);
      toast.success("Rehearsed. The mountain keeps today.");
      return true;
    } catch {
      toast.error("Couldn't keep that one. Check your connection.");
      return false;
    }
  };

  const onRevisit = async (card: DisputationCard, belief: number | null) => {
    const formData = new FormData();
    formData.set("id", card.id);
    formData.set("belief", belief === null ? "" : String(belief));
    try {
      const state = await revisitDisputation(formData);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      setEditing(null);
      toast.success("Revisited. Still argued.");
      return true;
    } catch {
      toast.error("Couldn't keep that one. Check your connection.");
      return false;
    }
  };

  const showNew =
    (tab === "wishes" && active.length > 0) || (tab === "disputations" && disputations.length > 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {/* Scrolls rather than wraps on a phone: four pills don't fit 375px. */}
        <div className="relative -mx-5 max-w-[calc(100%+2.5rem)] overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:px-0">
          <div
            role="tablist"
            aria-label="Mind sections"
            className="border-border bg-muted/40 inline-flex rounded-full border p-1"
          >
            {tabs.map((value) => {
              const selected = tab === value;
              const writtenToday = doneToday[value];
              const dot = DOT[value];
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          writtenToday ? dot.colour : "border-muted-foreground/50 border",
                        )}
                      >
                        <span className="sr-only">{writtenToday ? dot.srDone : dot.srNot}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{writtenToday ? dot.done : dot.not}</TooltipContent>
                  </Tooltip>
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
            tending={view.wishTending}
            rehearsedToday={view.rehearsedToday}
            onNew={() => setEditing({ kind: "wish", card: null })}
            onOpen={(card) => setEditing({ kind: "wish", card })}
            onRehearse={(card) => setEditing({ kind: "rehearse", card })}
          />
        )}
        {tab === "disputations" && (
          <DisputationsPanel
            entries={disputations}
            tending={view.disputationTending}
            onNew={() => setEditing({ kind: "disputation", card: null })}
            onOpen={(card) => setEditing({ kind: "disputation", card })}
            onRevisit={(card) => setEditing({ kind: "revisit", card })}
          />
        )}
        {tab === "meditate" && (
          <MeditatePanel
            view={view.meditation}
            onBegin={(choice) => {
              // The tap that begins is the gesture browsers want before sound.
              primeAudio();
              setEditing({ kind: "meditation", choice, tending: view.meditation.tending });
            }}
          />
        )}
        {tab === "reading" && (
          <ReadingPanel
            view={view.reading}
            onAdd={() => setEditing({ kind: "book" })}
            onLog={(book) => setEditing({ kind: "log", book })}
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
            tending={editing.tending}
            onSave={(result) => onSaveMeditation(editing.choice, result)}
            onClose={() => setEditing(null)}
          />
        );
      })()}
      {editing?.kind === "rehearse" && (
        <WishRehearsal
          key={editing.card.id}
          woop={editing.card}
          onDone={() => onRehearse(editing.card)}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing?.kind === "revisit" && (
        <DisputationRevisit
          key={editing.card.id}
          entry={editing.card}
          onDone={(belief) => onRevisit(editing.card, belief)}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing?.kind === "book" && <BookDialog initial={null} onClose={() => setEditing(null)} />}
      {editing?.kind === "log" && (
        <LogReadingDialog
          key={editing.book.id}
          book={editing.book}
          todayISO={view.reading.todayISO}
          onClose={() => setEditing(null)}
        />
      )}
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
