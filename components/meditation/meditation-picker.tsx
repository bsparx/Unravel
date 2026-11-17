"use client";

import { useState } from "react";
import { CircleDot, Hand, Minus, Play, Plus, Sparkles, Waves } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BELL_CHOICES,
  DHIKR_SETS,
  DHIKR_TARGETS,
  FAMILIES,
  LEVELS,
  MEDITATIONS,
  MINUTE_CHOICES,
  PHRASE_MAX,
  formatTimer,
  howText,
  meditationTitle,
  normalizeOptions,
  plannedSeconds,
  type DhikrSetId,
  type Family,
  type Level,
  type Meditation,
  type MeditationOptions,
} from "@/lib/meditations";

export type MeditationChoice = { kind: string; options: MeditationOptions };

const FAMILY_ICONS: Record<Family, typeof Waves> = {
  breathing: Waves,
  dhikr: CircleDot,
  guided: Sparkles,
  stillness: Hand,
};

const FILTERS: ("all" | Level)[] = ["all", "easy", "medium", "hard"];

/**
 * Choose a meditation and set it up. Cards are native radios grouped by
 * family, so arrow keys move through them; a filter narrows by level, and
 * a card's level badge follows its own setting (a box at 4 is easy, at 8 is
 * hard). The chosen one's setup sits right under the cards, with Begin.
 */
