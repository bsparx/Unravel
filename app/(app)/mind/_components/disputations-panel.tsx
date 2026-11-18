"use client";

import { useState } from "react";
import { CloudSun, Feather } from "lucide-react";

import { DisputationTurn } from "@/components/disputation-card";
import { SceneCard } from "@/components/scenes/scene-card";
import type { DisputationCard } from "@/lib/disputation";
import type { Tending } from "@/lib/tending";

import { deleteDisputation } from "../actions";
import { CardTools, SkyEmpty } from "./shared";

/**
 * Disputations are a record of arguments won, so they read top to bottom,
 * newest first, under the harbour that writing or revisiting one keeps. Each
 * shows the turn it made; the argument opens on request.
 */
export function DisputationsPanel({
  entries,
  tending,
  onNew,
  onOpen,
  onRevisit,
}: {
  entries: DisputationCard[];
  tending: Tending;
  onNew: () => void;
  onOpen: (card: DisputationCard) => void;
  onRevisit: (card: DisputationCard) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-12">
      <SceneCard tab="disputations" tending={tending} />
      <Entries entries={entries} open={open} setOpen={setOpen} onNew={onNew} onOpen={onOpen} onRevisit={onRevisit} />
    </div>
  );
}

function Entries({
  entries,
  open,
  setOpen,
  onNew,
  onOpen,
  onRevisit,
}: {
  entries: DisputationCard[];
  open: string | null;
  setOpen: (id: string | null) => void;
  onNew: () => void;
  onOpen: (card: DisputationCard) => void;
  onRevisit: (card: DisputationCard) => void;
}) {
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
              revisit={entry.revisit}
              onRevisit={() => onRevisit(entry)}
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

