"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { captureThought } from "@/app/actions/capture";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * The front door.
 *
 * Mounted once in a layout and never a route: the moment capture requires a
 * navigation you've added a decision point, and the thought is already gone.
 * From anywhere — `c`, or ⌘K / Ctrl+K — you get a box, you type, you press
 * Enter, and it's out of your head.
 *
 * One field. No project, no estimate, no due date, no parsing. Sorting it out
 * is a separate, deliberate activity that happens at /inbox.
 */
export function DumpBox() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const commandK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const plainC =
        event.key === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;

      if (!commandK && !plainC) return;

      // Never steal a keystroke from something the user is typing into.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = () => {
    const text = body.trim();
    if (!text || pending) return;

    startTransition(async () => {
      const result = await captureThought(text);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      // Clear and close immediately — the instant feel comes from the dialog
      // getting out of the way, not from waiting on anything.
      setBody("");
      setOpen(false);
      toast.success("Got it.", {
        description: "It's in your inbox. Deal with it later.",
      });

      // If they happen to be looking at the inbox, stream the new row in.
      if (pathname.startsWith("/inbox")) router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Write something down"
        aria-keyshortcuts="c"
        className={cn(
          "bg-primary text-primary-foreground focus-visible:ring-ring fixed right-4 bottom-24 z-50 grid size-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
          // On desktop the mini timer badge lives up top, so the bottom-right
          // corner — where a thumb and a cursor both expect it — is ours.
          "md:right-6 md:bottom-6",
        )}
      >
        <PenLine className="size-5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[22%] translate-y-0 gap-3 p-4 sm:max-w-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            textareaRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Write something down</DialogTitle>
          <DialogDescription className="sr-only">
            Anything at all. It goes to your inbox and you can sort it out
            later.
          </DialogDescription>

          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={pending}
            rows={3}
            maxLength={2000}
            placeholder="What's on your mind?"
            className="resize-none border-0 !text-body shadow-none focus-visible:ring-0"
          />

          <p className="text-muted-foreground flex items-center justify-between text-label">
            <span>Tasks, worries, half-thoughts. Anything.</span>
            <span className="text-micro">
              <kbd className="font-mono">Enter</kbd> to save
            </span>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
