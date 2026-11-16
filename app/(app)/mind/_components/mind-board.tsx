"use client";

import { useState } from "react";
import {
  ChevronDown,
  CloudSun,
  Ellipsis,
  Feather,
  Plus,
  Sparkle,
  Stamp,
  Trash2,
  Undo2,
  Wind,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DisputationIndexCard } from "@/components/disputation-card";
import { DisputationRitual } from "@/components/disputation-ritual";
import { ritualPrimaryClass } from "@/components/ritual-frame";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WaxSeal, WoopIndexCard } from "@/components/woop-card";
import { WoopRitual } from "@/components/woop-ritual";
import { cn } from "@/lib/utils";
import type { DisputationCard, DisputationFields } from "@/lib/disputation";
import type { WishCard, WoopFields } from "@/lib/woop";

import {
  deleteDisputation,
  deleteWish,
  saveDisputation,
  saveWish,
  setWishStatus,
} from "../actions";

export type MindTab = "wishes" | "disputations";

type Editing =
  | { kind: "wish"; card: WishCard | null }
  | { kind: "disputation"; card: DisputationCard | null }
  | null;

/**
 * /mind: wishes pinned to a board, disputations filed in a stack.
 *
 * The two halves share a page but not a shape. Wishes are standing cards you
 * come back to, so they sit side by side, each a little off-square like
 * cards pinned up by hand. Disputations are a record of arguments won, so
 * they read top to bottom, newest first, like a journal.
 */
