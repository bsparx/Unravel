import { InfoTip } from "@/components/info-tip";
import { requireUser } from "@/lib/auth";
import { getMind } from "@/lib/mind-data";

import { MindBoard, type MindTab } from "./_components/mind-board";

export const metadata = { title: "Mind" };

/**
 * Two practices for the inside of the day.
 *
 * Wishes are WOOPs (Oettingen): something you want, the best of having it,
 * the obstacle in you, and the if-then plan for it. Disputations are ABCDEs
 * (Seligman): a setback, the belief it set off, and the argument back.
 * Neither is tied to a task or a habit on purpose: this page is for what
 * you want and how you think, not for what's on today's list.
 */
export default async function MindPage({ searchParams }: PageProps<"/mind">) {
  const user = await requireUser();
  // Next 16: searchParams is a Promise.
  const [params, mind] = await Promise.all([searchParams, getMind(user)]);
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: MindTab = raw === "disputations" ? "disputations" : "wishes";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">
          Mind <InfoTip term="mind" className="ml-1" />
        </h1>
        <p className="text-muted-foreground mt-2 max-w-prose text-body">
          Wishes you plan for, and the thoughts you argue back.
        </p>
      </header>

      <MindBoard initialTab={tab} {...mind} />
    </div>
  );
}
