import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Feather,
  HandHeart,
  HeartPulse,
  Layers,
  MoonStar,
  Repeat,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { FrogPondLazy } from "@/app/(focus)/_components/frog-pond-lazy";
import { Frog } from "@/app/(focus)/_components/frog";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The frosted panel every surface on this page sits on. */
const GLASS =
  "bg-card rounded-[28px] border border-[var(--card-edge)] shadow-[var(--card-shadow)]";

/**
 * The signed-out front door.
 *
 * A component rather than a page: `/` is owned by the focus route, which
 * branches on the session and renders this when there isn't one. That way the
 * landing inherits the same zero-chrome layout the one-thing screen uses.
 *
 * Calm comes from the same places as in the app: the atmosphere, generous
 * space, and type. Nothing loops except the pond, which is the app's own home
 * screen, and the hero settles in once on arrival.
 */
export function Landing() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-8 sm:pt-7">
        <Link
          href="/"
          className="focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandMark className="text-primary size-7" />
          <span className="font-display text-[1.375rem] tracking-tight">Unravel</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="max-sm:hidden">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <Hero />
        <DayInThree />
        <Practices />
        <Promises />
        <Closing />
      </main>

      <footer className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-6 pb-10 text-label sm:px-8">
        <span className="inline-flex items-center gap-2">
          <BrandMark className="size-5" />
          Unravel
        </span>
        <span>A calm place for your days.</span>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
      <div className="stagger [--stagger-step:80ms]">
        <p className="text-accent-foreground text-label font-semibold">
          Tasks, habits, practices and a timer, in one quiet place
        </p>
        <h1 className="mt-4 text-[2.625rem] leading-[1.08] tracking-[-0.025em] text-balance sm:text-[3.5rem] lg:text-[4rem]">
          A calmer day, <em className="text-primary dark:text-accent-foreground">one small thing</em> at a
          time.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-[34rem] text-[1.125rem] leading-8 text-pretty">
          Each morning Unravel asks one question: what&apos;s the one thing? Then it
          keeps everything else out of the way — pairing small daily habits,
          switchable Mind, Heart and Body practices, and a timer where rest counts too.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-body">
            <Link href="/sign-up">
              Begin gently
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-12 px-5 text-body">
            <Link href="/sign-in">I already have an account</Link>
          </Button>
        </div>
        <p className="text-muted-foreground mt-5 text-label">
          No setup marathon. Start with one thing today, and switch on only the practices you want.
        </p>
      </div>

      <Glimpse />
    </section>
  );
}

/**
 * A still picture of the signed-in home screen, built from the app's own
 * pieces: the pond, a chosen frog, a kept habit rhythm, and the timer ring. It
 * is illustration, so screen readers get one sentence instead of the parts.
 */
