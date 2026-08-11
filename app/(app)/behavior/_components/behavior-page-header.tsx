"use client";

import { useState } from "react";
import { Tag } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ManageTagsDialog } from "./manage-tags-dialog";

/** The header with the "Manage tags" control — a client component because the
 * dialog owns its open state. */
export function BehaviorPageHeader() {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display">Behavior</h1>
          <p className="text-muted-foreground mt-1 text-label">
            When the urge hits — daydreaming, music, scrolling — press{" "}
            <kbd className="font-mono">c</kbd> and write what you felt and what
            triggered it. The patterns live here.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setManageOpen(true)}
          className="shrink-0"
        >
          <Tag className="size-4" aria-hidden />
          Manage tags
        </Button>
      </div>

      <ManageTagsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </header>
  );
}
