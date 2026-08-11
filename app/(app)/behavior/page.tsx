import { requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";

import { BehaviorList } from "./_components/behavior-list";

export const metadata = { title: "Behavior" };

export default async function BehaviorPage() {
  const user = await requireUser();
  const captures = await getRawCaptures(user);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">Behavior</h1>
        <p className="text-muted-foreground mt-1 text-label">
          When the urge hits — daydreaming, music, scrolling — press{" "}
          <kbd className="font-mono">c</kbd> and write what you felt and what
          triggered it. The patterns live here.
        </p>
      </header>

      <BehaviorList captures={captures} timezone={user.timezone} />
    </div>
  );
}
