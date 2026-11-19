"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Minus, PenLine, Plus, Search, Trash2, X } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { HadithNote } from "@/components/hadith-note";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CustomRecitationRow } from "@/lib/heart-data";
import {
  COUNT_MAX,
  CUSTOM_PREFIX,
  RECITATIONS,
  RECITATION_GROUPS,
  SET_MAX_ITEMS,
  TIME_LABEL,
  findRecitation,
  sessionItem,
  type Recitation,
  type SetItem,
} from "@/lib/recitations";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.min(COUNT_MAX, Math.max(1, Math.round(n) || 1));

/**
 * Build the daily set: what's in it, in what order, how many times each,
 * from the catalogue or from recitations you've written yourself. Nothing
 * is saved until Save, so trying things out costs nothing.
 */
export default function RecitationCustomize({
  set: initial,
  customs,
  onSave,
  onWriteOwn,
  onEditOwn,
  onArchiveOwn,
  onClose,
}: {
  set: SetItem[];
  customs: CustomRecitationRow[];
  onSave: (set: SetItem[]) => Promise<boolean>;
  onWriteOwn: () => void;
  onEditOwn: (row: CustomRecitationRow) => void;
  onArchiveOwn: (row: CustomRecitationRow) => Promise<void>;
  onClose: () => void;
}) {
  const [set, setSet] = useState<SetItem[]>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const customById = useMemo(() => new Map(customs.map((row) => [row.id, row])), [customs]);
  const inSet = new Set(set.map((item) => item.key));
  const full = set.length >= SET_MAX_ITEMS;
  const changed = JSON.stringify(set) !== JSON.stringify(initial);

  const title = (key: string) =>
    key.startsWith(CUSTOM_PREFIX)
      ? (customById.get(key.slice(CUSTOM_PREFIX.length))?.title ?? "Your own")
      : (findRecitation(key)?.title ?? key);

  const add = (key: string, count: number) => {
    if (inSet.has(key) || full) return;
    setSet((list) => [...list, { key, count }]);
  };
  const remove = (key: string) => setSet((list) => list.filter((item) => item.key !== key));
  const setCount = (key: string, count: number) =>
    setSet((list) => list.map((item) => (item.key === key ? { ...item, count: clamp(count) } : item)));
  const move = (index: number, step: -1 | 1) =>
    setSet((list) => {
      const target = index + step;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const needle = query.trim().toLowerCase();
  const matches = (item: Recitation) =>
    !needle ||
    item.title.toLowerCase().includes(needle) ||
    item.arabicTitle.includes(query.trim()) ||
    item.ref.toLowerCase().includes(needle) ||
    TIME_LABEL[item.when].toLowerCase().includes(needle);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(set);
    if (!ok) setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent
        sheetOnPhone
        showCloseButton={false}
        className="flex max-h-[min(52rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 max-sm:bg-background sm:max-w-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <DialogTitle className="font-display text-2xl font-normal">Your daily set</DialogTitle>
            <DialogDescription className="mt-1">
              What you recite each day, in order. The day counts for the oasis once all of it is said.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-10 shrink-0 place-items-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5 sm:px-6">
          {/* The set itself. */}
          <section aria-labelledby="set-heading" className="space-y-3">
            <h3 id="set-heading" className="text-title">
              In your set <span className="text-muted-foreground font-normal">· {set.length}</span>
            </h3>
            {set.length === 0 ? (
              <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-center text-label">
                Nothing yet. Add something below to recite each day.
              </p>
            ) : (
              <ol className="divide-border border-border bg-card divide-y rounded-xl border">
                {set.map((item, index) => (
                  <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap">
                    <span className="text-muted-foreground w-5 shrink-0 text-center font-mono text-xs tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-label font-medium">{title(item.key)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <div className="border-border flex items-center rounded-full border" role="group" aria-label={`Times to say ${title(item.key)}`}>
                        <button
                          type="button"
                          onClick={() => setCount(item.key, item.count - 1)}
                          disabled={item.count <= 1}
                          aria-label="Fewer times"
                          className="hover:bg-accent focus-visible:ring-ring grid size-9 place-items-center rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                        >
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <label className="sr-only" htmlFor={`count-${item.key}`}>
                          Times
                        </label>
                        <input
                          id={`count-${item.key}`}
                          inputMode="numeric"
                          value={item.count}
                          onChange={(event) => setCount(item.key, Number(event.target.value.replace(/\D/g, "")))}
                          className="w-10 bg-transparent text-center font-mono text-sm tabular-nums outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setCount(item.key, item.count + 1)}
                          disabled={item.count >= COUNT_MAX}
                          aria-label="More times"
                          className="hover:bg-accent focus-visible:ring-ring grid size-9 place-items-center rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
                        >
                          <Plus className="size-3.5" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${title(item.key)} up`}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === set.length - 1}
                        aria-label={`Move ${title(item.key)} down`}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.key)}
                        aria-label={`Take ${title(item.key)} out of the set`}
                        className="text-muted-foreground hover:text-destructive focus-visible:ring-ring grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* The catalogue. */}
          <section aria-labelledby="catalogue-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="catalogue-heading" className="text-title">
                Add a recitation
              </h3>
              <div className="relative w-full sm:w-64">
                <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  aria-label="Search recitations"
                  className="min-h-10 pl-9"
                />
              </div>
            </div>
            {full && <p className="text-muted-foreground text-label">A set holds up to {SET_MAX_ITEMS}. Take one out to add another.</p>}

            {RECITATION_GROUPS.map((group) => {
              const list = RECITATIONS.filter((item) => item.group === group.id && matches(item));
              if (list.length === 0) return null;
              return (
                <div key={group.id} className="space-y-2">
                  <h4 className="text-muted-foreground text-micro font-medium tracking-wide uppercase">{group.title}</h4>
                  <ul className="space-y-2">
                    {list.map((item) => {
                      const added = inSet.has(item.id);
                      const expanded = open === item.id;
                      const preview = expanded ? sessionItem({ key: item.id, count: item.defaultCount }) : null;
                      return (
                        <li key={item.id} className="border-border bg-card rounded-xl border">
                          <div className="flex items-start gap-3 px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => setOpen(expanded ? null : item.id)}
                              aria-expanded={expanded}
                              className="focus-visible:ring-ring min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
                            >
                              <span className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 text-label font-medium">{item.title}</span>
                                <span className="recite-arabic text-muted-foreground shrink-0 text-lg leading-none" lang="ar" dir="rtl">
                                  {item.arabicTitle}
                                </span>
                              </span>
                              <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-micro">
                                {TIME_LABEL[item.when]} · ×{item.defaultCount} · {item.ref}
                                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
                              </span>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant={added ? "ghost" : "outline"}
                              disabled={added || full}
                              onClick={() => add(item.id, item.defaultCount)}
                              className="shrink-0 rounded-full"
                            >
                              {added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                              {added ? "In set" : "Add"}
                            </Button>
                          </div>
                          {preview && (
                            <div className="border-border space-y-3 border-t px-4 py-3 text-center">
                              {item.note && <p className="text-muted-foreground text-micro">{item.note}</p>}
                              {preview.parts.flatMap((part, p) =>
                                part.verses.slice(0, 3).map((verse, i) => (
                                  <div key={`${p}-${i}`} className="space-y-1">
                                    {part.title && i === 0 && <p className="text-micro font-medium">{part.title}</p>}
                                    <p className="recite-arabic text-xl leading-[2.1]" lang="ar" dir="rtl">
                                      {verse.ar}
                                    </p>
                                    <p className="text-muted-foreground text-label italic">{verse.tr}</p>
                                    <p className="text-label">{verse.en}</p>
                                  </div>
                                )),
                              )}
                              {preview.parts.some((part) => part.verses.length > 3) && (
                                <p className="text-muted-foreground text-micro">The rest is in the reader.</p>
                              )}
                              <HadithNote
                                tone="plain"
                                className="pt-2"
                                hadith={preview.hadith}
                                sources={preview.parts.flatMap((p) => (p.sources ? [p.sources] : []))}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>

          {/* Your own. */}
          <section aria-labelledby="own-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id="own-heading" className="text-title">
                Your own
              </h3>
              <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onWriteOwn}>
                <PenLine className="size-4" aria-hidden />
                Write your own
              </Button>
            </div>
            {customs.length === 0 ? (
              <p className="text-muted-foreground text-label">
                A du&apos;a from your teacher, a dhikr from your family: write it in Arabic, transliteration or English, and it
                joins your set.
              </p>
            ) : (
              <ul className="divide-border border-border bg-card divide-y rounded-xl border">
                {customs.map((row) => {
                  const key = `${CUSTOM_PREFIX}${row.id}`;
                  const added = inSet.has(key);
                  return (
                    <li key={row.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-label font-medium">{row.title}</span>
                      <button
                        type="button"
                        onClick={() => onEditOwn(row)}
                        aria-label={`Edit ${row.title}`}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <PenLine className="size-4" aria-hidden />
                      </button>
                      <ConfirmDialog
                        title={`Delete “${row.title}”?`}
                        description="It leaves your set and the list. Days you already recited it stay counted."
                        confirmLabel="Delete it"
                        onConfirm={async () => {
                          await onArchiveOwn(row);
                          remove(key);
                        }}
                        trigger={(openConfirm) => (
                          <button
                            type="button"
                            onClick={openConfirm}
                            aria-label={`Delete ${row.title}`}
                            className="text-muted-foreground hover:text-destructive focus-visible:ring-ring grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={added ? "ghost" : "outline"}
                        disabled={added || full}
                        onClick={() => add(key, 1)}
                        className="rounded-full"
                      >
                        {added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                        {added ? "In set" : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || set.length === 0 || !changed} loading={saving}>
            {saving ? "Saving…" : "Save set"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