export function MeditationPicker({
  value,
  onChange,
  onBegin,
}: {
  value: MeditationChoice;
  onChange: (next: MeditationChoice) => void;
  onBegin: () => void;
}) {
  const [filter, setFilter] = useState<"all" | Level>("all");
  // Each card keeps its own last-set options while you browse others.
  const [drafts, setDrafts] = useState<Record<string, MeditationOptions>>({ [value.kind]: value.options });

  const optionsFor = (meditation: Meditation) => normalizeOptions(meditation, drafts[meditation.id] ?? {});
  const selected = MEDITATIONS.find((m) => m.id === value.kind) ?? MEDITATIONS[0];
  // The custom phrase stays exactly as typed while you type it (spaces and
  // all); it's tidied when the session saves.
  const keepPhrase = (options: MeditationOptions, raw: MeditationOptions) =>
    options.set === "custom" && raw.phrase !== undefined ? { ...options, phrase: raw.phrase.slice(0, PHRASE_MAX) } : options;
  const selectedOptions = keepPhrase(normalizeOptions(selected, value.options), value.options);

  const choose = (meditation: Meditation) => onChange({ kind: meditation.id, options: optionsFor(meditation) });
  const update = (patch: MeditationOptions) => {
    const merged = { ...selectedOptions, ...patch };
    const options = keepPhrase(normalizeOptions(selected, merged), merged);
    setDrafts((d) => ({ ...d, [selected.id]: options }));
    onChange({ kind: selected.id, options });
  };

  const families = (Object.keys(FAMILIES) as Family[])
    .map((family) => ({
      family,
      items: MEDITATIONS.filter(
        (m) => m.family === family && (filter === "all" || m.level(optionsFor(m)) === filter),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Filter by level" className="flex flex-wrap gap-2">
        {FILTERS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={filter === level}
            onClick={() => setFilter(level)}
            className={cn(
              "focus-visible:ring-ring rounded-full border px-3.5 py-1.5 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              filter === level
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {level === "all" ? "All" : LEVELS[level].label}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Meditation" className="space-y-6">
        {families.map(({ family, items }) => {
          const Icon = FAMILY_ICONS[family];
          return (
            <section key={family} className="space-y-2.5">
              <h4 className="text-muted-foreground flex items-center gap-1.5 text-label font-medium">
                <Icon className="size-3.5" aria-hidden />
                {FAMILIES[family]}
              </h4>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((meditation) => {
                  const options = meditation.id === selected.id ? selectedOptions : optionsFor(meditation);
                  const checked = meditation.id === selected.id;
                  return (
                    <label
                      key={meditation.id}
                      className={cn(
                        "relative flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-4 transition-colors",
                        checked
                          ? "border-primary/60 bg-primary/[0.06] shadow-[inset_0_0_0_1px_var(--color-primary)]"
                          : "border-border bg-card hover:border-foreground/25",
                      )}
                    >
                      <input
                        type="radio"
                        name="meditation-choice"
                        value={meditation.id}
                        checked={checked}
                        onChange={() => choose(meditation)}
                        className="peer sr-only"
                      />
                      <span className="peer-focus-visible:ring-ring pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2" />
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-body font-medium">{meditationTitle(meditation, options)}</span>
                        <LevelBadge level={meditation.level(options)} />
                      </span>
                      <span className="text-muted-foreground text-label">{meditation.blurb}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
        {families.length === 0 && (
          <p className="text-muted-foreground text-label">Nothing at this level with its current settings.</p>
        )}
      </div>

      <Setup meditation={selected} options={selectedOptions} onChange={update} onBegin={onBegin} />
    </div>
  );
}

function LevelBadge({ level }: { level: Level }) {
  const meta = LEVELS[level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="focus-visible:ring-ring text-muted-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-micro font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="flex gap-0.5" aria-hidden>
            {[1, 2, 3].map((dot) => (
              <span key={dot} className={cn("size-1.5 rounded-full", dot <= meta.dots ? "bg-primary" : "bg-muted-foreground/25")} />
            ))}
          </span>
          {meta.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        {meta.hint}
      </TooltipContent>
    </Tooltip>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const button =
    "border-border hover:bg-muted focus-visible:ring-ring grid size-9 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40";
  return (
    <div className="flex items-center gap-3">
      <span className="text-label font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Less: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
          <Minus className="size-3.5" aria-hidden />
        </button>
        <output aria-live="polite" className="font-display w-8 text-center text-2xl tabular-nums">
          {value}
        </output>
        <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Chips<T extends number | string>({
  label,
  choices,
  value,
  render,
  onChange,
}: {
  label: string;
  choices: readonly T[];
  value: T | undefined;
  render: (choice: T) => string;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-label font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {choices.map((choice) => (
          <button
            key={String(choice)}
            type="button"
            role="radio"
            aria-checked={value === choice}
            onClick={() => onChange(choice)}
            className={cn(
              "focus-visible:ring-ring min-w-11 rounded-full border px-3 py-1.5 text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
              value === choice
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-foreground/30",
            )}
          >
            {render(choice)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The chosen meditation's settings, a tiny preview, and Begin. */
function Setup({
  meditation,
  options,
  onChange,
  onBegin,
}: {
  meditation: Meditation;
  options: MeditationOptions;
  onChange: (patch: MeditationOptions) => void;
  onBegin: () => void;
}) {
  const { controls } = meditation;
  const planned = plannedSeconds(meditation, options);
  const pattern = meditation.pattern?.(options);

  return (
    <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-5">
          <div className="flex items-center gap-1">
            <p className="font-display text-title">{meditationTitle(meditation, options)}</p>
            <InfoTip term="meditation" />
          </div>
          <p className="text-muted-foreground max-w-prose text-label">{howText(meditation, options)}</p>

          {pattern && (
            <p className="flex flex-wrap items-center gap-1.5 text-label" aria-label="The breath, phase by phase">
              {pattern.map((phase, i) => (
                <span key={i} className="bg-muted rounded-full px-2.5 py-1 tabular-nums">
                  {phase.label} {phase.seconds}
                </span>
              ))}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {controls.n && (
              <Stepper
                label={controls.n.label}
                value={options.n ?? controls.n.min}
                min={controls.n.min}
                max={controls.n.max}
                onChange={(n) => onChange({ n })}
              />
            )}
            {controls.out && (
              <Stepper
                label={controls.out.label}
                value={options.out ?? controls.out.min}
                min={controls.out.min}
                max={controls.out.max}
                onChange={(out) => onChange({ out })}
              />
            )}
            {controls.minutes && (
              <Chips label="Minutes" choices={MINUTE_CHOICES} value={options.minutes as (typeof MINUTE_CHOICES)[number]} render={String} onChange={(minutes) => onChange({ minutes })} />
            )}
            {controls.bell && (
              <Chips
                label="A bell every"
                choices={BELL_CHOICES}
                value={options.bell as (typeof BELL_CHOICES)[number]}
                render={(b) => (b === 0 ? "Never" : `${b} min`)}
                onChange={(bell) => onChange({ bell })}
              />
            )}
            {controls.dhikr && (
              <div className="space-y-4">
                <Chips<DhikrSetId>
                  label="Dhikr"
                  choices={[...(Object.keys(DHIKR_SETS) as DhikrSetId[]), "custom"]}
                  value={options.set}
                  render={(set) => (set === "custom" ? "Your own" : DHIKR_SETS[set as Exclude<DhikrSetId, "custom">].name)}
                  onChange={(set) => onChange({ set })}
                />
                {options.set === "custom" && (
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="dhikr-phrase" className="text-label font-medium">
                        Phrase
                      </label>
                      <Input
                        id="dhikr-phrase"
                        value={options.phrase ?? ""}
                        maxLength={PHRASE_MAX}
                        placeholder="SubhanAllahi wa bihamdihi"
                        onChange={(event) => onChange({ phrase: event.target.value })}
                        className="w-64 max-w-full"
                      />
                    </div>
                    <Chips label="Count" choices={DHIKR_TARGETS} value={options.target as (typeof DHIKR_TARGETS)[number]} render={String} onChange={(target) => onChange({ target })} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">
          <button
            type="button"
            onClick={onBegin}
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-medium shadow-sm transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]"
          >
            <Play className="size-4" aria-hidden />
            Begin
          </button>
          <p className="text-muted-foreground text-center text-micro tabular-nums lg:text-right">
            {planned === 0
              ? "Until the count is done"
              : meditation.mode === "breath"
                ? `${formatTimer(planned)} · ends on a full breath`
                : formatTimer(planned)}
          </p>
        </div>
      </div>
    </div>
  );
}