export function MindBoard({
  initialTab,
  active,
  settled,
  disputations,
}: {
  initialTab: MindTab;
  active: WishCard[];
  settled: WishCard[];
  disputations: DisputationCard[];
}) {
  const [tab, setTab] = useState<MindTab>(initialTab);
  const [editing, setEditing] = useState<Editing>(null);

  // The tab lives in the URL so a reload lands where you were. Native
  // history keeps it a URL change, not a server round trip.
  const switchTab = (next: MindTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "wishes") url.searchParams.delete("tab");
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

  const tabs: { value: MindTab; label: string; count: number }[] = [
    { value: "wishes", label: "Wishes", count: active.length },
    { value: "disputations", label: "Disputations", count: disputations.length },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Mind sections"
          className="border-border bg-muted/40 inline-flex rounded-full border p-1"
        >
          {tabs.map((option) => {
            const selected = tab === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`mind-${option.value}`}
                onClick={() => switchTab(option.value)}
                className={cn(
                  "focus-visible:ring-ring inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
                <span className="font-mono text-micro tabular-nums opacity-60">
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* An empty section carries its own call to action in the sky card;
            one button per intent on screen. */}
        {(tab === "wishes" ? active.length : disputations.length) > 0 && (
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

      {tab === "wishes" ? (
        <section id="mind-wishes" role="tabpanel" aria-label="Wishes">
          <Wishes
            active={active}
            settled={settled}
            onNew={() => setEditing({ kind: "wish", card: null })}
            onOpen={(card) => setEditing({ kind: "wish", card })}
          />
        </section>
      ) : (
        <section id="mind-disputations" role="tabpanel" aria-label="Disputations">
          <Disputations
            entries={disputations}
            onNew={() => setEditing({ kind: "disputation", card: null })}
            onOpen={(card) => setEditing({ kind: "disputation", card })}
          />
        </section>
      )}

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
    </div>
  );
}

// ---------------------------------------------------------------- wishes

function Wishes({
  active,
  settled,
  onNew,
  onOpen,
}: {
  active: WishCard[];
  settled: WishCard[];
  onNew: () => void;
  onOpen: (card: WishCard) => void;
}) {
  const [stamping, setStamping] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const settle = async (card: WishCard, status: "ACHIEVED" | "RELEASED" | "ACTIVE") => {
    const formData = new FormData();
    formData.set("id", card.id);
    formData.set("status", status);
    // Achieving gets its moment: the seal lands on the card before it
    // moves to the drawer. Letting go and bringing back are quiet.
    if (status === "ACHIEVED") setStamping(card.id);
    const [state] = await Promise.all([
      setWishStatus(formData),
      new Promise((resolve) => window.setTimeout(resolve, status === "ACHIEVED" ? 1100 : 0)),
    ]);
    setStamping(null);
    if (state.status === "error") {
      toast.error(state.message);
      return;
    }
    toast.success(
      status === "ACHIEVED"
        ? "Achieved. That one's yours."
        : status === "RELEASED"
          ? "Let go. It's in the drawer if you want it back."
          : "Back on the board.",
    );
  };

  return (
    <div className="space-y-12">
      {active.length === 0 ? (
        <SkyEmpty
          sky="woop-sky-wish"
          icon={<Sparkle className="size-4 fill-current" aria-hidden />}
          title="No wishes on the board"
          body="Name something you want, then plan for what's in the way."
          action="New wish"
          onAction={onNew}
        />
      ) : (
        <ul className="columns-1 gap-8 md:columns-2">
          {active.map((card, index) => (
            <li key={card.id} className="group relative mb-10 break-inside-avoid pt-2">
              <WoopIndexCard
                woop={card}
                className={cn(
                  "transition-transform duration-300 group-hover:rotate-0",
                  index % 2 ? "rotate-[0.5deg]" : "rotate-[-0.6deg]",
                  stamping === card.id && "rotate-0",
                )}
              />
              {stamping === card.id && <WaxSeal className="-right-2 -bottom-4" />}
              <p className="text-muted-foreground mt-3 pl-1 text-micro">Made {card.createdLabel}</p>

              <CardTools
                label={card.wish}
                disabled={stamping !== null}
                items={[
                  { label: "Open", icon: Feather, onSelect: () => onOpen(card) },
                  { label: "Achieved", icon: Stamp, onSelect: () => void settle(card, "ACHIEVED") },
                  { label: "Let it go", icon: Wind, onSelect: () => void settle(card, "RELEASED") },
                ]}
                deleteTitle="Delete this wish?"
                onDelete={() => deleteWish(card.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {settled.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setDrawer((open) => !open)}
            aria-expanded={drawer}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Achieved and let go
            <span className="font-mono text-micro tabular-nums opacity-60">{settled.length}</span>
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", drawer && "rotate-180")}
              aria-hidden
            />
          </button>

          {drawer && (
            <ul className="animate-in fade-in slide-in-from-top-1 mt-5 grid gap-6 duration-200 sm:grid-cols-2 lg:grid-cols-3">
              {settled.map((card) => (
                <li key={card.id} className="group relative">
                  <div className={cn(card.status === "RELEASED" && "opacity-60 saturate-50")}>
                    <WoopIndexCard woop={card} compact className="rotate-0" />
                  </div>
                  <p className="text-muted-foreground mt-2 flex items-center gap-1.5 pl-1 text-micro">
                    {card.status === "ACHIEVED" ? (
                      <Stamp className="text-primary size-3" aria-hidden />
                    ) : (
                      <Wind className="size-3" aria-hidden />
                    )}
                    {card.status === "ACHIEVED" ? "Achieved" : "Let go"} {card.settledLabel}
                  </p>
                  <CardTools
                    label={card.wish}
                    items={[{ label: "Back to the board", icon: Undo2, onSelect: () => void settle(card, "ACTIVE") }]}
                    deleteTitle="Delete this wish?"
                    onDelete={() => deleteWish(card.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- disputations

function Disputations({
  entries,
  onNew,
  onOpen,
}: {
  entries: DisputationCard[];
  onNew: () => void;
  onOpen: (card: DisputationCard) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <SkyEmpty
        sky="abcde-sky-energization"
        icon={<CloudSun className="size-4" aria-hidden />}
        title="Nothing to argue with yet"
        body="When a setback sets off a gloomy thought, write it here and argue back."
        action="New disputation"
        onAction={onNew}
      />
    );
  }

  return (
    <ol className="mx-auto max-w-2xl space-y-10">
      {entries.map((entry) => {
        const expanded = open === entry.id;
        return (
          <li key={entry.id} className="group relative">
            <p className="text-muted-foreground mb-2 pl-1 text-micro">{entry.createdLabel}</p>
            <DisputationIndexCard entry={entry} expanded={expanded} />
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : entry.id)}
              aria-expanded={expanded}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-2 inline-flex items-center gap-1 rounded-full pl-1 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {expanded ? "Hide the argument" : "Show the argument"}
              <ChevronDown
                className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")}
                aria-hidden
              />
            </button>
            <CardTools
              label={entry.belief}
              className="top-7"
              items={[{ label: "Edit", icon: Feather, onSelect: () => onOpen(entry) }]}
              deleteTitle="Delete this disputation?"
              onDelete={() => deleteDisputation(entry.id)}
            />
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- shared

/**
 * A card's tools, pinned to its top-right corner: a menu and a delete. Always
 * there on touch; on a pointer they surface on hover or focus so the board
 * reads as cards, not as controls.
 */
function CardTools({
  label,
  items,
  deleteTitle,
  onDelete,
  disabled = false,
  className,
}: {
  label: string;
  items: { label: string; icon: typeof Feather; onSelect: () => void }[];
  deleteTitle: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-4 right-3 flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:has-[[data-state=open]]:opacity-100",
        className,
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Actions for ${label}`}
            className="bg-paper/80 text-paper-ink hover:bg-paper-edge/60 hover:text-paper-ink rounded-full"
          >
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {items.map((item) => (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        title={deleteTitle}
        description="It's gone for good. If you only want it off the board, let it go instead."
        onConfirm={async () => {
          await onDelete();
          toast.success("Deleted.");
        }}
        trigger={(openDialog) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={openDialog}
            aria-label={`Delete ${label}`}
            className="bg-paper/80 text-paper-ink hover:bg-paper-edge/60 hover:text-destructive rounded-full"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      />
    </div>
  );
}

/** An empty section, drawn as a piece of its ritual's sky. */
function SkyEmpty({
  sky,
  icon,
  title,
  body,
  action,
  onAction,
}: {
  sky: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl px-6 py-14 text-center text-[var(--woop-ink)] sm:py-20",
        sky,
      )}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
        <span className="grid size-10 place-items-center rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)]">
          {icon}
        </span>
        <div className="space-y-1.5">
          <p className="font-display text-2xl">{title}</p>
          <p className="text-sm text-[var(--woop-ink-muted)]">{body}</p>
        </div>
        <Button
          type="button"
          onClick={onAction}
          className={cn("mt-2", ritualPrimaryClass)}
        >
          {action}
        </Button>
      </div>
    </div>
  );
}
