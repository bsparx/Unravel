"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CustomRecitationDialog, type CustomRecitationFields } from "@/components/custom-recitation-dialog";
import { primeAudio } from "@/components/meditation/sound";
import { PracticeRitual } from "@/components/practice-ritual";
import type { TemplateChoice } from "@/components/practice-template-picker";
import { RecitationSession } from "@/components/recitation-session";
import { SectionTabs, useUrlTab, type TabDot } from "@/components/section-tabs";
import type { CustomRecitationRow, HeartView } from "@/lib/heart-data";
import { HEART_TABS, type HeartTab } from "@/lib/heart-tabs";
import { findTemplate, itemsToAnswers, templateOrDefault, type PracticeKind } from "@/lib/practices";
import type { SetItem } from "@/lib/recitations";

import {
  archiveCustomRecitation,
  completeRecitation,
  saveCustomRecitation,
  saveRecitationSet,
  undoRecitation,
} from "../actions";
import { PracticePanel, type PracticeWriteMode } from "./practice-panel";
import { PrayerPanel } from "./prayer-panel";
import { RecitationPanel } from "./recitation-panel";

// The catalogue's words load only when you open it.
const RecitationCustomize = dynamic(() => import("@/components/recitation-customize"), { ssr: false });

type Editing =
  | { kind: "practice"; practice: PracticeKind; mode: PracticeWriteMode }
  | { kind: "recite"; at?: number; again: boolean }
  | { kind: "customize" }
  | { kind: "custom"; row: CustomRecitationRow | null }
  | null;

const LABELS: Record<HeartTab, string> = {
  prayer: "Prayer",
  gratitude: "Gratitude",
  dua: "Du'a",
  recitation: "Recitation",
};

const DOT: Record<HeartTab, TabDot> = {
  prayer: { colour: "bg-[var(--town-lamp)]", done: "All five prayed today", not: "Not all five prayed yet today", srDone: "(all five prayed today)", srNot: "(not all five prayed today)" },
  gratitude: { colour: "bg-[var(--thanks-lantern)]", done: "Today's page is written", not: "Not written yet today", srDone: "(written today)", srNot: "(not written today)" },
  dua: { colour: "bg-[var(--dua-accent)]", done: "Today's page is written", not: "Not written yet today", srDone: "(written today)", srNot: "(not written today)" },
  recitation: { colour: "bg-[var(--oasis-water)]", done: "Today's set is recited", not: "Not recited yet today", srDone: "(recited today)", srNot: "(not recited today)" },
};

function isStaleActionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /Failed to find Server Action|Server action not found/i.test(msg);
}

/**
 * /heart: the five daily prayers, gratitude, du'a and the daily recitation.
 * Prayer brings the times that used to sit on the day page and a town that
 * lights up with them; the two pages and their rituals are exactly as they
 * were on Mind; recitation brings its reader, its set and the oasis.
 */
