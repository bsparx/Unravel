"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 180;

/**
 * A small "?" beside a term that explains what it is and why it's there.
 *
 * A popover rather than a plain tooltip, because tooltips never open on touch.
 * A mouse previews it on hover, and a tap or click pins it open until a click
 * elsewhere or Escape. The icon is quiet so a regular user's eye passes over
 * it, and the hit area still reaches 44px.
 */
export function InfoTip({
  term,
  className,
  side = "bottom",
  align = "start",
}: {
  term: GlossaryTerm;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const entry = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clear();
    timer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || pinned) return;
    clear();
    timer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };
  const close = () => {
    clear();
    setOpen(false);
    setPinned(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverAnchor asChild>
        <button
          ref={button}
          type="button"
          aria-label={`About ${entry.title.toLowerCase()}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onClick={() => {
            clear();
            // A hover preview becomes pinned on click instead of closing under
            // the pointer; a pinned one closes.
            if (open && pinned) close();
            else {
              setOpen(true);
              setPinned(true);
            }
          }}
          className={cn(
            "text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring relative inline-grid size-5 shrink-0 place-items-center rounded-full align-middle transition-colors focus-visible:ring-2 focus-visible:outline-none",
            "after:absolute after:-inset-3 after:content-['']",
            open && "text-foreground",
            className,
          )}
        >
          <CircleHelp className="size-4" aria-hidden />
        </button>
      </PopoverAnchor>
      <PopoverContent
        side={side}
        align={align}
        // Keep the whole card on screen at phone width, with the page gutter.
        collisionPadding={16}
        sticky="always"
        className="w-80 max-w-[calc(100vw-2rem)] gap-1.5 rounded-xl p-4 font-sans normal-case tracking-normal"
        // Text only: moving focus into it would yank a hover preview's focus.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // The trigger toggles itself; letting this also count as "outside"
        // would close and reopen it in one click.
        onInteractOutside={(event) => {
          if (button.current?.contains(event.target as Node)) event.preventDefault();
        }}
        onPointerEnter={(event) => event.pointerType === "mouse" && clear()}
        onPointerLeave={hoverClose}
      >
        <p className="text-foreground text-label font-semibold">{entry.title}</p>
        <p className="text-foreground text-label leading-relaxed font-normal">{entry.what}</p>
        <p className="text-muted-foreground text-label leading-relaxed font-normal">{entry.why}</p>
      </PopoverContent>
    </Popover>
  );
}
