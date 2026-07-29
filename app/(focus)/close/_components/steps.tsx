"use client";

import { useState } from "react";
import { ArrowRight, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PassOption } from "@/app/(focus)/_components/morning-pass";
import { cn } from "@/lib/utils";

import {
  bailOut,
  handOff,
  saveGratitude,
  saveWorry,
  setTomorrowOneThing,
} from "../actions";

/**
 * Four screens, one input each.
 *
 * Ritual, not form-filling: no progress bar, no "step 2 of 4", no back-and-next
 * chrome. The only escape is a quiet "leave it for tonight", and it doesn't
 * lose anything because each step has already written.
 */

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center px-6 py-24">
      <p className="text-micro text-muted-foreground mb-6 font-medium tracking-wider uppercase">
        {eyebrow}
      </p>
      <h1 className="font-display text-display text-balance">{title}</h1>
      <div className="mt-10">{children}</div>
      <form action={bailOut} className="mt-12">
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded text-label underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          Leave it for tonight
        </button>
      </form>
    </main>
  );
}

export function StepOneThing({
  options,
  dateISO,
}: {
  options: PassOption[];
  dateISO: string;
}) {
  const [typed, setTyped] = useState("");

  return (
    <Shell eyebrow="Closing the day" title="What's tomorrow's one thing?">
      <p className="text-muted-foreground mb-6 text-body">
        Decide it now, while today is still in your head. Tomorrow morning it&apos;ll
        be waiting and you won&apos;t have to choose anything.
      </p>

      {options.length > 0 && (
        <ul className="mb-6 space-y-1.5">
          {options.map((option) => (
            <li key={`${option.kind}-${option.id}`}>
              <form action={setTomorrowOneThing}>
                <input type="hidden" name="date" value={dateISO} />
                <input
                  type="hidden"
                  name={option.kind === "task" ? "taskId" : "captureId"}
                  value={option.id}
                />
                <button
                  type="submit"
                  className="group border-border hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body">
                      {option.label}
                    </span>
                    {option.detail && (
                      <span className="text-muted-foreground text-label">
                        {option.detail}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary size-4 shrink-0"
                    aria-hidden
                  />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={setTomorrowOneThing} className="flex gap-2">
        <input type="hidden" name="date" value={dateISO} />
        <label htmlFor="tomorrow-title" className="sr-only">
          Or type tomorrow&apos;s one thing
        </label>
        <Input
          id="tomorrow-title"
          name="title"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder={options.length > 0 ? "Or something else…" : "Type it here…"}
          className="h-11 text-body"
        />
        <Button type="submit">Next</Button>
      </form>
    </Shell>
  );
}

export function StepWorry({ initial }: { initial: string }) {
  return (
    <Shell eyebrow="Closing the day" title="What's still on your mind?">
      <p className="text-muted-foreground mb-6 text-body">
        Put it here so you&apos;re not carrying it around all night. Nobody reads
        this, including the app — it&apos;s saved and then left alone.
      </p>

      <form action={saveWorry} className="space-y-4">
        <label htmlFor="worry" className="sr-only">
          Anything still on your mind
        </label>
        <Textarea
          id="worry"
          name="body"
          rows={6}
          maxLength={5000}
          defaultValue={initial}
          autoFocus
          placeholder="Anything at all. Or nothing — that's a fine answer too."
          className="resize-none text-body"
        />
        <Button type="submit">Next</Button>
      </form>
    </Shell>
  );
}

export function StepGratitude({
  initial,
  prompt,
}: {
  initial: string;
  prompt: string;
}) {
  return (
    <Shell eyebrow="Closing the day" title="One good thing.">
      <form action={saveGratitude} className="space-y-4">
        <label htmlFor="gratitude" className="sr-only">
          One good thing about today
        </label>
        <Input
          id="gratitude"
          name="body"
          maxLength={300}
          defaultValue={initial}
          autoFocus
          autoComplete="off"
          placeholder={prompt}
          className="h-12 text-body"
        />
        <Button type="submit">Next</Button>
      </form>
    </Shell>
  );
}

export function StepHandoff({ oneThing }: { oneThing: string | null }) {
  return (
    <Shell eyebrow="That's the day" title="Done. Go and rest.">
      <p className="text-muted-foreground mb-8 text-body">
        {oneThing ? (
          <>
            Tomorrow is <span className="text-foreground">{oneThing}</span>.
            It&apos;ll be on the screen when you open this. Nothing else needs
            deciding tonight.
          </>
        ) : (
          <>Nothing else needs deciding tonight.</>
        )}
      </p>

      <form action={handOff}>
        <Button
          type="submit"
          size="lg"
          className={cn("bg-rest text-rest-foreground hover:bg-rest/90")}
        >
          <Moon className="size-4" aria-hidden />
          Start the reading timer
        </Button>
      </form>

      <p className="text-muted-foreground mt-4 text-label">
        It counts up, has no target, and stops when you say so. It gets logged
        exactly like work does.
      </p>
    </Shell>
  );
}
