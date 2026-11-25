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
  RECITATION_TOPICS,
  SET_MAX_ITEMS,
  TIME_LABEL,
  findRecitation,
  itemTotal,
  recitationMatchesQuery,
  sessionItem,
  type RecitationGroup,
  type RecitationTopic,
  type SetItem,
} from "@/lib/recitations";
import { cn } from "@/lib/utils";

const clamp = (n: number) => Math.min(COUNT_MAX, Math.max(1, Math.round(n) || 1));

const topicCounts = Object.fromEntries(
  RECITATION_TOPICS.map((t) => [t.id, RECITATIONS.filter((item) => item.topics?.includes(t.id)).length]),
) as Record<RecitationTopic, number>;

type FilterTab = "all" | RecitationGroup | "own";

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
  const [activeGroup, setActiveGroup] = useState<FilterTab>("all");
  const [activeTopic, setActiveTopic] = useState<RecitationTopic | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const customById = useMemo(() => new Map(customs.map((row) => [row.id, row])), [customs]);
  const inSet = new Set(set.map((item) => item.key));
  const full = set.length >= SET_MAX_ITEMS;
  const changed = JSON.stringify(set) !== JSON.stringify(initial);

  const totalTimes = useMemo(
    () =>
      set.reduce((sum, item) => {
        if (item.key.startsWith(CUSTOM_PREFIX)) return sum + item.count;
        const resolved = sessionItem(item);
        return sum + (resolved ? itemTotal(resolved) : item.count);
      }, 0),
    [set],
  );

  const meta = (key: string) => {
    if (key.startsWith(CUSTOM_PREFIX)) {
      const row = customById.get(key.slice(CUSTOM_PREFIX.length));
      return { title: row?.title ?? "Your own", subtitle: "Your own" };
    }
    const item = findRecitation(key);
    return {
      title: item?.title ?? key,
      subtitle: item ? `${TIME_LABEL[item.when]} · ${item.ref}` : "",
    };
  };

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

  const visibleGroups =
    activeGroup === "own"
      ? []
      : RECITATION_GROUPS.filter((g) => activeGroup === "all" || g.id === activeGroup)
          .map((group) => ({
            group,
            list: RECITATIONS.filter(
              (item) =>
                item.group === group.id &&
                (!activeTopic || item.topics?.includes(activeTopic)) &&
                recitationMatchesQuery(item, query),
            ),
          }))
          .filter(({ list }) => list.length > 0);

  const needle = query.trim().toLowerCase();
  const topicTitle = RECITATION_TOPICS.find((t) => t.id === activeTopic)?.title;
  // Your own recitations carry no topic: a topic filter leaves them out.
  const visibleCustoms =
    !activeTopic && (activeGroup === "all" || activeGroup === "own")
      ? customs.filter(
          (row) =>
            !needle ||
            row.title.toLowerCase().includes(needle) ||
            row.translation.toLowerCase().includes(needle) ||
            row.transliteration.toLowerCase().includes(needle) ||
            row.arabic.includes(query.trim()),
        )
      : [];

  const showOwnSection =
    !activeTopic && (activeGroup === "own" || (activeGroup === "all" && (!needle || visibleCustoms.length > 0)));
  const emptySearch =
    (needle.length > 0 || activeTopic !== null) && visibleGroups.length === 0 && visibleCustoms.length === 0;

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
        className="flex flex-col gap-0 overflow-hidden p-0 max-sm:bg-background sm:h-[min(56rem,90dvh)] sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-[26px] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl"
      >
        {/* Serene sticky header */}
        <header className="border-border/60 bg-popover/95 flex shrink-0 items-start justify-between gap-4 border-b px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 backdrop-blur sm:px-8 sm:pt-6 sm:pb-5">
          <div className="min-w-0">
            <DialogTitle className="font-display pr-0 text-2xl leading-tight font-normal sm:text-[30px]">
              Your daily set
            </DialogTitle>
            <DialogDescription className="mt-1 text-label">
              Choose what you recite each day and set the order. The day counts for the oasis once all of it is said.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring -mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </header>

        {/* Body: single smooth scroll on phone/tablet; side-by-side workspace on desktop */}
        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.32fr)_minmax(23rem,0.88fr)] lg:overflow-hidden">
          {/* Right pane on desktop, top section on mobile/tablet: In your set */}
          <aside
            aria-labelledby="set-heading"
            className="border-border/60 bg-muted/20 flex flex-col border-b lg:order-2 lg:min-h-0 lg:border-b-0 lg:border-l"
          >
            <div className="flex shrink-0 items-baseline justify-between gap-3 px-5 pt-5 pb-3 sm:px-7 lg:px-6 lg:pt-6">
              <div>
                <h3 id="set-heading" className="text-title font-medium">
                  In your set{" "}
                  <span className="text-muted-foreground font-mono text-sm font-normal tabular-nums">
                    · {set.length}
                  </span>
                </h3>
                <p className="text-muted-foreground mt-0.5 text-micro tabular-nums">
                  {totalTimes.toLocaleString("en-GB")} {totalTimes === 1 ? "time" : "times"} said in all
                  {full ? ` · full (${SET_MAX_ITEMS} max)` : ""}
                </p>
              </div>
              {set.length > 0 && (
                <span className="text-muted-foreground font-mono text-micro tabular-nums">
                  {set.length}/{SET_MAX_ITEMS}
                </span>
              )}
            </div>

            <div className="px-5 pb-5 sm:px-7 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-6 lg:pb-6 [scrollbar-width:thin]">
              {set.length === 0 ? (
                <p className="text-muted-foreground border-border/80 bg-card/50 rounded-2xl border border-dashed px-4 py-8 text-center text-label">
                  Nothing yet. Add recitations from the catalogue to build your daily set.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {set.map((item, index) => {
                    const info = meta(item.key);
                    return (
                      <li
                        key={item.key}
                        className="border-border/70 bg-card rounded-2xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="bg-muted text-muted-foreground mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[0.7rem] font-medium tabular-nums">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-label leading-snug font-medium">{info.title}</p>
                            {info.subtitle && (
                              <p className="text-muted-foreground mt-0.5 truncate text-micro">{info.subtitle}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(item.key)}
                            aria-label={`Take ${info.title} out of the set`}
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 pl-8">
                          <div
                            className="border-border bg-background/60 flex items-center rounded-full border"
                            role="group"
                            aria-label={`Times to say ${info.title}`}
                          >
                            <button
                              type="button"
                              onClick={() => setCount(item.key, item.count - 1)}
                              disabled={item.count <= 1}
                              aria-label="Fewer times"
                              className="hover:bg-accent focus-visible:ring-ring grid size-8 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-35"
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
                              className="w-11 bg-transparent text-center font-mono text-sm tabular-nums outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setCount(item.key, item.count + 1)}
                              disabled={item.count >= COUNT_MAX}
                              aria-label="More times"
                              className="hover:bg-accent focus-visible:ring-ring grid size-8 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-35"
                            >
                              <Plus className="size-3.5" aria-hidden />
                            </button>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => move(index, -1)}
                              disabled={index === 0}
                              aria-label={`Move ${info.title} up`}
                              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring grid size-8 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-25"
                            >
                              <ArrowUp className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(index, 1)}
                              disabled={index === set.length - 1}
                              aria-label={`Move ${info.title} down`}
                              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring grid size-8 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-25"
                            >
                              <ArrowDown className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>

          {/* Left pane on desktop, lower section on mobile/tablet: Catalogue + Your own */}
          <section aria-labelledby="catalogue-heading" className="flex min-w-0 flex-col lg:order-1 lg:min-h-0">
            <div className="border-border/60 shrink-0 space-y-3.5 border-b px-5 pt-5 pb-4 sm:px-7 lg:px-8 lg:pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="catalogue-heading" className="text-title font-medium">
                  Catalogue
                </h3>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onWriteOwn}>
                  <PenLine className="size-3.5" aria-hidden />
                  Write your own
                </Button>
              </div>

              <div className="relative">
                <Search
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by title, words, Arabic or hadith reference…"
                  aria-label="Search recitations"
                  className="min-h-11 rounded-xl pl-10 pr-9"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 grid size-7 -translate-y-1/2 place-items-center rounded-full"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Catalogue categories">
                {(
                  [
                    { id: "all", label: "All", count: RECITATIONS.length + customs.length },
                    ...RECITATION_GROUPS.map((g) => ({
                      id: g.id,
                      label: g.shortTitle,
                      count: RECITATIONS.filter((item) => item.group === g.id).length,
                    })),
                    { id: "own", label: "Your own", count: customs.length },
                  ] as const
                ).map((tab) => {
                  const selected = activeGroup === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setActiveGroup(tab.id);
                        // Your own recitations carry no topic, so a topic would hide them all.
                        if (tab.id === "own") setActiveTopic(null);
                      }}
                      className={cn(
                        "focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/80 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {tab.label}
                      <span className={cn("font-mono text-[0.7rem] tabular-nums", selected ? "opacity-80" : "opacity-65")}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by need">
                <span className="text-muted-foreground mr-1 text-micro font-medium tracking-wider uppercase">For</span>
                {RECITATION_TOPICS.map((topic) => {
                  const pressed = activeTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => {
                        setActiveTopic(pressed ? null : topic.id);
                        if (!pressed && activeGroup === "own") setActiveGroup("all");
                      }}
                      className={cn(
                        "focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none",
                        pressed
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border/80 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      {topic.title}
                      <span className={cn("font-mono text-[0.7rem] tabular-nums", pressed ? "opacity-80" : "opacity-65")}>
                        {topicCounts[topic.id]}
                      </span>
                      {pressed && <X className="size-3" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              {full && (
                <p className="text-muted-foreground text-label">
                  A set holds up to {SET_MAX_ITEMS}. Remove one from your set to add another.
                </p>
              )}
            </div>

            <div className="space-y-7 px-5 py-5 sm:px-7 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:py-6 [scrollbar-width:thin]">
              {emptySearch ? (
                <p className="text-muted-foreground border-border/80 rounded-2xl border border-dashed px-4 py-10 text-center text-label">
                  {needle
                    ? `No recitations match “${query.trim()}”${topicTitle ? ` under ${topicTitle}` : ""}.`
                    : `Nothing under ${topicTitle} in this category.`}
                </p>
              ) : (
                <>
                  {visibleGroups.map(({ group, list }) => (
                    <div key={group.id} className="space-y-2.5">
                      <h4 className="text-muted-foreground text-micro font-medium tracking-wider uppercase">
                        {group.title} · {list.length}
                      </h4>
                      <ul className="space-y-2.5">
                        {list.map((item) => {
                          const added = inSet.has(item.id);
                          const expanded = open === item.id;
                          const preview = expanded ? sessionItem({ key: item.id, count: item.defaultCount }) : null;
                          return (
                            <li
                              key={item.id}
                              className={cn(
                                "rounded-2xl border transition-colors",
                                added
                                  ? "border-primary/30 bg-primary/[0.03]"
                                  : "border-border/70 bg-card hover:border-border",
                              )}
                            >
                              <div className="flex items-start gap-3 px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setOpen(expanded ? null : item.id)}
                                  aria-expanded={expanded}
                                  className="focus-visible:ring-ring min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
                                >
                                  <span className="flex items-baseline justify-between gap-3">
                                    <span className="min-w-0 text-[15px] leading-snug font-medium">{item.title}</span>
                                    {item.arabicTitle && (
                                      <span
                                        className="recite-arabic text-muted-foreground shrink-0 text-lg leading-none"
                                        lang="ar"
                                        dir="rtl"
                                      >
                                        {item.arabicTitle}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-micro">
                                    <span>{TIME_LABEL[item.when]}</span>
                                    <span aria-hidden>·</span>
                                    <span className="font-mono tabular-nums">×{item.defaultCount}</span>
                                    <span aria-hidden>·</span>
                                    <span>{item.ref}</span>
                                    <ChevronDown
                                      className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
                                      aria-hidden
                                    />
                                  </span>
                                </button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={added ? "ghost" : "outline"}
                                  disabled={added || full}
                                  onClick={() => add(item.id, item.defaultCount)}
                                  className="mt-0.5 shrink-0 rounded-full px-3.5"
                                >
                                  {added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                                  {added ? "In set" : "Add"}
                                </Button>
                              </div>
                              {preview && (
                                <div className="border-border/60 bg-background/40 space-y-4 rounded-b-2xl border-t px-5 py-4 text-center sm:px-6">
                                  {item.note && <p className="text-muted-foreground text-micro">{item.note}</p>}
                                  {preview.parts.flatMap((part, p) =>
                                    part.verses.slice(0, 3).map((verse, i) => (
                                      <div key={`${p}-${i}`} className="space-y-1.5">
                                        {part.title && i === 0 && (
                                          <p className="text-muted-foreground text-micro font-medium">{part.title}</p>
                                        )}
                                        <p className="recite-arabic text-2xl leading-[2.2]" lang="ar" dir="rtl">
                                          {verse.ar}
                                        </p>
                                        <p className="text-muted-foreground mx-auto max-w-prose text-label italic">
                                          {verse.tr}
                                        </p>
                                        <p className="mx-auto max-w-prose text-[15px] leading-relaxed">{verse.en}</p>
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
                  ))}

                  {showOwnSection && (
                    <div className="space-y-2.5">
                      <h4 className="text-muted-foreground text-micro font-medium tracking-wider uppercase">
                        Your own{visibleCustoms.length > 0 ? ` · ${visibleCustoms.length}` : ""}
                      </h4>
                      {visibleCustoms.length === 0 ? (
                        <div className="border-border/80 bg-card/50 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-7 text-center">
                          <p className="text-muted-foreground max-w-md text-label">
                            A du&apos;a from your teacher or a dhikr from your family: write it in Arabic,
                            transliteration or English, and it joins your set.
                          </p>
                          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onWriteOwn}>
                            <PenLine className="size-3.5" aria-hidden />
                            Write your own
                          </Button>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {visibleCustoms.map((row) => {
                            const key = `${CUSTOM_PREFIX}${row.id}`;
                            const added = inSet.has(key);
                            return (
                              <li
                                key={row.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-2xl border px-4 py-2.5 transition-colors",
                                  added ? "border-primary/30 bg-primary/[0.03]" : "border-border/70 bg-card",
                                )}
                              >
                                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{row.title}</span>
                                <button
                                  type="button"
                                  onClick={() => onEditOwn(row)}
                                  aria-label={`Edit ${row.title}`}
                                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none"
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
                                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring grid size-9 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none"
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
                                  className="rounded-full px-3.5"
                                >
                                  {added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                                  {added ? "In set" : "Add"}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        {/* Serene sticky footer */}
        <footer className="border-border/60 bg-popover/95 flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-8 sm:py-4">
          <p className="text-muted-foreground text-label max-sm:hidden">
            {changed
              ? `Unsaved changes · ${set.length} ${set.length === 1 ? "recitation" : "recitations"} in your set`
              : `${set.length} ${set.length === 1 ? "recitation" : "recitations"} · ${totalTimes.toLocaleString("en-GB")} ${totalTimes === 1 ? "time" : "times"} said in all`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" className="min-h-10 rounded-full px-5" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-10 rounded-full px-6"
              onClick={() => void save()}
              disabled={saving || set.length === 0 || !changed}
              loading={saving}
            >
              {saving ? "Saving…" : "Save set"}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
