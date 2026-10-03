"use client";

import { useState } from "react";

import { IdentitySigil } from "@/components/identity-sigil";
import type { Sigil } from "@/lib/identity-look";
import { cn } from "@/lib/utils";

export type LensOption = {
  id: string;
  short: string;
  question: string | null;
  sigil: Sigil;
  colorSlot: number;
};

/**
 * "Focusing as": borrow one identity's point of view for the session. A lens,
 * not a log — the choice changes only the question on screen, so it lives in
 * component state and never touches the session row. Votes still come from
 * the habit the session is for.
 */
export function FocusLens({ options, initialId }: { options: LensOption[]; initialId: string | null }) {
  const [selectedId, setSelectedId] = useState(initialId ?? options[0]?.id ?? null);
  const selected = options.find((option) => option.id === selectedId) ?? null;
  if (options.length === 0) return null;

  return (
    <div className="mx-auto mt-4 max-w-md">
      <fieldset>
        <legend className="text-muted-foreground mx-auto mb-2 text-micro">Focusing as</legend>
        <div className="flex flex-wrap justify-center gap-1.5">
          {options.map((option) => {
            const checked = option.id === selectedId;
            return (
              <label
                key={option.id}
                style={{ "--hue": `var(--id-${option.colorSlot})` } as React.CSSProperties}
                className={cn(
                  "border-border text-muted-foreground has-[:focus-visible]:ring-ring relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border py-1.5 pr-3 pl-1.5 text-label has-[:focus-visible]:ring-2",
                  checked &&
                    "text-foreground border-[color-mix(in_srgb,var(--hue)_55%,transparent)] bg-[color-mix(in_srgb,var(--hue)_10%,var(--input-surface))] font-semibold",
                )}
              >
                <input
                  type="radio"
                  name="focus-as"
                  value={option.id}
                  checked={checked}
                  onChange={() => setSelectedId(option.id)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <IdentitySigil sigil={option.sigil} slot={option.colorSlot} size="sm" />
                {option.short}
              </label>
            );
          })}
        </div>
      </fieldset>
      {selected?.question && (
        <p
          style={{ "--hue": `var(--id-${selected.colorSlot})` } as React.CSSProperties}
          className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--hue)_9%,transparent)] px-3.5 py-3 text-left text-body"
        >
          <span className="text-muted-foreground block text-micro font-semibold">Ask like {selected.short}</span>
          {selected.question}
        </p>
      )}
    </div>
  );
}