function Glimpse() {
  return (
    <figure className="animate-rise relative mx-auto w-full max-w-md [animation-delay:200ms] lg:mr-6 lg:mb-16">
      <figcaption className="sr-only">
        A preview of the home screen: today&apos;s one task on a lilypad, a
        habit kept through the week, and the time left on the timer.
      </figcaption>

      {/* A still wash behind the stack, so the glass has something to hold. */}
      <div
        aria-hidden
        className="bg-primary/20 dark:bg-primary/30 absolute inset-x-6 top-10 bottom-6 -z-10 rounded-full blur-3xl"
      />

      <div aria-hidden className={cn(GLASS, "px-6 pt-3 pb-7 sm:px-7")}>
        <div className="mt-3 flex h-44 items-center overflow-hidden rounded-2xl sm:h-52">
          <FrogPondLazy mood="chosen" className="relative h-full w-full" />
        </div>
        <p className="text-muted-foreground mt-5 text-label font-medium">Today, the frog is</p>
        <p className="font-display mt-2 text-[1.5rem] leading-snug">
          Write the first page of the essay
        </p>
        <div className="border-primary/40 bg-accent/40 mt-5 rounded-lg border-l-2 py-3 pr-4 pl-4">
          <p className="text-accent-foreground text-label font-semibold">Start with</p>
          <p className="mt-1 text-title">
            Open the doc and write one sentence
            <span className="text-muted-foreground ml-2 font-mono text-label">5m</span>
          </p>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <span className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-lg px-4 text-label font-semibold">
            Eat the frog
          </span>
          <span className="text-muted-foreground px-2 text-label">Something else</span>
        </div>
      </div>

      {/* The two small cards drift outside the panel on wide screens and sit
          beneath it on narrow ones, where there's no room to overlap. */}
      <div aria-hidden className="mt-4 grid grid-cols-2 gap-3 lg:mt-0">
        <div
          className={cn(
            GLASS,
            "rounded-2xl p-4 lg:absolute lg:-bottom-24 lg:-left-16 lg:w-56",
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-accent text-accent-foreground inline-grid size-8 shrink-0 place-items-center rounded-xl">
              <Sprout className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-label font-semibold">Read one page</p>
              <p className="text-muted-foreground text-micro">minimum done</p>
            </div>
          </div>
          <WeekDots days={[1, 1, 0, 1, 1, 0, 1]} />
          <p className="text-muted-foreground mt-2 text-micro">5 days kept this week</p>
        </div>

        <div
          className={cn(
            GLASS,
            "flex items-center gap-3 rounded-2xl p-4 lg:absolute lg:-top-8 lg:-right-12 lg:w-52",
          )}
        >
          <TimerRing remaining={0.64} className="size-12 shrink-0" />
          <div>
            <p className="font-mono text-title tabular-nums">16:02</p>
            <p className="text-muted-foreground text-micro">Pomodoro Flow · 25/5</p>
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Seven gentle habit dots: filled on kept days, ringed on rest days. */
function WeekDots({ days }: { days: number[] }) {
  return (
    <div className="mt-3 flex gap-1.5">
      {days.map((kept, index) => (
        <span
          key={index}
          className={cn(
            "size-3.5 rounded-full",
            kept
              ? "bg-primary"
              : "shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--primary)_38%,transparent)]",
          )}
        />
      ))}
    </div>
  );
}

/**
 * The timer's depletion ring, frozen: the arc that's left is what's coloured.
 * `pathLength` makes the dash a fraction of the circle at any size.
 */
function TimerRing({ remaining, className }: { remaining: number; className?: string }) {
  const left = Math.round(remaining * 100);
  return (
    <svg viewBox="0 0 48 48" className={cn("-rotate-90", className)} aria-hidden>
      <circle cx="24" cy="24" r="19" fill="none" strokeWidth="5" className="stroke-arc-track" />
      <circle
        cx="24"
        cy="24"
        r="19"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${left} ${100 - left}`}
        className="stroke-running"
      />
    </svg>
  );
}

const DAY: { time: string; title: string; body: string; art: React.ReactNode }[] = [
  {
    time: "Morning",
    title: "Choose the frog",
    body: "One question, asked once: which thing are you avoiding? Pick it, and the rest of the list waits its turn.",
    art: <Frog className="h-11 w-auto" />,
  },
  {
    time: "Through the day",
    title: "See the time go",
    body: "Tap a task and land on a timer that drains as you work. Pomodoro Flow lets you keep flowing past your baseline until you're ready to pause.",
    art: <TimerRing remaining={0.4} className="size-11" />,
  },
  {
    time: "Evening",
    title: "Set the day down",
    body: "Two quiet minutes to close the day and choose tomorrow's frog while today is fresh. A blank day is neutral, never a failure.",
    art: (
      <span className="bg-rest-muted text-rest inline-grid size-11 place-items-center rounded-full">
        <MoonStar className="size-5" aria-hidden />
      </span>
    ),
  },
];

function DayInThree() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
      <SectionHeading
        eyebrow="How a day goes"
        title="Three small moments. That's the whole system."
      />
      <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
        {DAY.map((moment, index) => (
          <li key={moment.title} className={cn(GLASS, "flex flex-col rounded-3xl p-6 sm:p-7")}>
            <div className="flex h-12 items-center justify-between">
              {moment.art}
              <span className="text-muted-foreground font-mono text-label">0{index + 1}</span>
            </div>
            <p className="text-accent-foreground mt-6 text-label font-semibold">{moment.time}</p>
            <h3 className="mt-1 text-heading">{moment.title}</h3>
            <p className="text-muted-foreground mt-3 text-body text-pretty">{moment.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SPACES: {
  icon: LucideIcon;
  name: string;
  tagline: string;
  body: string;
  detail: string;
}[] = [
  {
    icon: Repeat,
    name: "Habits",
    tagline: "One minimum, never two",
    body: "Set the smallest version that counts on your worst day, stack it onto a cue, and notice shadow patterns without penalties.",
    detail: "Optional extra logged quietly",
  },
  {
    icon: Brain,
    name: "Mind",
    tagline: "Clear, still and focused",
    body: "Brain dumps to empty your head, guided breathing and dhikr meditations, a reading shelf, WOOP plans and ABCDE disputations.",
    detail: "Five switchable practices",
  },
  {
    icon: HandHeart,
    name: "Heart",
    tagline: "Thanks, asking and remembrance",
    body: "Daily gratitude pages, du'a templates from quick lists to full adab, and daily Quran & sunnah recitations with a tap counter.",
    detail: "Three quiet daily pages",
  },
  {
    icon: HeartPulse,
    name: "Body",
    tagline: "Movement and fasting",
    body: "Corrective yoga and dumbbell routines with guided form videos, alongside intermittent or Islamic fasting on your own schedule.",
    detail: "Rest days hold scenes steady",
  },
];

function Practices() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div className="lg:pt-2">
          <SectionHeading
            eyebrow="Beyond the to-do list"
            title="Tend to your mind, heart and body, too."
          />
          <p className="text-muted-foreground mt-5 max-w-md text-body text-pretty">
            A good day is more than crossing off tasks. Unravel brings your
            habits, reflections, exercises and fasts together into the same calm
            space.
          </p>
          <p className="text-muted-foreground mt-4 max-w-md text-body text-pretty">
            Every practice is switchable in Settings — keep only what serves
            you, and watch each quiet illustrated scene grow as you return to it.
          </p>
          <p className="text-muted-foreground mt-6 text-label">
            All of it rolls into one clear daily statistics view.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {SPACES.map(({ icon: Icon, name, tagline, body, detail }) => (
            <li
              key={name}
              className={cn(GLASS, "relative flex flex-col overflow-hidden rounded-2xl p-5")}
            >
              <div className="flex items-center gap-3">
                <span className="bg-accent text-accent-foreground inline-grid size-10 shrink-0 place-items-center rounded-xl">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-title font-semibold">{name}</p>
                  <p className="text-muted-foreground text-micro">{tagline}</p>
                </div>
              </div>
              <p className="text-muted-foreground mt-4 flex-1 text-label leading-6 text-pretty">
                {body}
              </p>
              <p className="text-foreground/80 mt-4 flex items-center gap-2 text-micro font-medium">
                <Sprout className="text-primary size-3.5 shrink-0" aria-hidden />
                {detail}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PROMISES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Feather,
    title: "Small counts",
    body: "Every habit has a minimum, like one page or one push-up. Doing the minimum completes the day.",
  },
  {
    icon: MoonStar,
    title: "Rest is real time",
    body: "Recovery gets its own timer and its own colour, next to work rather than beneath it.",
  },
  {
    icon: Sprout,
    title: "Nothing to lose",
    body: "Miss a day and nothing shatters. Scheduled rest days hold steady, with no warnings or penalties.",
  },
  {
    icon: Layers,
    title: "One place",
    body: "Tasks, habits, calendar blocks, practices and your timer share one calm home — switch off anything you don't use.",
  },
];

function Promises() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
      <div className={cn(GLASS, "p-6 sm:p-10 lg:p-12")}>
        <SectionHeading eyebrow="Built to be gentle" title="Made for the days that feel like too much." />
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span className="bg-accent text-accent-foreground inline-grid size-10 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-title">{title}</h3>
              <p className="text-muted-foreground mt-2 text-label leading-6 text-pretty">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-10 pb-20 text-center sm:px-8 sm:pb-28">
      <BrandMark className="text-primary mx-auto size-10" />
      <h2 className="font-display mt-6 text-[2.25rem] leading-tight font-medium tracking-[-0.02em] text-balance sm:text-[2.75rem]">
        Take a breath. Then one small thing.
      </h2>
      <p className="text-muted-foreground mx-auto mt-4 max-w-md text-body text-pretty">
        It takes about a minute to begin, and the first thing it asks is what
        matters today.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" className="h-12 px-6 text-body">
          <Link href="/sign-up">
            Begin gently
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-12 px-5 text-body">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-accent-foreground text-label font-semibold">{eyebrow}</p>
      <h2 className="font-display mt-3 max-w-2xl text-[1.875rem] leading-tight font-medium tracking-[-0.02em] text-balance sm:text-[2.375rem]">
        {title}
      </h2>
    </div>
  );
}
