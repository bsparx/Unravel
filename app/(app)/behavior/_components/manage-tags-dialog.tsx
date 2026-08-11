"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCustomTag,
  listBehaviorTags,
  type BehaviorTag,
} from "@/app/(app)/behavior/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Manage the tag set. The built-ins are greyed out — they belong to everyone
 * and cannot be deleted. Custom tags get a delete button, guarded by a
 * confirmation: deleting one keeps the entries, they just lose their label.
 */
export function ManageTagsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tags, setTags] = useState<BehaviorTag[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listBehaviorTags().then((loaded) => {
      if (alive) setTags(loaded);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Tags</DialogTitle>
          <DialogDescription>
            The built-ins are shared by everyone. Your custom ones, you can
            delete — entries keep their text, just without the label.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="border-border bg-card flex items-center gap-3 rounded-lg border p-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {tag.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={tag.system ? "outline" : "secondary"}
                          className={tag.system ? "opacity-60" : undefined}
                        >
                          {tag.name}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{tag.description}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge variant={tag.system ? "outline" : "secondary"}>
                      {tag.name}
                    </Badge>
                  )}
                  {tag.system && (
                    <span className="text-micro text-muted-foreground flex items-center gap-1">
                      <BadgeCheck className="size-3" aria-hidden />
                      Built-in
                    </span>
                  )}
                </div>
              </div>

              {!tag.system && (
                <ConfirmDialog
                  trigger={(openDialog) => (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={openDialog}
                      aria-label={`Delete tag "${tag.name}"`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                  title={`Delete "${tag.name}"?`}
                  description="Entries already logged with this tag keep their text — they'll just show without the label."
                  confirmLabel="Delete tag"
                  onConfirm={async () => {
                    startTransition(async () => {
                      const result = await deleteCustomTag(tag.id);
                      if (!result.ok) {
                        toast.error(result.message);
                        return;
                      }
                      setTags((current) =>
                        current.filter((t) => t.id !== tag.id),
                      );
                      toast.success(`Deleted "${tag.name}".`);
                    });
                  }}
                />
              )}
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
