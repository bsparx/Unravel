"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { saveBook } from "@/app/(app)/mind/reading-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BOOK_AUTHOR_MAX,
  BOOK_COVERS,
  BOOK_COVER_KEYS,
  BOOK_TITLE_MAX,
  coverFor,
  isBookCover,
  type ReadingUnit,
} from "@/lib/reading";
import { cn } from "@/lib/utils";

import { BookCover } from "./book-cover";

export type BookDraft = {
  id: string;
  title: string;
  author: string | null;
  unit: ReadingUnit;
  totalPages: number | null;
  startPage: number;
  cover: string;
};

/**
 * Add a book, or edit one. The cover on the left is the real thing, drawn
 * as you type, so choosing a colour is choosing what will sit on the shelf.
 * Until you pick a colour yourself, the title picks one.
 */
export function BookDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: BookDraft | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [unit, setUnit] = useState<ReadingUnit>(initial?.unit ?? "PAGE");
  const [total, setTotal] = useState(initial?.totalPages ? String(initial.totalPages) : "");
  const [start, setStart] = useState(initial?.startPage ? String(initial.startPage) : "");
  const [picked, setPicked] = useState<string | null>(initial && isBookCover(initial.cover) ? initial.cover : null);
  const [shelf, setShelf] = useState<"READING" | "UP_NEXT">("READING");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const cover = picked ?? coverFor(title);
  const totalNumber = Number(total);
  const startNumber = Number(start) || 0;
  const end = unit === "PERCENT" ? 100 : total && totalNumber > 0 ? totalNumber : null;
  const progress = end ? Math.min(1, startNumber / end) : null;

  const clear = (key: string) =>
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    if (initial) formData.set("id", initial.id);
    formData.set("title", title);
    formData.set("author", author);
    formData.set("unit", unit);
    formData.set("totalPages", unit === "PAGE" ? total : "");
    formData.set("startPage", start);
    formData.set("cover", cover);
    if (!initial) formData.set("status", shelf);
    startTransition(async () => {
      try {
        const state = await saveBook(formData);
        if (state.status === "error") {
          // Errors on a field show under it; anything else under the form.
          const shown = ["title", "totalPages", "startPage"];
          const fields = state.fieldErrors ?? {};
          setErrors(Object.keys(fields).some((key) => shown.includes(key)) ? fields : { form: state.message });
          return;
        }
        toast.success(initial ? "Book updated." : shelf === "READING" ? "On the shelf." : "Added to Up next.");
        if (state.status === "success" && state.id) onSaved?.(state.id);
        onClose();
      } catch {
        setErrors({ form: "Couldn't save that. Try again." });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        sheetOnPhone
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:max-w-2xl sm:p-6 lg:max-w-3xl xl:p-8"
      >
        <form onSubmit={submit} className="flex min-h-full flex-col gap-5 xl:gap-7">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl xl:text-[1.75rem]">{initial ? "Edit book" : "Add a book"}</DialogTitle>
            <DialogDescription>
              {initial ? "Its readings and notes stay as they are." : "Put it on the shelf. You can change any of this later."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-[11rem_1fr] sm:gap-8 lg:grid-cols-[13rem_1fr] lg:gap-10">
            {/* The cover, as it'll stand on the shelf. */}
            <div className="mx-auto w-24 sm:w-full">
              <BookCover title={title || "Your book"} author={author} cover={cover} progress={progress} />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="book-title">Title</Label>
                <Input
                  id="book-title"
                  autoFocus
                  required
                  maxLength={BOOK_TITLE_MAX}
                  value={title}
                  aria-invalid={Boolean(errors.title)}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    clear("title");
                  }}
                  placeholder="Thinking, Fast and Slow"
                />
                {errors.title && <FieldError>{errors.title}</FieldError>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="book-author">
                  Author <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="book-author"
                  maxLength={BOOK_AUTHOR_MAX}
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Daniel Kahneman"
                />
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-label mb-1.5 font-medium">How do you keep your place?</legend>
                <Segmented
                  value={unit}
                  onChange={(next) => {
                    setUnit(next);
                    clear("totalPages");
                    clear("startPage");
                  }}
                  options={[
                    { value: "PAGE", label: "Pages", hint: "A printed book" },
                    { value: "PERCENT", label: "Percent", hint: "An e-book" },
                  ]}
                />
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                {unit === "PAGE" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="book-total">Pages in all</Label>
                    <Input
                      id="book-total"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={total}
                      aria-invalid={Boolean(errors.totalPages)}
                      onChange={(event) => {
                        setTotal(event.target.value);
                        clear("totalPages");
                        clear("startPage");
                      }}
                      placeholder="Optional"
                      className="tabular-nums"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="book-start">{unit === "PAGE" ? "Already on page" : "Already at %"}</Label>
                  <Input
                    id="book-start"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={unit === "PERCENT" ? 100 : undefined}
                    value={start}
                    aria-invalid={Boolean(errors.startPage)}
                    onChange={(event) => {
                      setStart(event.target.value);
                      clear("startPage");
                    }}
                    placeholder="0"
                    className="tabular-nums"
                  />
                </div>
              </div>
              {(errors.totalPages || errors.startPage) && (
                <FieldError>{errors.totalPages ?? errors.startPage}</FieldError>
              )}

              <fieldset>
                <legend className="text-label mb-2 font-medium">Cover</legend>
                <div className="flex flex-wrap gap-1.5">
                  {BOOK_COVER_KEYS.map((key) => {
                    const selected = cover === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPicked(key)}
                        aria-pressed={selected}
                        aria-label={`${BOOK_COVERS[key].name} cover`}
                        title={BOOK_COVERS[key].name}
                        className={cn(
                          "focus-visible:ring-ring grid size-7 place-items-center rounded-full border border-black/10 transition-transform focus-visible:ring-2 focus-visible:outline-none active:scale-95",
                          selected && "ring-foreground/70 ring-2 ring-offset-2 ring-offset-[var(--background)]",
                        )}
                        style={{ backgroundColor: BOOK_COVERS[key].cloth }}
                      >
                        {selected && <Check className="size-3.5" style={{ color: BOOK_COVERS[key].ink }} aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {!initial && (
                <fieldset>
                  <legend className="text-label mb-1.5 font-medium">Where does it go?</legend>
                  <Segmented
                    value={shelf}
                    onChange={setShelf}
                    options={[
                      { value: "READING", label: "Reading now" },
                      { value: "UP_NEXT", label: "Up next" },
                    ]}
                  />
                </fieldset>
              )}
            </div>
          </div>

          {errors.form && <FieldError>{errors.form}</FieldError>}

          <DialogFooter className="mt-auto gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:sticky max-sm:-bottom-4 max-sm:rounded-none max-sm:bg-background/95 max-sm:backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 xl:-mx-8 xl:-mb-8 xl:px-8">
            <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()} className="rounded-full px-5">
              {pending ? "Saving…" : initial ? "Save" : "Put it on the shelf"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-label">
      {children}
    </p>
  );
}

/** Two or three choices in a row; one is always chosen. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div role="radiogroup" className="bg-muted/50 border-border inline-flex w-full rounded-full border p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-visible:ring-ring flex-1 rounded-full px-3 py-1.5 text-label font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.hint && <span className="text-muted-foreground hidden font-normal sm:inline"> · {option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
