"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { BrainDumpPaper } from "@/components/brain-dump-paper";
import { BrainDumpSession, type DumpResult } from "@/components/brain-dump-session";
import { DisputationRevisit } from "@/components/disputation-revisit";
import { DumpLetter } from "@/components/dump-envelope";
import { DisputationRitual } from "@/components/disputation-ritual";
import type { MeditationChoice } from "@/components/meditation/meditation-picker";
import { MeditationSession, type SessionResult } from "@/components/meditation/meditation-session";
import { primeAudio } from "@/components/meditation/sound";
import { BookDialog } from "@/components/reading/book-dialog";
import { LogReadingDialog } from "@/components/reading/log-reading-dialog";
import { Button } from "@/components/ui/button";
import { SectionTabs, useUrlTab, type TabDot } from "@/components/section-tabs";
import { WishRehearsal } from "@/components/wish-rehearsal";
import { WoopRitual } from "@/components/woop-ritual";
import type { DisputationCard, DisputationFields } from "@/lib/disputation";
import type { DumpKind, DumpMinutes } from "@/lib/brain-dump";
import type { DumpRow, MindView } from "@/lib/mind-data";
import type { ShelfBook } from "@/lib/reading-data";
import type { Tending } from "@/lib/tending";
import { MIND_TABS, type MindTab } from "@/lib/mind-tabs";
import type { WishCard, WoopFields } from "@/lib/woop";
import { findMeditation } from "@/lib/meditations";

import {
  rehearseWish,
  revisitDisputation,
  saveBrainDump,
  saveDisputation,
  saveMeditation,
  saveWish,
} from "../actions";
import { BrainDumpPanel } from "./braindump-panel";
import { DisputationsPanel } from "./disputations-panel";
import { MeditatePanel } from "./meditate-panel";
import { ReadingPanel } from "./reading-panel";
import { WishesPanel } from "./wishes-panel";


type Editing =
  | { kind: "wish"; card: WishCard | null }
  | { kind: "disputation"; card: DisputationCard | null }
  | { kind: "meditation"; choice: MeditationChoice; tending: Tending }
  | { kind: "rehearse"; card: WishCard }
  | { kind: "revisit"; card: DisputationCard }
  | { kind: "dump"; dump: DumpKind; minutes: DumpMinutes; tending: Tending }
  | { kind: "dump-paper"; dump: DumpKind }
  | { kind: "dump-read"; row: DumpRow }
  | { kind: "book" }
  | { kind: "log"; book: ShelfBook }
  | null;

const LABELS: Record<MindTab, string> = {
  braindump: "Brain dump",
  meditate: "Meditate",
  reading: "Reading",
  wishes: "Wishes",
  disputations: "Disputations",
};

// What each tab's dot says, done or not yet.
const DOT: Record<MindTab, TabDot> = {
  braindump: { colour: "bg-[var(--balloon-env-1)]", done: "You've emptied your head today", not: "No brain dump yet today", srDone: "(done today)", srNot: "(not yet today)" },
  meditate: { colour: "bg-[var(--garden-light)]", done: "You've sat today", not: "No sitting yet today", srDone: "(sat today)", srNot: "(not yet today)" },
  reading: { colour: "bg-[var(--reading-dot)]", done: "You've read today", not: "No reading yet today", srDone: "(read today)", srNot: "(not yet today)" },
  wishes: { colour: "bg-[var(--woop-wish)]", done: "You've rehearsed a wish today", not: "No wish rehearsed yet today", srDone: "(rehearsed today)", srNot: "(not yet today)" },
  disputations: { colour: "bg-[var(--abcde-energization)]", done: "You've argued one back today", not: "None written or revisited today", srDone: "(done today)", srNot: "(not yet today)" },
};

/**
 * /mind: up to five practices behind one switch, for the head: emptying it,
 * stilling it, feeding it, aiming it and arguing with it. Gratitude and du'a
 * live on /heart.
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
  const [tab, switchTab] = useUrlTab<MindTab>(initialTab, tabs);
  const [editing, setEditing] = useState<Editing>(null);

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
    braindump: view.braindump.tending.today,
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

  const onSaveDump = async (result: DumpResult) => {
    const formData = new FormData();
    formData.set("kind", result.kind);
    formData.set("body", result.body);
    formData.set("seconds", String(result.seconds));
    formData.set("paper", result.paper ? "true" : "");
    formData.set("tasks", JSON.stringify(result.tasks));
    try {
      const state = await saveBrainDump(formData);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      return true;
    } catch {
      toast.error(
        result.paper ? "Couldn't keep that. Check your connection." : "Couldn't fold that away. What you wrote is still here.",
      );
      return false;
    }
  };

  const showNew =
    (tab === "wishes" && active.length > 0) || (tab === "disputations" && disputations.length > 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <SectionTabs
          label="Mind sections"
          idPrefix="mind"
          tabs={tabs}
          value={tab}
          onChange={switchTab}
          labels={LABELS}
          dots={DOT}
          doneToday={doneToday}
        />

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
        {tab === "braindump" && (
          <BrainDumpPanel
            view={view.braindump}
            onBegin={(dump, minutes) =>
              setEditing({ kind: "dump", dump, minutes, tending: view.braindump.tending })
            }
            onPaper={(dump) => setEditing({ kind: "dump-paper", dump })}
            onOpen={(row) => setEditing({ kind: "dump-read", row })}
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
      {editing?.kind === "dump" && (
        <BrainDumpSession
          kind={editing.dump}
          minutes={editing.minutes}
          tending={editing.tending}
          onSave={onSaveDump}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "dump-paper" && (
        <BrainDumpPaper
          kind={editing.dump}
          onSave={async (result) => {
            const ok = await onSaveDump(result);
            if (ok) {
              setEditing(null);
              toast.success(
                result.tasks.length
                  ? `Kept, and ${result.tasks.length} sent to your tasks.`
                  : "Kept. The balloon counts today.",
              );
            }
            return ok;
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing?.kind === "dump-read" && <DumpLetter row={editing.row} onClose={() => setEditing(null)} />}
      {editing?.kind === "book" && <BookDialog initial={null} onClose={() => setEditing(null)} />}
      {editing?.kind === "log" && (
        <LogReadingDialog
          key={editing.book.id}
          book={editing.book}
          todayISO={view.reading.todayISO}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
