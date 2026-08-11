"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createCustomTag,
  listBehaviorTags,
  type BehaviorTag,
} from "@/app/(app)/behavior/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The tag picker inside the dump box.
 *
 * A row of selectable chips: the built-ins first (with their definition in a
 * tooltip), then this user's custom tags, then a "+ New" chip that opens an
 * inline input. Selecting is required — the dump box won't submit without a
 * tag, because naming the state is the point of a behavior log.
 */
export function TagPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [tags, setTags] = useState<BehaviorTag[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listBehaviorTags().then((loaded) => {
      if (alive) setTags(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const submitNew = () => {
    const clean = name.trim();
    if (!clean || pending) return;
    startTransition(async () => {
      const result = await createCustomTag(clean);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setTags((current) => [...current, result.tag]);
      onChange(result.tag.id);
      setName("");
      setAdding(false);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const selected = value === tag.id;
          const chip = (
            <button
              key={tag.id}
              type="button"
              onClick={() => onChange(tag.id)}
              aria-pressed={selected}
              aria-label={tag.description ?? tag.name}
              className={cn(
                "border-border text-label focus-visible:ring-ring inline-flex h-7 items-center gap-1 rounded-full border px-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {selected && <Check className="size-3" aria-hidden />}
              {tag.name}
            </button>
          );

          return tag.description ? (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>{chip}</TooltipTrigger>
              <TooltipContent>{tag.description}</TooltipContent>
            </Tooltip>
          ) : (
            chip
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
              placeholder="Tag name"
              className="h-7 w-28 border-0 px-0.5 text-xs focus-visible:ring-0"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setName("");
              }}
              aria-label="Cancel new tag"
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

      {!value && (
        <p className="text-micro text-muted-foreground">
          Pick what was behind it — required to save.
        </p>
      )}
    </div>
  );
}
