import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The signed-out front door.
 *
 * A component rather than a page: `/` is owned by the focus route, which
 * branches on the session and renders this when there isn't one. That way the
 * landing inherits the same zero-chrome layout the one-thing screen uses.
 */
export function Landing() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-2">
          <span className="bg-primary size-2.5 rounded-full" />
          <span className="font-display text-title tracking-tight">
            Unravel
          </span>
        </div>

        <h1 className="text-display text-balance">
          A list that knows how long things take.
        </h1>

        <p className="text-muted-foreground mt-4 text-body text-pretty">
          Keep your todos and your habits in one place. Give anything a rough
          time estimate, click it, and land on a timer already set up — split
          into pomodoros if you want, running past the goal if you&apos;re in it.
          Everything gets logged, so you can finally see the gap between what you
          planned and what actually happened.
        </p>

        <ul className="text-muted-foreground mt-8 space-y-2.5 text-label">
          <li className="flex gap-3">
            <span className="text-primary" aria-hidden>
              —
            </span>
            A visual clock that drains as the time goes, so duration is something
            you can see rather than calculate.
          </li>
          <li className="flex gap-3">
            <span className="text-primary" aria-hidden>
              —
            </span>
            Three timers: pomodoro, a plain countdown, and a flow timer that
            keeps going until you decide to stop.
          </li>
          <li className="flex gap-3">
            <span className="text-primary" aria-hidden>
              —
            </span>
            Habits on whichever days you pick. Missing a Tuesday doesn&apos;t
            break a Mon/Wed/Fri streak.
          </li>
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/sign-in">I already have an account</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
