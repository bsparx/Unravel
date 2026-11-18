"use client";

import { useState } from "react";
import { CloudSun, Feather } from "lucide-react";

import { DisputationTurn } from "@/components/disputation-card";
import type { DisputationCard } from "@/lib/disputation";

import { deleteDisputation } from "../actions";
import { CardTools, SkyEmpty } from "./shared";

/**
 * Disputations are a record of arguments won, so they read top to bottom,
 * newest first. Each shows the turn it made; the argument opens on request.
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
    <ol className="mx-auto max-w-3xl space-y-6">
      {entries.map((entry) => {
        const expanded = open === entry.id;
        return (
          <li key={entry.id} className="group relative">
            <DisputationTurn
              entry={entry}
              dateLabel={entry.createdLabel}
              expanded={expanded}
              onToggle={() => setOpen(expanded ? null : entry.id)}
              toolRoom
            />
            <CardTools
              label={entry.belief}
              className="top-3"
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

