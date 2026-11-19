import { ExternalLink } from "lucide-react";

import type { Hadith, TextSource } from "@/lib/recitations";
import { cn } from "@/lib/utils";

const COLLECTIONS = new Set(["Sahih al-Bukhari", "Sahih Muslim"]);

/**
 * The hadith's words exactly as the source has them, only set for reading:
 * a space after the narrator's colon ("said:Allah's" runs together in the
 * source), and the ﷺ ligature drawn in the Arabic face, which has it.
 */
function Words({ text }: { text: string }) {
  const spaced = text.replace(/:(?=[A-Z"'“‘])/g, ": ");
  return spaced.split("ﷺ").map((chunk, i) => (
    <span key={i}>
      {i > 0 && (
        <span
          className="recite-arabic mx-0.5 align-[-0.1em] text-[1.15em] leading-none"
          aria-label="peace be upon him"
        >
          ﷺ
        </span>
      )}
      {chunk}
    </span>
  ));
}

/** "Sahih" for al-Bukhari and Muslim; each grader's verdict for the Sunan. */
export function gradeLine(hadith: Hadith): string {
  if (hadith.grades.every((g) => COLLECTIONS.has(g.by))) return "Sahih";
  return hadith.grades.map((g) => `${g.by}: ${g.grade.trim()}`).join(" · ");
}

/**
 * Why a recitation is said: its hadith, verbatim, with the grading and a link
 * to read it on sunnah.com. Nothing is added to what the hadith says.
 */
export function HadithNote({
  hadith,
  sources,
  className,
  tone = "recite",
}: {
  hadith: readonly Hadith[];
  /** Where the words above came from, one line per field. */
  sources?: readonly TextSource[];
  className?: string;
  /** "recite" inside the dawn reader; "plain" on ordinary surfaces. */
  tone?: "recite" | "plain";
}) {
  if (hadith.length === 0 && !sources?.length) return null;
  const muted =
    tone === "recite"
      ? "text-[var(--recite-ink-muted)]"
      : "text-muted-foreground";
  const edge =
    tone === "recite" ? "border-[var(--recite-line)]" : "border-border";
  const unique = sources?.filter(
    (s, i, all) =>
      all.findIndex((o) => JSON.stringify(o) === JSON.stringify(s)) === i,
  );

  return (
    <div className={cn("space-y-4 text-left", className)}>
      {hadith.length > 0 && (
        <section aria-label="Its hadith" className="space-y-3">
          <p
            className={cn(
              "text-center text-xs font-medium tracking-wide uppercase",
              muted,
            )}
          >
            Why it&apos;s said
          </p>
          {hadith.map((h) => (
            <figure
              key={h.ref}
              className={cn("space-y-2 rounded-2xl border px-4 py-3", edge)}
            >
              <blockquote className="text-sm leading-relaxed">
                <Words text={h.text} />
              </blockquote>
              <figcaption
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs",
                  muted,
                )}
              >
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                >
                  {h.ref}
                  <ExternalLink className="size-3" aria-hidden />
                  <span className="sr-only">(opens sunnah.com)</span>
                </a>
                <span aria-hidden>·</span>
                <span>{gradeLine(h)}</span>
              </figcaption>
            </figure>
          ))}
        </section>
      )}
      {unique && unique.length > 0 && (
        <dl
          className={cn(
            "mx-auto grid max-w-md grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.7rem]",
            muted,
          )}
        >
          {unique.map((s, i) => (
            <div key={i} className="contents">
              <dt>Arabic</dt>
              <dd>{s.arabic}</dd>
              <dt>Transliteration</dt>
              <dd>{s.transliteration}</dd>
              <dt>Translation</dt>
              <dd>{s.translation}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
