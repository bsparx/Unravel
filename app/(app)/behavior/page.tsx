import { requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";

import { BehaviorList } from "./_components/behavior-list";
import { BehaviorPageHeader } from "./_components/behavior-page-header";

export const metadata = { title: "Behavior" };

export default async function BehaviorPage() {
  const user = await requireUser();
  const captures = await getRawCaptures(user);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <BehaviorPageHeader />
      <BehaviorList captures={captures} timezone={user.timezone} />
    </div>
  );
}
