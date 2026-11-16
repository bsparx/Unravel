"use client";

import { useState } from "react";
import { ChevronDown, CloudSun, Feather } from "lucide-react";

import { DisputationIndexCard } from "@/components/disputation-card";
import { cn } from "@/lib/utils";
import type { DisputationCard } from "@/lib/disputation";

import { deleteDisputation } from "../actions";
import { CardTools, SkyEmpty } from "./shared";

/**
 * Disputations are a record of arguments won, so they read top to bottom,
 * newest first, like a journal.
 */
export function DisputationsPanel({
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
              deleteDescription="It's gone for good."
              onDelete={() => deleteDisputation(entry.id)}
            />
          </li>
        );
      })}
    </ol>
  );
}

