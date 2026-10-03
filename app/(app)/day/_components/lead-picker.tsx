"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setLeadIdentity } from "@/app/(app)/identities/actions";
import { IdentitySigil } from "@/components/identity-sigil";
import { InfoTip } from "@/components/info-tip";
import type { Sigil } from "@/lib/identity-look";
import { cn } from "@/lib/utils";

type Option = { id: string; short: string; sigil: Sigil; colorSlot: number };

/**
 * Who leads today, as native radios: arrow keys move the choice, and the
 * optimistic value means the press answers before the server does.
 */
export function LeadPicker({ options, leadId }: { options: Option[]; leadId: string | null }) {
  const router = useRouter();
  const [optimisticLead, setOptimisticLead] = useOptimistic(leadId);
  const [pending, startTransition] = useTransition();

  const choose = (id: string) =>
    startTransition(async () => {
      setOptimisticLead(id);
      const result = await setLeadIdentity(id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });

  return (
    <fieldset aria-busy={pending}>
      <legend className="text-muted-foreground mb-2.5 text-label font-semibold">
        Who leads today <InfoTip term="lead" className="ml-1" />
      </legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(4.25rem,1fr))] gap-1.5">
        {options.map((option) => {
          const checked = optimisticLead === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "text-muted-foreground has-[:focus-visible]:ring-ring relative flex min-h-20 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 py-2.5 text-center text-micro has-[:focus-visible]:ring-2",
                "hover:bg-secondary hover:text-foreground",
                checked &&
                  "text-foreground border-[color-mix(in_srgb,var(--hue)_55%,transparent)] bg-[color-mix(in_srgb,var(--hue)_10%,var(--input-surface))] font-semibold",
              )}
              style={{ "--hue": `var(--id-${option.colorSlot})` } as React.CSSProperties}
            >
              <input
                type="radio"
                name="lead"
                value={option.id}
                checked={checked}
                onChange={() => choose(option.id)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <IdentitySigil sigil={option.sigil} slot={option.colorSlot} />
              {option.short}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
