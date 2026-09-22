"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createIdentity,
  listIdentities,
  type IdentityRecord,
} from "@/app/(app)/identities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Which identities a habit votes for.
 *
 * A row of toggleable chips — multi-select, because one habit can serve
 * several selves (the walk is both Athlete and Someone calm). "+ New" creates
 * one with just its name; the statement can wait until /identities, because
 * stopping the habit form to write an essay is exactly the wrong trade.
 */
export function IdentityPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [identities, setIdentities] = useState<IdentityRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listIdentities().then((loaded) => {
      if (alive) setIdentities(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  const submitNew = () => {
    const clean = name.trim();
    if (!clean || pending) return;
    startTransition(async () => {
      const result = await createIdentity(clean);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setIdentities((current) => [...current, result.identity]);
      onChange([...value, result.identity.id]);
      setName("");
      setAdding(false);
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {identities.map((identity) => {
        const selected = value.includes(identity.id);
        return (
          <button
            key={identity.id}
            type="button"
            onClick={() => toggle(identity.id)}
            aria-pressed={selected}
            className={cn(
              "border-border text-label focus-visible:ring-ring inline-flex h-7 items-center gap-1 rounded-full border px-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {selected && <Check className="size-3" aria-hidden />}
            {identity.name}
          </button>
        );
      })}

      {adding ? (
        <span className="flex items-center gap-1 rounded-full border border-dashed px-2">
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitNew();
              }
              if (event.key === "Escape") {
                setAdding(false);
                setName("");
              }
            }}
            disabled={pending}
            placeholder="Identity name"
            className="h-7 w-32 border-0 px-0.5 text-xs focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setName("");
            }}
            aria-label="Cancel new identity"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border-border text-label text-muted-foreground hover:text-foreground inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus className="size-3" aria-hidden />
          New
        </button>
      )}
    </div>
  );
}