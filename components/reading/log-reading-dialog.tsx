"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Quote } from "lucide-react";
import { toast } from "sonner";

import { saveReadingLog } from "@/app/(app)/mind/reading-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { addDays, parseLocalDate, toISODate } from "@/lib/dates";
import {
  NOTE_PROMPTS,
  READING_NOTE_MAX,
  READING_QUOTE_MAX,
  amountLabel,
  endOf,
  positionLabel,
} from "@/lib/reading";
import type { BookLog, LogBook } from "@/lib/reading-data";
import { cn } from "@/lib/utils";

import { BookCover } from "./book-cover";
import { Segmented } from "./book-dialog";

type When = "today" | "yesterday" | "other";

/**
 * Log a reading: where you started, where you stopped, and what stayed with
 * you. Opens on where you left off, so most days it's one number and a line.
 * Editing an old reading reopens it here with everything as it was.
 */
export function LogReadingDialog({
  book,
  log = null,
  todayISO,
  onClose,
}: {
  book: LogBook;
  log?: BookLog | null;
  todayISO: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const today = parseLocalDate(todayISO) ?? new Date();
  const yesterdayISO = toISODate(addDays(today, -1));
  const earliestISO = toISODate(addDays(today, -366));

  const percent = book.unit === "PERCENT";
  const end = endOf(book);

  const [from, setFrom] = useState(String(log ? log.fromPage : book.position));
  const [to, setTo] = useState(log ? String(log.toPage) : "");
  const [when, setWhen] = useState<When>(
    !log || log.dateISO === todayISO ? "today" : log.dateISO === yesterdayISO ? "yesterday" : "other",
  );
  const [otherDate, setOtherDate] = useState(log?.dateISO ?? yesterdayISO);
  const [note, setNote] = useState(log?.note ?? "");
  const [quoteOpen, setQuoteOpen] = useState(Boolean(log?.quote));
  const [quote, setQuote] = useState(log?.quote ?? "");
  const [quotePage, setQuotePage] = useState(log?.quotePage != null ? String(log.quotePage) : "");
  const [finishChoice, setFinishChoice] = useState<boolean | null>(null);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const fromNumber = Number(from) || 0;
  const toNumber = to === "" ? fromNumber : Number(to) || 0;
  const moved = Math.max(0, toNumber - fromNumber);
  const reachesEnd = end !== null && to !== "" && toNumber >= end;
  // Offered when this reading reaches the end; ticked unless you untick it.
  const canFinish = reachesEnd && book.status !== "FINISHED";
  const finished = canFinish && (finishChoice ?? true);

  const dateISO = when === "today" ? todayISO : when === "yesterday" ? yesterdayISO : otherDate;
  // A prompt for the day, so the box doesn't ask the same thing every time.
  const prompt = NOTE_PROMPTS[(Number(todayISO.replaceAll("-", "")) + book.id.length) % NOTE_PROMPTS.length];

  const steps = percent ? [1, 5, 10, 25] : [5, 10, 20, 50];
  const bump = (step: number) => {
    const base = to === "" ? fromNumber : toNumber;
    const next = end !== null ? Math.min(end, base + step) : base + step;
    setTo(String(next));
    setError(null);
  };

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const formData = new FormData();
    if (log) formData.set("id", log.id);
    formData.set("bookId", book.id);
    formData.set("date", dateISO);
    formData.set("fromPage", from === "" ? "0" : from);
    formData.set("toPage", to === "" ? (from === "" ? "0" : from) : to);
    formData.set("note", note);
    formData.set("quote", quoteOpen ? quote : "");
    formData.set("quotePage", quoteOpen && quote.trim() ? quotePage || (to === "" ? "" : to) : "");
    formData.set("finished", String(finished));
    startTransition(async () => {
      try {
        const state = await saveReadingLog(formData);
        if (state.status === "error") {
          const [field, message] = Object.entries(state.fieldErrors ?? {})[0] ?? ["form", state.message];
          setError({ field, message });
          return;
        }
        if (state.status === "success" && state.finished) {
          toast.success(`Finished ${book.title}.`, {
            description: "Write it in your own words when you're ready.",
            action: { label: "Open notes", onClick: () => router.push(`/mind/books/${book.id}`) },
          });
        } else {
          toast.success(log ? "Reading updated." : moved > 0 ? `${amountLabel(book.unit, moved)} read.` : "Note kept.");
        }
        onClose();
      } catch {
        setError({ field: "form", message: "Couldn't save that. What you wrote is still here." });
      }
    });
  };

  const unitWord = percent ? "%" : "Page";

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <form
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
        >
          <DialogHeader className="flex-row items-center gap-4 px-6 pt-6 pb-5 text-left">
            <div className="w-12 shrink-0">
              <BookCover title={book.title} cover={book.cover} plain />
            </div>
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="font-display line-clamp-2 text-xl leading-snug">
                {log ? "Edit this reading" : book.title}
              </DialogTitle>
              <DialogDescription>
                {log
                  ? `${book.title} · ${log.dateLabel}`
                  : book.position > 0
                    ? `You're ${percent ? "at" : "on"} ${positionLabel(book, book.position)}.`
                    : "Where did you start, and where did you stop?"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-6 px-6 pb-6">
            {/* Where you started and stopped. */}
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <PageField
                  id="log-from"
                  label="Started at"
                  unit={unitWord}
                  value={from}
                  invalid={error?.field === "fromPage"}
                  onChange={(value) => {
                    setFrom(value);
                    setError(null);
                  }}
                />
                <ArrowRight className="text-muted-foreground mb-4 size-5" aria-hidden />
                <PageField
                  id="log-to"
                  label="Stopped at"
                  unit={unitWord}
                  value={to}
                  autoFocus={!log}
                  invalid={error?.field === "toPage"}
                  onChange={(value) => {
                    setTo(value);
                    setError(null);
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {steps.map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => bump(step)}
                    className="border-border hover:bg-muted focus-visible:ring-ring rounded-full border px-3 py-1 font-mono text-micro tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-95"
                  >
                    +{step}
                    {percent ? "%" : ""}
                  </button>
                ))}
                {end !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setTo(String(end));
                      setError(null);
                    }}
                    className="border-border hover:bg-muted focus-visible:ring-ring rounded-full border px-3 py-1 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-95"
                  >
                    To the end
                  </button>
                )}
                <p aria-live="polite" className="text-muted-foreground ml-auto text-micro tabular-nums">
                  {moved > 0
                    ? `${amountLabel(book.unit, moved)}${end && !percent ? ` · now ${Math.round((Math.min(toNumber, end) / end) * 100)}%` : ""}`
                    : ""}
                </p>
              </div>

              {canFinish && (
                <label className="bg-muted/50 flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3">
                  <Checkbox checked={finished} onCheckedChange={(checked) => setFinishChoice(checked === true)} />
                  <span className="text-label">
                    <span className="font-medium">I&apos;ve finished this book.</span>{" "}
                    <span className="text-muted-foreground">It moves to the Read shelf.</span>
                  </span>
                </label>
              )}
            </div>

            {/* When. */}
            <fieldset className="space-y-2">
              <legend className="text-label mb-2 font-medium">When</legend>
              <Segmented
                value={when}
                onChange={(next) => {
                  setWhen(next);
                  setError(null);
                }}
                options={[
                  { value: "today", label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                  { value: "other", label: "Another day" },
                ]}
              />
              {when === "other" && (
                <Input
                  type="date"
                  aria-label="The day you read"
                  value={otherDate}
                  min={earliestISO}
                  max={todayISO}
                  aria-invalid={error?.field === "date"}
                  onChange={(event) => {
                    setOtherDate(event.target.value);
                    setError(null);
                  }}
                  className="w-auto"
                />
              )}
            </fieldset>

            {/* What stayed with you. */}
            <div className="space-y-2">
              <Label htmlFor="log-note">What stayed with you?</Label>
              <div className="bg-paper border-paper-edge rounded-lg border px-4 pt-2 pb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                {/* The rules live on the wrapper: Chromium won't reliably
                    paint background images inside a textarea. */}
                <div className="paper-ruled">
                  <Textarea
                    id="log-note"
                    rows={4}
                    maxLength={READING_NOTE_MAX}
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setError(null);
                    }}
                    placeholder={prompt}
                    className="font-display text-paper-ink placeholder:text-paper-ink-muted/80 field-sizing-content min-h-[7.6rem] resize-none rounded-none border-0 bg-transparent px-0 py-0 text-[1.05rem] leading-[1.9rem] shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* A line worth keeping. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setQuoteOpen((open) => !open)}
                aria-expanded={quoteOpen}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Quote className="size-3.5" aria-hidden />
                A line worth keeping
                <ChevronDown className={cn("size-3.5 transition-transform", quoteOpen && "rotate-180")} aria-hidden />
              </button>
              {quoteOpen && (
                <div className="grid gap-3 sm:grid-cols-[1fr_6.5rem]">
                  <Textarea
                    aria-label="The line"
                    autoFocus={!log?.quote}
                    rows={2}
                    maxLength={READING_QUOTE_MAX}
                    value={quote}
                    onChange={(event) => setQuote(event.target.value)}
                    placeholder="Copy it as it's written…"
                    className="font-display field-sizing-content min-h-16 resize-none text-[1.05rem] italic"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="log-quote-page" className="text-muted-foreground text-micro">
                      {percent ? "At %" : "On page"}
                    </Label>
                    <Input
                      id="log-quote-page"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={quotePage}
                      placeholder={to || from}
                      onChange={(event) => setQuotePage(event.target.value)}
                      className="tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="text-destructive text-label">
                {error.message}
              </p>
            )}
          </div>

          <DialogFooter className="bg-background/95 border-border sticky bottom-0 z-10 mx-0 mb-0 gap-2 rounded-b-xl border-t px-6 py-4 backdrop-blur">
            <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="rounded-full px-5">
              {pending ? "Saving…" : log ? "Save" : "Log it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PageField({
  id,
  label,
  unit,
  value,
  placeholder,
  autoFocus,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-micro font-medium tracking-wide uppercase">
        {label}
      </Label>
      <div className="relative">
        {unit !== "%" && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-label">
            p.
          </span>
        )}
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-14 font-mono text-2xl tabular-nums [appearance:textfield] md:text-2xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            unit === "%" ? "pr-9 pl-4" : "pl-9",
          )}
        />
        {unit === "%" && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-label">
            %
          </span>
        )}
      </div>
    </div>
  );
}
