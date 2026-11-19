"use client";

import { useState } from "react";
import { ChevronDown, Feather, Sparkle, Stamp, Undo2, Wind } from "lucide-react";
import { toast } from "sonner";

import { GuideCard } from "@/components/guides/guide-card";
import { SceneCard } from "@/components/scenes/scene-card";
import { WaxSeal, WoopCard } from "@/components/woop-card";
import type { Tending } from "@/lib/tending";
import { cn } from "@/lib/utils";
import type { WishCard } from "@/lib/woop";

import { deleteWish, setWishStatus } from "../actions";
import { CardTools, SkyEmpty } from "@/components/panel-shared";

/**
 * Wishes are standing cards you come back to, so they sit side by side,
 * under the summit that rehearsing them keeps. Each shows the wish, turns
 * over to the plan, and can be rehearsed once a day.
 */
export function WishesPanel({
  active,
  settled,
  tending,
  rehearsedToday,
  onNew,
  onOpen,
  onRehearse,
}: {
  active: WishCard[];
  settled: WishCard[];
  tending: Tending;
  rehearsedToday: string[];
  onNew: () => void;
  onOpen: (card: WishCard) => void;
  onRehearse: (card: WishCard) => void;
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
      <SceneCard tab="wishes" tending={tending} />
      <GuideCard guide="wishes" firstTime={active.length === 0 && settled.length === 0} />

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
        // One wish gets the same centred column as a gratitude or du'a page;
        // two or more sit side by side, each row as tall as its taller card.
        <ul className={cn("grid grid-cols-1 gap-6", active.length === 1 ? "mx-auto max-w-2xl" : "md:grid-cols-2")}>
          {active.map((card) => (
            <li key={card.id} className="group relative">
              <WoopCard
                woop={card}
                footer={`Made ${card.createdLabel}`}
                rehearsedToday={rehearsedToday.includes(card.id)}
                onRehearse={() => onRehearse(card)}
                className="h-full"
              />
              {stamping === card.id && <WaxSeal className="-right-2 -bottom-4" />}

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
            <ul className="animate-in fade-in slide-in-from-top-1 mt-5 grid grid-cols-1 gap-6 duration-200 sm:grid-cols-2 lg:grid-cols-3">
              {settled.map((card) => (
                <li key={card.id} className="group relative">
                  <WoopCard
                    woop={card}
                    compact
                    className={cn("h-full", card.status === "RELEASED" && "opacity-60 saturate-50")}
                    footer={
                      <span className="flex items-center gap-1.5">
                        {card.status === "ACHIEVED" ? (
                          <Stamp className="size-3" aria-hidden />
                        ) : (
                          <Wind className="size-3" aria-hidden />
                        )}
                        {card.status === "ACHIEVED" ? "Achieved" : "Let go"} {card.settledLabel}
                      </span>
                    }
                  />
                  {card.status === "ACHIEVED" && (
                    <WaxSeal className="pointer-events-none -top-3 -left-2 size-12 [&>span]:size-9 [&>span>span]:text-base" />
                  )}
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

