"use client";

import type { Feather } from "lucide-react";
import { Ellipsis, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ritualPrimaryClass } from "@/components/ritual-frame";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Glass over whichever sky the card is drawn on. */
const TOOL =
  "rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] text-[var(--woop-ink)] backdrop-blur-sm hover:bg-[var(--woop-hover)] hover:text-[var(--woop-ink)]";

/**
 * A card's tools, pinned to its top-right corner: a menu and a delete. Always
 * there on touch; on a pointer they surface on hover or focus so the board
 * reads as cards, not as controls.
 */
export function CardTools({
  label,
  items,
  deleteTitle,
  deleteDescription = "It's gone for good. If you only want it off the board, let it go instead.",
  onDelete,
  disabled = false,
  className,
}: {
  label: string;
  items: { label: string; icon: typeof Feather; onSelect: () => void }[];
  deleteTitle: string;
  deleteDescription?: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-4 right-3 flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:has-[[data-state=open]]:opacity-100",
        className,
      )}
    >
      {items.length > 0 && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Actions for ${label}`}
            className={TOOL}
          >
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {items.map((item) => (
            <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      <ConfirmDialog
        title={deleteTitle}
        description={deleteDescription}
        onConfirm={async () => {
          await onDelete();
          toast.success("Deleted.");
        }}
        trigger={(openDialog) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={openDialog}
            aria-label={`Delete ${label}`}
            className={cn(TOOL, "hover:text-destructive")}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      />
    </div>
  );
}

/** An empty section, drawn as a piece of its ritual's sky. */
export function SkyEmpty({
  sky,
  icon,
  title,
  body,
  action,
  onAction,
  children,
}: {
  sky: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // The same centred column as the pages and cards it stands in for.
        "relative isolate mx-auto w-full max-w-2xl overflow-hidden rounded-2xl px-6 py-14 text-center text-[var(--woop-ink)] sm:py-20",
        sky,
      )}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
        <span className="grid size-10 place-items-center rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)]">
          {icon}
        </span>
        <div className="space-y-1.5">
          <p className="font-display text-2xl">{title}</p>
          <p className="text-sm text-[var(--woop-ink-muted)]">{body}</p>
        </div>
        <Button
          type="button"
          onClick={onAction}
          className={cn("mt-2", ritualPrimaryClass)}
        >
          {action}
        </Button>
        {children}
      </div>
    </div>
  );
}
