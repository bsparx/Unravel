"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookCheck,
  BookOpen,
  Copy,
  Ellipsis,
  Feather,
  NotebookPen,
  PauseCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { InfoTip } from "@/components/info-tip";
import { WashiTape } from "@/components/journal-ornaments";
import { BookCover } from "@/components/reading/book-cover";
import { BookDialog, Segmented } from "@/components/reading/book-dialog";
import { LogReadingDialog } from "@/components/reading/log-reading-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  BOOK_STATUS_LABEL,
  BOOK_SUMMARY_MAX,
  amountLabel,
  notesByDate,
  notesInOrder,
  rangeLabel,
  toMarkdown,
  type BookStatus,
} from "@/lib/reading";
import type { BookLog, BookView } from "@/lib/reading-data";
import { cn } from "@/lib/utils";

import { deleteBook, deleteReadingLog, saveBookSummary, setBookStatus } from "../../../reading-actions";

type Editing = { kind: "log"; log: BookLog | null } | { kind: "book" } | { kind: "delete" } | null;

/**
 * The book's notebook. The header is the book on its own little shelf with
 * how far you are; below it, two sheets of the journal's paper: what the
 * book is in your own words, and every reading's note, read front to back.
 */
export function BookNotebook({ view }: { view: BookView }) {
  const { book, logs, todayISO } = view;
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, startTransition] = useTransition();

  const percent = book.unit === "PERCENT";
  const statusMoves: { status: BookStatus; label: string; icon: typeof BookCheck }[] =
    book.status === "READING"
      ? [
          { status: "FINISHED", label: "Mark as finished", icon: BookCheck },
          { status: "SET_ASIDE", label: "Set aside", icon: PauseCircle },
        ]
      : book.status === "FINISHED"
        ? [{ status: "READING", label: "Read it again", icon: BookOpen }]
        : [{ status: "READING", label: "Start reading", icon: BookOpen }];

  const move = (status: BookStatus) => {
    const formData = new FormData();
    formData.set("id", book.id);
    formData.set("status", status);
    startTransition(async () => {
      const state = await setBookStatus(formData).catch(() => null);
      if (!state || state.status === "error") {
        toast.error("Couldn't move that book. Try again.");
        return;
      }
      toast.success(
        status === "FINISHED"
          ? "Finished. Moved to the Read shelf."
          : status === "SET_ASIDE"
            ? "Set aside. It's under the shelves when you want it."
            : "Back on the shelf.",
      );
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(book, logs));
      toast.success("Notes copied as Markdown.");
    } catch {
      toast.error("Couldn't reach the clipboard.");
    }
  };

  const stats = [
    `Started ${book.startedLabel}`,
    `${book.readings} ${book.readings === 1 ? "reading" : "readings"}`,
    book.covered > 0 && `${amountLabel(book.unit, book.covered)} read`,
    book.finishedLabel && `Finished ${book.finishedLabel}`,
  ].filter(Boolean);

  return (
    <div>
      <Link
        href="/mind?tab=reading"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-8 inline-flex items-center gap-1.5 rounded-full text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Reading
      </Link>

      {/* The book, on its own bit of shelf. */}
      <header className="grid gap-8 sm:grid-cols-[13rem_1fr] sm:items-end md:gap-12">
        <div className="mx-auto w-40 sm:w-full">
          <div className="px-3">
            <BookCover title={book.title} author={book.author} cover={book.cover} progress={book.progress} />
          </div>
          <div aria-hidden className="shelf-ledge rounded-[3px]" />
        </div>

        <div className="min-w-0 space-y-4 pb-1 text-center sm:text-left">
          <span className="border-border text-muted-foreground inline-block rounded-full border px-2.5 py-0.5 text-micro font-medium tracking-wide uppercase">
            {BOOK_STATUS_LABEL[book.status]}
          </span>
          <div className="space-y-1">
            <h1 className="text-display leading-[1.1] text-balance break-words">{book.title}</h1>
            {book.author && <p className="text-muted-foreground font-display text-xl italic">{book.author}</p>}
          </div>

          <div className="mx-auto max-w-md space-y-1.5 sm:mx-0">
            {book.progress !== null && (
              <div
                className="bg-muted h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="How far you are"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(book.progress * 100)}
              >
                <div
                  className="h-full rounded-full bg-[var(--reading-accent)] transition-[width] duration-700"
                  style={{ width: `${Math.max(book.progress > 0 ? 2 : 0, book.progress * 100)}%` }}
                />
              </div>
            )}
            <p className="text-label flex flex-wrap justify-center gap-x-3 sm:justify-start">
              <span className="font-medium tabular-nums">
                {book.positionLabel}
                {book.progress !== null && !percent ? ` · ${Math.round(book.progress * 100)}%` : ""}
              </span>
            </p>
            <p className="text-muted-foreground text-micro">{stats.join(" · ")}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button type="button" className="rounded-full px-5" onClick={() => setEditing({ kind: "log", log: null })}>
              <NotebookPen className="size-4" aria-hidden />
              Log reading
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditing({ kind: "book" })}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label="More for this book" className="rounded-full">
                  <Ellipsis className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {statusMoves.map((item) => (
                  <DropdownMenuItem key={item.status} onSelect={() => move(item.status)}>
                    <item.icon className="size-4" aria-hidden />
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={copy}>
                  <Copy className="size-4" aria-hidden />
                  Copy notes as Markdown
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setEditing({ kind: "delete" })}>
                  <Trash2 className="size-4" aria-hidden />
                  Delete book
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-16 max-w-3xl space-y-14">
        <Summary
          key={book.summary ?? ""}
          bookId={book.id}
          summary={book.summary}
          finished={book.status === "FINISHED"}
          hasNotes={logs.some((log) => log.note || log.quote)}
        />
        <Notes
          unit={book.unit}
          logs={logs}
          onEdit={(log) => setEditing({ kind: "log", log })}
          onCopy={copy}
          onFirst={() => setEditing({ kind: "log", log: null })}
        />
      </div>

      {editing?.kind === "log" && (
        <LogReadingDialog
          key={editing.log?.id ?? "new"}
          book={book}
          log={editing.log}
          todayISO={todayISO}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "book" && <BookDialog initial={book} onClose={() => setEditing(null)} />}
      {editing?.kind === "delete" && (
        <DeleteBook
          title={book.title}
          readings={book.readings}
          onClose={() => setEditing(null)}
          onConfirm={async () => {
            await deleteBook(book.id);
            toast.success("Deleted.");
            router.push("/mind?tab=reading");
          }}
        />
      )}
    </div>
  );
}

/** A sheet of the journal's paper, taped in. */
function Sheet({ children, className, tape = "-1.5deg" }: { children: React.ReactNode; className?: string; tape?: string }) {
  return (
    <div
      className={cn(
        "border-paper-edge bg-paper text-paper-ink relative rounded-md border px-5 pt-9 pb-7 shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55),0_2px_0_rgba(0,0,0,0.04)] sm:px-9",
        className,
      )}
    >
      <WashiTape className="absolute -top-2.5 left-1/2 w-24 -translate-x-1/2" rotate={tape} />
      {children}
    </div>
  );
}

function Summary({
  bookId,
  summary,
  finished,
  hasNotes,
}: {
  bookId: string;
  summary: string | null;
  finished: boolean;
  hasNotes: boolean;
}) {
  // What's shown is what was last kept here, so the page doesn't flash back
  // to empty while the server catches up.
  const [kept, setKept] = useState(summary);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary ?? "");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const formData = new FormData();
    formData.set("id", bookId);
    formData.set("summary", draft);
    startTransition(async () => {
      const state = await saveBookSummary(formData).catch(() => null);
      if (!state || state.status === "error") {
        toast.error(state?.status === "error" ? state.message : "Couldn't save that. What you wrote is still here.");
        return;
      }
      setKept(draft.trim() || null);
      setEditing(false);
      toast.success(draft.trim() ? "Kept, in your own words." : "Cleared.");
    });
  };

  // Finished, with nothing written yet: the best moment to write it.
  const nudge = finished && !kept;

  return (
    <section aria-labelledby="summary-title">
      <Sheet className={cn(nudge && !editing && "ring-2 ring-[var(--reading-accent)]/50 ring-offset-4 ring-offset-[var(--background)]")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="summary-title" className="font-display text-2xl">
            In your own words
          </h2>
          {kept && !editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(kept);
                setEditing(true);
              }}
              className="text-paper-ink hover:bg-paper-edge/50 hover:text-paper-ink -mr-2 rounded-full"
            >
              <Feather className="size-3.5" aria-hidden />
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="paper-ruled">
              <Textarea
                autoFocus
                aria-label="The book in your own words"
                maxLength={BOOK_SUMMARY_MAX}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setEditing(false);
                  }
                }}
                placeholder="What is this book about? What does it argue, and what will you keep from it?"
                className="font-display text-paper-ink placeholder:text-paper-ink-muted/80 field-sizing-content min-h-[11.4rem] resize-none rounded-none border-0 bg-transparent px-0 py-0 text-[1.1rem] leading-[1.9rem] shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditing(false)}
                className="text-paper-ink hover:bg-paper-edge/50 hover:text-paper-ink rounded-full"
              >
                Cancel
              </Button>
              <Button type="button" disabled={pending} onClick={save} className="rounded-full px-5">
                {pending ? "Saving…" : "Keep it"}
              </Button>
            </div>
          </div>
        ) : kept ? (
          <p className="font-display text-[1.1rem] leading-[1.75] whitespace-pre-wrap">{kept}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-paper-ink-muted max-w-prose">
              {nudge
                ? "You've finished it. Now's a good time to say what it was about, while it's fresh."
                : hasNotes
                  ? "When you're ready, say what this book is about, in your own words. Your notes below are the raw material."
                  : "When you're ready, say what this book is about, in your own words. Notes from each reading will gather below to help."}
            </p>
            <Button type="button" onClick={() => setEditing(true)} className="rounded-full px-5">
              <Feather className="size-4" aria-hidden />
              Write it
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}

