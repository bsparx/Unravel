"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";

import { InfoTip } from "@/components/info-tip";
import { BookCover } from "@/components/reading/book-cover";
import { SceneCard } from "@/components/scenes/scene-card";
import { Button } from "@/components/ui/button";
import type { ReadingView, ShelfBook } from "@/lib/reading-data";
import { cn } from "@/lib/utils";

import { setBookStatus } from "../reading-actions";
import { SkyEmpty } from "@/components/panel-shared";

/**
 * Reading: the books you're reading stand on a shelf, each with a ribbon at
 * the page you reached. Log a reading from under its cover; open the cover
 * for the book's notes. Up next and the books you've read sit on smaller
 * shelves below. Two weeks of dots, as on the other daily tabs; no streak.
 */
export function ReadingPanel({
  view,
  onAdd,
  onLog,
}: {
  view: ReadingView;
  onAdd: () => void;
  onLog: (book: ShelfBook) => void;
}) {
  const empty =
    view.reading.length + view.upNext.length + view.finished.length + view.setAside.length === 0;

  if (empty) {
    return (
      <SkyEmpty
        sky="reading-sky"
        icon={<BookOpen className="size-4" aria-hidden />}
        title="Your shelf is empty"
        body="Add the book you're reading. Each time you read, log where you stopped and what stayed with you, and the book gathers its own notes."
        action="Add a book"
        onAction={onAdd}
      />
    );
  }

  const readOn = new Map(view.days.map((day) => [day.dateISO, day]));

  return (
    <div className="space-y-14">
      <SceneCard
        tab="reading"
        tending={view.tending}
        note={(day) => {
          const read = readOn.get(day.dateISO);
          if (!read) return null;
          const parts = [
            read.pages > 0 && `${read.pages} ${read.pages === 1 ? "page" : "pages"}`,
            read.percent > 0 && `${read.percent}%`,
          ].filter(Boolean);
          return parts.length ? parts.join(" and ") : null;
        }}
      />

      <section aria-label="Reading now" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-1">
            <h2 className="font-display text-title">Reading now</h2>
            <InfoTip term="reading" />
          </div>
          <WeekLine week={view.week} />
        </div>
        <Shelf
          size="large"
          books={view.reading}
          trailing={<AddSlot onAdd={onAdd} />}
          meta={(book) => (
            <div className="space-y-2">
              <div>
                <p className="text-label font-medium tabular-nums">{book.positionLabel}</p>
                <p className="text-muted-foreground text-micro">{lastReadLine(book)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onLog(book)}
                className="w-full rounded-full sm:w-auto"
              >
                <NotebookPen className="size-3.5" aria-hidden />
                Log reading
              </Button>
            </div>
          )}
        />
      </section>

      {view.upNext.length > 0 && (
        <section aria-label="Up next" className="space-y-1">
          <h3 className="text-body font-medium">Up next</h3>
          <Shelf size="small" books={view.upNext} meta={(book) => <StartButton book={book} />} />
        </section>
      )}

      {view.finished.length > 0 && (
        <section aria-label="Read" className="space-y-1">
          <h3 className="text-body font-medium">
            Read <span className="text-muted-foreground font-mono text-micro tabular-nums">{view.finished.length}</span>
          </h3>
          <Shelf
            size="small"
            books={view.finished}
            meta={(book) => <p className="text-muted-foreground text-micro">{book.finishedLabel}</p>}
          />
        </section>
      )}

      {view.setAside.length > 0 && <SetAside books={view.setAside} />}
    </div>
  );
}

function lastReadLine(book: ShelfBook): string {
  if (!book.lastRead) return book.position > 0 ? "Nothing logged yet" : "Not started";
  if (book.lastRead === "Today" || book.lastRead === "Yesterday") return `Read ${book.lastRead.toLowerCase()}`;
  return `Last read ${book.lastRead}`;
}

const SIZES = {
  // Columns per breakpoint, and which empty cells to show at each, so every
  // row's ledge runs the full width of the shelf.
  large: {
    grid: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
    fill: [
      { columns: 2, className: "grid sm:hidden" },
      { columns: 3, className: "hidden sm:grid md:hidden" },
      { columns: 4, className: "hidden md:grid" },
    ],
    cover: "px-[13%] pt-8",
    meta: "px-[13%] pt-3 pb-8",
  },
  small: {
    grid: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6",
    fill: [
      { columns: 3, className: "grid sm:hidden" },
      { columns: 4, className: "hidden sm:grid md:hidden" },
      { columns: 6, className: "hidden md:grid" },
    ],
    cover: "px-[14%] pt-5",
    meta: "px-[14%] pt-2 pb-6",
  },
} as const;

