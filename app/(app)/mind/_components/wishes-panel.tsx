"use client";

import { useState } from "react";
import { ChevronDown, Feather, Sparkle, Stamp, Undo2, Wind } from "lucide-react";
import { toast } from "sonner";

import { WaxSeal, WoopIndexCard } from "@/components/woop-card";
import { cn } from "@/lib/utils";
import type { WishCard } from "@/lib/woop";

import { deleteWish, setWishStatus } from "../actions";
import { CardTools, SkyEmpty } from "./shared";

/**
 * Wishes are standing cards you come back to, so they sit side by side,
 * each a little off-square like cards pinned up by hand.
 */
export function WishesPanel({
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
        // One wish gets the same centred column as a gratitude or du'a page;
        // two or more sit side by side and fill the width between them.
        <ul className={cn(active.length === 1 ? "mx-auto max-w-2xl" : "columns-1 gap-8 md:columns-2")}>
          {active.map((card, index) => (
            <li key={card.id} className="group relative mb-10 break-inside-avoid pt-2">
              <WoopIndexCard
                woop={card}
                className={cn(
                  // A header band for the card's tools, beside the tape, so
                  // they never sit on the wish itself.
                  "pt-14 transition-transform duration-300 group-hover:rotate-0",
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