function Notes({
  unit,
  logs,
  onEdit,
  onCopy,
  onFirst,
}: {
  unit: BookView["book"]["unit"];
  logs: BookLog[];
  onEdit: (log: BookLog) => void;
  onCopy: () => void;
  onFirst: () => void;
}) {
  const [order, setOrder] = useState<"page" | "date">("page");
  const ordered = order === "page" ? notesInOrder(logs) : notesByDate(logs);

  return (
    <section aria-labelledby="notes-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 id="notes-title" className="font-display text-title">
            Notes as you read
          </h2>
          <InfoTip term="book-notes" />
        </div>
        {logs.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-52">
              <Segmented
                value={order}
                onChange={setOrder}
                options={[
                  { value: "page", label: "Page order" },
                  { value: "date", label: "By date" },
                ]}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onCopy} aria-label="Copy notes as Markdown" className="rounded-full">
              <Copy className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {logs.length === 0 ? (
        <Sheet tape="1.5deg" className="text-center">
          <p className="font-display text-xl">Your notes will gather here, a few pages at a time.</p>
          <p className="text-paper-ink-muted mt-2">Log a reading and write a line about what stayed with you.</p>
          <Button type="button" onClick={onFirst} className="mt-5 rounded-full px-5">
            <NotebookPen className="size-4" aria-hidden />
            Log a reading
          </Button>
        </Sheet>
      ) : (
        <Sheet tape="1.5deg" className="px-0 pt-8 pb-4 sm:px-0">
          <ol>
            {ordered.map((log, index) => (
              <NoteEntry key={log.id} unit={unit} log={log} first={index === 0} onEdit={() => onEdit(log)} />
            ))}
          </ol>
        </Sheet>
      )}
    </section>
  );
}

