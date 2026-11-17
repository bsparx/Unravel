import { coverOf } from "@/lib/reading";
import { cn } from "@/lib/utils";

/**
 * A cloth-bound cover made from the book's title: no images to fetch or
 * get wrong. A foil frame, the title set in the display face, the author in
 * spaced capitals, and a ribbon bookmark whose length is how far in you are.
 *
 * Type scales with the cover (container query units), so the same cover
 * reads at shelf size and in a dialog.
 */
export function BookCover({
  title,
  author,
  cover,
  progress,
  plain = false,
  className,
}: {
  title: string;
  author?: string | null;
  cover: string;
  /** 0..1, null when the length isn't known (a short ribbon), undefined for none. */
  progress?: number | null;
  /** Thumbnail size: the cloth and frame without lettering too small to read. */
  plain?: boolean;
  className?: string;
}) {
  const colours = coverOf(cover);
  const words = title.trim() || "Untitled";
  // Long titles step down a size so they fit the frame.
  const scale = words.length > 60 ? 0.72 : words.length > 34 ? 0.84 : 1;

  return (
    <div
      className={cn(
        "book-cloth relative isolate aspect-[2/3] w-full overflow-hidden rounded-[2px_6px_6px_2px] [container-type:inline-size]",
        className,
      )}
      style={{ backgroundColor: colours.cloth, color: colours.ink }}
    >
      {/* The foil frame: a rule and a hairline inside it. */}
      <div
        aria-hidden
        className="absolute inset-[9%_9%_9%_13%] rounded-[2px] border"
        style={{ borderColor: `color-mix(in oklab, ${colours.foil} 70%, transparent)` }}
      />
      <div
        aria-hidden
        className="absolute inset-[11%_11%_11%_15%] rounded-[1px] border"
        style={{ borderColor: `color-mix(in oklab, ${colours.foil} 35%, transparent)` }}
      />

      {!plain && (
      <div className="absolute inset-[11%_13%_11%_17%] flex flex-col items-center justify-center gap-[6cqw] text-center">
        <p
          className="font-display line-clamp-5 leading-[1.12] font-medium text-balance break-words hyphens-auto"
          style={{ fontSize: `calc(${scale} * clamp(0.62rem, 12.5cqw, 1.9rem))` }}
        >
          {words}
        </p>
        <span
          aria-hidden
          className="block h-px w-[22cqw]"
          style={{ backgroundColor: colours.foil }}
        />
        {author ? (
          <p
            className="line-clamp-2 font-medium tracking-[0.16em] uppercase"
            style={{ fontSize: "clamp(0.45rem, 6cqw, 0.8rem)", color: colours.foil }}
          >
            {author}
          </p>
        ) : null}
      </div>
      )}

      {progress !== undefined && (
        <span
          aria-hidden
          className="book-ribbon absolute top-0 right-[3%] w-[5.5%] min-w-1.5 shadow-[1px_1px_2px_rgba(0,0,0,0.3)]"
          style={{
            height: `${progress === null ? 14 : 8 + Math.round(progress * 84)}%`,
            background: `linear-gradient(90deg, color-mix(in oklab, ${colours.foil} 82%, black), ${colours.foil} 45%, color-mix(in oklab, ${colours.foil} 85%, white))`,
          }}
        />
      )}
    </div>
  );
}