/**
 * A shelf of covers. Each cell is three rows of one subgrid (cover, ledge,
 * what's under it), so the ledges line up across a row whatever the text
 * under each cover, and join into one plank.
 */
function Shelf({
  size,
  books,
  meta,
  trailing,
}: {
  size: keyof typeof SIZES;
  books: ShelfBook[];
  meta: (book: ShelfBook) => ReactNode;
  trailing?: ReactNode;
}) {
  const config = SIZES[size];
  const count = books.length + (trailing ? 1 : 0);

  return (
    <ul className={cn("grid", config.grid)}>
      {books.map((book) => (
        <li key={book.id} className="row-span-3 grid grid-rows-subgrid">
          <div className={cn("flex items-end", config.cover)}>
            <Link
              href={`/mind/books/${book.id}`}
              aria-label={`${book.title}: open its notes`}
              className="group focus-visible:ring-ring block w-full rounded-[2px_6px_6px_2px] focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none"
            >
              <BookCover
                title={book.title}
                author={book.author}
                cover={book.cover}
                progress={book.progress}
                className="book-lift"
              />
            </Link>
          </div>
          <div aria-hidden className="shelf-ledge" />
          <div className={config.meta}>{meta(book)}</div>
        </li>
      ))}
      {trailing && (
        <li className="row-span-3 grid grid-rows-subgrid">
          <div className={cn("flex items-end", config.cover)}>{trailing}</div>
          <div aria-hidden className="shelf-ledge" />
          <div className={config.meta} />
        </li>
      )}
      {config.fill.flatMap(({ columns, className }) =>
        Array.from({ length: (columns - (count % columns)) % columns }, (_, i) => (
          <li key={`${columns}-${i}`} aria-hidden className={cn("row-span-3 grid-rows-subgrid", className)}>
            <div />
            <div className="shelf-ledge" />
            <div />
          </li>
        )),
      )}
    </ul>
  );
}

function AddSlot({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group text-muted-foreground hover:text-foreground focus-visible:ring-ring border-border hover:border-foreground/30 hover:bg-muted/40 flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-[2px_6px_6px_2px] border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="border-border grid size-9 place-items-center rounded-full border transition-transform group-hover:scale-105 group-active:scale-95">
        <Plus className="size-4" aria-hidden />
      </span>
      <span className="text-label font-medium">Add a book</span>
    </button>
  );
}

function StartButton({ book }: { book: ShelfBook }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("id", book.id);
        formData.set("status", "READING");
        startTransition(async () => {
          const state = await setBookStatus(formData).catch(() => null);
          if (!state || state.status === "error") toast.error("Couldn't move that book. Try again.");
          else toast.success(`${book.title} is on the shelf.`);
        });
      }}
      className="-ml-2 h-7 rounded-full px-2 text-micro"
    >
      {pending ? "Moving…" : "Start reading"}
    </Button>
  );
}

function SetAside({ books }: { books: ShelfBook[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Set aside" className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        Set aside · {books.length}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="border-border divide-border divide-y rounded-2xl border">
          {books.map((book) => (
            <li key={book.id} className="flex items-center gap-3 py-2.5 pr-2 pl-3">
              <div className="w-7 shrink-0">
                <BookCover title={book.title} cover={book.cover} plain />
              </div>
              <Link
                href={`/mind/books/${book.id}`}
                className="focus-visible:ring-ring min-w-0 flex-1 rounded focus-visible:ring-2 focus-visible:outline-none"
              >
                <p className="text-label truncate font-medium">{book.title}</p>
                <p className="text-muted-foreground text-micro truncate">
                  {book.author ? `${book.author} · ` : ""}
                  {book.positionLabel}
                </p>
              </Link>
              <StartButton book={book} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekLine({ week }: { week: ReadingView["week"] }) {
  const parts = [
    week.pages > 0 && `${week.pages.toLocaleString("en-GB")} ${week.pages === 1 ? "page" : "pages"}`,
    week.percent > 0 && `${week.percent}% of e-books`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className="text-muted-foreground text-label tabular-nums">{parts.join(" and ")} in the last 7 days</p>;
}