/**
 * One reading on the sheet: its pages and day in the margin, left of the red
 * rule, and what you wrote to the right of it.
 */
function NoteEntry({
  unit,
  log,
  first,
  onEdit,
}: {
  unit: BookView["book"]["unit"];
  log: BookLog;
  first: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const written = Boolean(log.note || log.quote);

  return (
    <li
      className={cn(
        // A phone stacks the pages over the note; from sm the pages sit in
        // the margin, left of the red rule, the way a notebook is ruled.
        "group relative sm:grid sm:grid-cols-[7.5rem_1fr]",
        !first && "border-paper-rule/70 border-t border-dashed",
      )}
    >
      <div className="flex items-baseline gap-2 px-5 pt-4 pr-24 sm:block sm:border-r sm:border-[rgba(196,84,72,0.45)] sm:py-4 sm:pr-4 sm:pl-0 sm:text-right">
        <p className="font-mono text-micro font-medium whitespace-nowrap tabular-nums">
          {rangeLabel(unit, log.fromPage, log.toPage)}
        </p>
        <p className="text-paper-ink-muted text-[0.7rem] sm:mt-0.5">{log.dateLabel}</p>
      </div>

      <div className="min-w-0 space-y-3 px-5 pt-2 pb-4 sm:py-4 sm:pr-24 sm:pl-6">
        {log.note && <p className="font-display text-[1.05rem] leading-[1.7] break-words whitespace-pre-wrap">{log.note}</p>}
        {log.quote && (
          <blockquote className="border-paper-ink/25 border-l-2 pl-4">
            <p className="font-display text-[1.05rem] leading-[1.7] break-words whitespace-pre-wrap italic">
              &ldquo;{log.quote}&rdquo;
            </p>
            {log.quotePage !== null && (
              <footer className="text-paper-ink-muted mt-1 font-mono text-[0.7rem] tabular-nums">
                {unit === "PERCENT" ? `${log.quotePage}%` : `p. ${log.quotePage}`}
              </footer>
            )}
          </blockquote>
        )}
        {!written && <p className="text-paper-ink-muted pt-0.5 text-label italic">Read, no note.</p>}
      </div>

      <div className="absolute top-2.5 right-3 flex items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={`Edit the reading of ${rangeLabel(unit, log.fromPage, log.toPage)}`}
          className="text-paper-ink hover:bg-paper-edge/60 hover:text-paper-ink rounded-full"
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirming(true)}
          aria-label={`Delete the reading of ${rangeLabel(unit, log.fromPage, log.toPage)}`}
          className="text-paper-ink hover:bg-paper-edge/60 hover:text-destructive rounded-full"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      {confirming && (
        <ConfirmDelete
          title="Delete this reading?"
          description={`${rangeLabel(unit, log.fromPage, log.toPage)}, ${log.dateLabel}${written ? ", and what you wrote with it" : ""}. Where you are in the book is worked out again from what's left.`}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await deleteReadingLog(log.id);
            toast.success("Deleted.");
          }}
        />
      )}
    </li>
  );
}

function DeleteBook({
  title,
  readings,
  onClose,
  onConfirm,
}: {
  title: string;
  readings: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <ConfirmDelete
      title={`Delete ${title}?`}
      description={
        readings > 0
          ? `The book, its ${readings} ${readings === 1 ? "reading" : "readings"} and every note go for good. To keep the notes, copy them first, or set the book aside instead.`
          : "It goes for good."
      }
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

/** A confirm opened from a menu or a hover tool, so it owns no trigger. */
function ConfirmDelete({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await onConfirm();
                  onClose();
                } catch {
                  toast.error("Couldn't delete that. Try again.");
                }
              })
            }
          >
            {pending ? "Deleting…" : "Delete for good"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
