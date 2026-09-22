import Link from "next/link";

import type { IdentityReinforcement } from "@/lib/identity-reinforcement";
import { cn } from "@/lib/utils";

/**
 * The identity panels for /habits/stats: the tally per identity ("who you
 * became"), and the hungry ones ("needs focus").
 *
 * Rendered from the same pure tally /identities uses, over the habits the
 * page's filters have in view — identity numbers that disagreed with the rows
 * beside them would be the bug, not the feature. "Who you became" only lists
 * identities with at least one linked habit in view: a habit hidden by a
 * filter must not make its identity look neglected.
 */
export function IdentitiesPanel({
  identities,
}: {
  identities: IdentityReinforcement[];
}) {
  const inView = identities.filter((identity) => identity.linked.length > 0);
  if (inView.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-title">Who you became</h2>
      <p className="text-muted-foreground mt-0.5 mb-3 max-w-prose text-label">
        Every habit is a vote for the kind of person you want to become. A vote
        is a due day where the habit&apos;s minimum was met — over the habits in
        view.
      </p>
      <ul className="space-y-3">
        {inView.map((identity) => (
          <li key={identity.id} className="border-border bg-card rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <Link
                  href="/identities"
                  className="font-display hover:text-primary focus-visible:ring-ring rounded text-title focus-visible:ring-2 focus-visible:outline-none"
                >
                  {identity.name}
                </Link>
                {identity.statement && (
                  <p className="text-muted-foreground text-label">
                    {identity.statement}
                  </p>
                )}
              </div>
              <span className="text-label tabular-nums">
                {identity.reinforcement}%
                <span className="text-muted-foreground">
                  {" "}
                  · {identity.votes} of {identity.expected} votes
                </span>
              </span>
            </div>

            <div className="bg-muted mt-3 flex h-2 w-full overflow-hidden rounded-full">
              <Segment value={identity.optimalVotes} total={identity.expected} className="bg-primary" label={`${identity.optimalVotes} good days`} />
              <Segment value={identity.minimumVotes} total={identity.expected} className="bg-primary/50" label={`${identity.minimumVotes} minimum days`} />
              <Segment value={identity.skipped} total={identity.expected} className="bg-muted-foreground/30" label={`${identity.skipped} skipped`} />
              <Segment value={identity.missed} total={identity.expected} className="bg-destructive/45" label={`${identity.missed} missed`} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-label sm:grid-cols-4">
              <Cell label="Votes" value={String(identity.votes)} detail={`of ${identity.expected} due`} />
              <Cell label="Good days" value={`${identity.optimalShare}%`} detail={identity.votes > 0 ? "of days voted" : undefined} />
              <Cell label="Missed" value={String(identity.missed)} detail={identity.skipped > 0 ? `${identity.skipped} skipped on purpose` : undefined} />
              <Cell
                label="Cold"
                value={String(identity.coldDueDays)}
                detail={
                  identity.coldDueDays > 0
                    ? "due days without a vote"
                    : "voted recently"
                }
              />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The identities to worry about, and precisely what cost them. A pointer, not
 * a verdict — the tone matters here more than anywhere else on the page,
 * because this is the section someone opens to feel bad.
 */
export function NeedsFocusPanel({
  focus,
}: {
  focus: IdentityReinforcement[];
}) {
  if (focus.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-title">Needs focus</h2>
      <p className="text-muted-foreground mt-0.5 mb-3 max-w-prose text-label">
        The identities with the fewest votes this range, and the habits that
        missed. Not a verdict — a pointer at where the next vote would count
        most.
      </p>
      <ul className="space-y-3">
        {focus.map((identity) => (
          <li key={identity.id} className="border-border bg-card rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-body">{identity.name}</h3>
              <span className="text-label tabular-nums">
                {identity.reinforcement}%
                <span className="text-muted-foreground">
                  {" "}
                  · {identity.votes} of {identity.expected} votes
                </span>
              </span>
            </div>

            {identity.coldDueDays > 0 && (
              <p className="text-destructive/80 mt-1 text-label">
                {identity.coldDueDays} due{" "}
                {identity.coldDueDays === 1 ? "day" : "days"} without a vote.
              </p>
            )}

            {identity.starving.length > 0 && (
              <p className="text-muted-foreground mt-1 text-label">
                Missed:{" "}
                {identity.starving.map((habit, index) => (
                  <span key={habit.habitId}>
                    {index > 0 && " · "}
                    <Link
                      href={`/habits/${habit.habitId}`}
                      className="text-foreground hover:text-primary underline underline-offset-4"
                    >
                      {habit.title}
                    </Link>{" "}
                    <span className="tabular-nums">{habit.missed}×</span>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Segment({
  value,
  total,
  className,
  label,
}: {
  value: number;
  total: number;
  className: string;
  label: string;
}) {
  if (value <= 0 || total <= 0) return null;
  return (
    <span
      title={label}
      className={className}
      style={{ width: `${(value / total) * 100}%` }}
    />
  );
}

function Cell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
        {label}
      </dt>
      <dd className={cn("font-mono tabular-nums")}>{value}</dd>
      {detail && <p className="text-muted-foreground text-micro">{detail}</p>}
    </div>
  );
}