export function HeartBoard({ initialTab, view }: { initialTab: HeartTab; view: HeartView }) {
  const router = useRouter();
  const tabs = HEART_TABS.filter((tab) => view.enabled[tab]);
  const [tab, switchTab] = useUrlTab<HeartTab>(initialTab, tabs);
  const [editing, setEditing] = useState<Editing>(null);
  // Customize is its own flag so write-your-own can open over it.
  const [customizing, setCustomizing] = useState(false);

  // Kept here (not buried inside PracticePanel) so changing e.g. 2 -> 1 du'a
  // takes effect immediately if you open the ritual right away. Keyed against
  // the server snapshot so a fresh server value cleanly supersedes old overrides
  // without a syncing effect.
  const [choiceOverrides, setChoiceOverrides] = useState<
    Partial<Record<PracticeKind, { base: string; choice: TemplateChoice }>>
  >({});

  const baseKey = (kind: PracticeKind) => `${view[kind].template}:${view[kind].count}`;
  const activeChoiceFor = (kind: PracticeKind): TemplateChoice => {
    const ov = choiceOverrides[kind];
    if (ov && ov.base === baseKey(kind)) return ov.choice;
    return { template: view[kind].template, count: view[kind].count };
  };
  const setChoiceFor = (kind: PracticeKind, next: TemplateChoice) => {
    setChoiceOverrides((prev) => ({ ...prev, [kind]: { base: baseKey(kind), choice: next } }));
  };

  const doneToday: Record<HeartTab, boolean> = {
    prayer: view.prayer.tending.today,
    gratitude: view.gratitude.tending.today,
    dua: view.dua.tending.today,
    recitation: view.recitation.tending.today,
  };

  const onSavePractice = async (
    practice: PracticeKind,
    template: string,
    count: number,
    answers: Record<string, string>,
  ) => {
    try {
      const response = await fetch("/api/heart/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: practice, template, count, answers }),
      });
      const state = (await response.json().catch(() => null)) as
        | { status?: string; message?: string }
        | null;

      if (!response.ok || state?.status === "error") {
        toast.error(state?.message ?? "Couldn't save that. What you wrote is still here.");
        return false;
      }

      setEditing(null);
      toast.success(practice === "gratitude" ? "Kept. Every lantern lit." : "Written. Ameen.");
      router.refresh();
      return true;
    } catch {
      toast.error("Couldn't save that. Check your connection — what you wrote is still here.");
      return false;
    }
  };

  const onComplete = async () => {
    try {
      const state = await completeRecitation();
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      return true;
    } catch (err) {
      if (isStaleActionError(err)) {
        toast.error("Unravel was just updated — refresh the page and try again.");
      }
      return false;
    }
  };

  const onSaveSet = async (set: SetItem[]) => {
    const formData = new FormData();
    formData.set("set", JSON.stringify(set));
    try {
      const state = await saveRecitationSet(formData);
      if (state.status === "error") {
        toast.error(state.message);
        return false;
      }
      setCustomizing(false);
      toast.success("Your set is saved.");
      return true;
    } catch (err) {
      toast.error(
        isStaleActionError(err)
          ? "Unravel was just updated — refresh the page and try again."
          : "Couldn't save the set. Check your connection.",
      );
      return false;
    }
  };

  const onSaveCustom = async (row: CustomRecitationRow | null, fields: CustomRecitationFields) => {
    const formData = new FormData();
    if (row) formData.set("id", row.id);
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    try {
      const state = await saveCustomRecitation(formData);
      if (state.status === "error") return state.message;
      setEditing(null);
      // A new one has joined the saved set; reopen Customize on fresh data.
      setCustomizing(false);
      toast.success(row ? "Saved." : "Added to your set.");
      return null;
    } catch (err) {
      return isStaleActionError(err)
        ? "Unravel was just updated — refresh the page and try again."
        : "Couldn't save that. Check your connection.";
    }
  };

  return (
    <div>
      <div className="mb-8">
        <SectionTabs
          label="Heart sections"
          idPrefix="heart"
          tabs={tabs}
          value={tab}
          onChange={switchTab}
          labels={LABELS}
          dots={DOT}
          doneToday={doneToday}
        />
      </div>

      <section id={`heart-${tab}`} role="tabpanel" aria-label={LABELS[tab]}>
        {tab === "prayer" && <PrayerPanel view={view.prayer} />}
        {(tab === "gratitude" || tab === "dua") && (
          <PracticePanel
            // Keyed by tab only: keying by template remounted the panel on
            // every stepper click and shut the picker under your finger.
            key={tab}
            kind={tab}
            view={view[tab]}
            choice={activeChoiceFor(tab)}
            onChoiceChange={(next) => setChoiceFor(tab, next)}
            onWrite={(mode) => setEditing({ kind: "practice", practice: tab, mode })}
          />
        )}
        {tab === "recitation" && (
          <RecitationPanel
            view={view.recitation}
            onBegin={(at, again = false) => {
              // The tap that begins is the gesture browsers want before sound.
              primeAudio();
              setEditing({ kind: "recite", at, again });
            }}
            onCustomize={() => setCustomizing(true)}
            onUndo={async () => {
              await undoRecitation();
              toast.success("Today is open again.");
            }}
          />
        )}
      </section>

      {editing?.kind === "practice" &&
        (() => {
          const practice = view[editing.practice];
          const activeChoice = activeChoiceFor(editing.practice);
          const page = editing.mode === "edit" ? practice.today : null;
          // Editing reopens today's page in the template it was written with;
          // a new page or a rewrite uses the user's current choice immediately.
          const template =
            (page && findTemplate(editing.practice, page.template)) ??
            templateOrDefault(editing.practice, activeChoice.template);
          const count =
            page && template.counted
              ? new Set(page.items.map((item) => item.key.split(":")[0])).size
              : activeChoice.count;
          return (
            <PracticeRitual
              key={`${editing.practice}-${editing.mode}-${template.id}-${count}`}
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

      {editing?.kind === "recite" && view.recitation.items.length > 0 && (
        <RecitationSession
          key={`${editing.at ?? "start"}-${editing.again}`}
          items={view.recitation.items}
          todayISO={view.recitation.todayISO}
          tending={view.recitation.tending}
          startAt={editing.at}
          fresh={editing.again}
          onComplete={onComplete}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Write-your-own opens over Customize, which stays as you left it. */}
      {customizing && (
        <RecitationCustomize
          set={view.recitation.set}
          customs={view.recitation.customs}
          onSave={onSaveSet}
          onWriteOwn={() => setEditing({ kind: "custom", row: null })}
          onEditOwn={(row) => setEditing({ kind: "custom", row })}
          onArchiveOwn={async (row) => {
            await archiveCustomRecitation(row.id);
            toast.success("Deleted.");
          }}
          onClose={() => setCustomizing(false)}
        />
      )}

      {editing?.kind === "custom" && (
        <CustomRecitationDialog
          key={editing.row?.id ?? "new"}
          initial={editing.row}
          onSave={(fields) => onSaveCustom(editing.row, fields)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
