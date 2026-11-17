import Link from "next/link";
import { Settings2 } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getMind, type MindEnabled } from "@/lib/mind-data";
import { MIND_TABS, type MindTab } from "@/lib/mind-tabs";

import { MindBoard } from "./_components/mind-board";

export const metadata = { title: "Mind" };

/**
 * Up to five practices for the inside of the day, each one switchable in
 * Settings. Meditation is a full-screen timer that grows a garden.
 *
 * Gratitude and du'a are a page a day, written with a template you choose.
 * Wishes are WOOPs (Oettingen): something you want, the best of having it,
 * the obstacle in you, and the if-then plan for it. Disputations are ABCDEs
 * (Seligman): a setback, the belief it set off, and the argument back. None
 * is tied to a task or a habit on purpose: this page is for what you're
 * grateful for, what you ask for, what you want and how you think.
 */
export default async function MindPage({ searchParams }: PageProps<"/mind">) {
  const user = await requireUser();
  // Next 16: searchParams is a Promise.
  const [params, view] = await Promise.all([searchParams, getMind(user)]);
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const tabs = MIND_TABS.filter((tab) => view.enabled[tab]);
  // A tab that's been switched off (or never existed) lands on the first one on.
  const tab: MindTab | undefined = tabs.find((value) => value === raw) ?? tabs[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">
          Mind <InfoTip term="mind" className="ml-1" />
        </h1>
        {tab && (
          <p className="text-muted-foreground mt-2 max-w-prose text-body">{intro(view.enabled)}</p>
        )}
      </header>

      {tab ? (
        <MindBoard initialTab={tab} view={view} />
      ) : (
        <div className="border-border mx-auto max-w-md rounded-2xl border border-dashed px-6 py-14 text-center">
          <p className="font-display text-2xl">Mind is switched off</p>
          <p className="text-muted-foreground mt-2 text-body">
            Gratitude, du&apos;a, meditation, wishes and disputations can each be turned on in Settings, in any mix.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/settings#mind">
              <Settings2 className="size-4" aria-hidden />
              Choose practices
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/** One or two lines built from what's switched on. */
function intro(enabled: MindEnabled): string {
  const daily = [
    enabled.gratitude && "what was good",
    enabled.dua && "what you're asking for",
  ].filter(Boolean);
  const sit = enabled.meditate ? "Time to sit and breathe, and a garden that grows with it." : "";
  const other = [
    enabled.wishes && "wishes you plan for",
    enabled.disputations && "the thoughts you argue back",
  ].filter(Boolean) as string[];

  const first = daily.length ? `A page a day for ${daily.join(" and ")}.` : "";
  const second = other.length
    ? `${other.join(", and ")}.`.replace(/^./, (c) => c.toUpperCase())
    : "";
  return [first, sit, second].filter(Boolean).join(" ");
}
