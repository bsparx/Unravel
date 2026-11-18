import { cn } from "@/lib/utils";
import { firstLine, pageGroups, type PracticeItem } from "@/lib/practices";

const ARCH_EDGE = "ring-1 ring-[var(--woop-glass-edge)] shadow-[0_24px_48px_-28px_rgba(30,24,90,0.6)]";

/**
 * A day's du'a, kept in an arched window onto the night it was written in:
 * the star lattice of a masjid ceiling, the crescent in the crown of the
 * arch, and each du'a centred under the last with a small eight-point star
 * between them, closing on "Ameen."
 */
export function DuaArch({
  dateLabel,
  templateName,
  items,
  className,
}: {
  dateLabel?: string;
  templateName: string;
  items: readonly PracticeItem[];
  className?: string;
}) {
  const groups = pageGroups(items);

  return (
    <figure
      className={cn(
        "dua-sky-night relative isolate overflow-hidden rounded-t-[50%_7rem] rounded-b-2xl px-6 pt-10 pb-9 text-center text-[var(--woop-ink)] sm:rounded-t-[50%_10rem] sm:px-14 sm:pt-12",
        ARCH_EDGE,
        className,
      )}
    >
      {/* The window's inner frame, following the same arch. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-2.5 -z-10 rounded-t-[50%_6.4rem] rounded-b-xl border border-[var(--woop-glass-edge)] opacity-70 sm:rounded-t-[50%_9.4rem]"
      />

      <span aria-hidden className="dua-crescent mx-auto block size-[1em] text-4xl" />

      <header className="mt-4 mb-8">
        {dateLabel && <p className="font-display text-xl leading-tight">{dateLabel}</p>}
        <p className={cn("text-[var(--woop-ink-muted)]", dateLabel ? "mt-1 text-micro" : "text-label")}>{templateName}</p>
      </header>

      <ol className="mx-auto max-w-prose">
        {groups.map((group, index) => (
          <li key={`${group.step}-${index}`}>
            {index > 0 && <span aria-hidden className="dua-star mx-auto my-6" />}
            {!group.numbered && (
              <p className="mb-1.5 text-micro font-medium tracking-wide text-[var(--woop-ink-muted)]">{group.step}</p>
            )}
            {group.lines.map((line, lineIndex) =>
              lineIndex === 0 ? (
                <p
                  key={line.key}
                  className="font-display text-xl leading-relaxed break-words whitespace-pre-line italic sm:text-[1.375rem]"
                >
                  {line.text}
                </p>
              ) : (
                <div key={line.key} className="mt-2.5">
                  <p className="text-micro font-medium text-[var(--woop-ink)] opacity-80">{line.label}</p>
                  <p className="text-label break-words whitespace-pre-line text-[var(--woop-ink-muted)]">{line.text}</p>
                </div>
              ),
            )}
          </li>
        ))}
      </ol>

      <figcaption className="font-display mt-8 text-lg text-[var(--woop-ink-muted)] italic">Ameen.</figcaption>
    </figure>
  );
}

/**
 * A past du'a as a small arched window: its night, its crescent, the date,
 * and the first line. Opening it shows the whole page.
 */
export function DuaWindow({
  dateLabel,
  templateName,
  items,
  onOpen,
}: {
  dateLabel: string;
  templateName: string;
  items: readonly PracticeItem[];
  onOpen: () => void;
}) {
  const groups = pageGroups(items);
  const counted = groups.length > 0 && groups.every((group) => group.numbered);
  const caption = counted ? `${groups.length} ${groups.length === 1 ? "du'a" : "du'as"}` : templateName;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Du'a from ${dateLabel}, ${caption}. Open it.`}
      className={cn(
        "dua-sky-night group/window focus-visible:ring-ring relative flex h-full min-h-52 w-full flex-col items-center rounded-t-[50%_4.5rem] rounded-b-xl px-4 pt-7 pb-4 text-center text-[var(--woop-ink)] transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:outline-none active:scale-[0.98] motion-safe:hover:-translate-y-1",
        ARCH_EDGE,
      )}
    >
      <span aria-hidden className="dua-crescent block size-[1em] text-2xl" />
      <span className="font-display mt-3 text-body leading-tight">{dateLabel}</span>
      <span className="mt-0.5 text-micro text-[var(--woop-ink-muted)]">{caption}</span>
      <span className="font-display mt-auto line-clamp-3 pt-4 text-label text-[var(--woop-ink-muted)] italic">
        {firstLine(items)}
      </span>
    </button>
  );
}
