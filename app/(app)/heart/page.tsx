import Link from "next/link";
import { Settings2 } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getHeart } from "@/lib/heart-data";
import { enabledHeartTabs, type HeartEnabled, type HeartTab } from "@/lib/heart-tabs";

import { HeartBoard } from "./_components/heart-board";

export const metadata = { title: "Heart" };

/**
 * Three daily practices for the heart, each switchable in Settings.
 * Gratitude and du'a are a page a day, written with a template you choose;
 * they moved here from /mind with every page, template and scene intact.
 * Daily recitation is a set you build of Quran and remembrance, said in a
 * full-screen reader with a counter, and kept by an oasis.
 */
export default async function HeartPage({ searchParams }: PageProps<"/heart">) {
  const user = await requireUser();
  // Next 16: searchParams is a Promise.
  const [params, view] = await Promise.all([searchParams, getHeart(user)]);
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const tabs = enabledHeartTabs(view.enabled);
  // A tab that's switched off (or never existed) lands on the first one on.
  const tab: HeartTab | undefined = tabs.find((value) => value === raw) ?? tabs[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">
          Heart <InfoTip term="heart" className="ml-1" />
        </h1>
        {tab && <p className="text-muted-foreground mt-2 max-w-prose text-body">{intro(view.enabled)}</p>}
      </header>

      {tab ? (
        <HeartBoard initialTab={tab} view={view} />
      ) : (
        <div className="border-border mx-auto max-w-md rounded-2xl border border-dashed px-6 py-14 text-center">
          <p className="font-display text-2xl">Heart is switched off</p>
          <p className="text-muted-foreground mt-2 text-body">
            Gratitude, du&apos;a and daily recitation can each be turned on in Settings, in any mix.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/settings#heart">
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
function intro(enabled: HeartEnabled): string {
  const pages = [enabled.gratitude && "what was good", enabled.dua && "what you're asking for"].filter(Boolean);
  return [
    pages.length ? `A page a day for ${pages.join(" and ")}.` : "",
    enabled.recitation
      ? "A daily set of Quran, remembrance and Prophetic du'as, said with a counter, that grows an oasis."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
