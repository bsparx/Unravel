import { requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";

import { InboxList } from "./_components/inbox-list";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await requireUser();
  const captures = await getRawCaptures(user);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">Inbox</h1>
        <p className="text-muted-foreground mt-1 text-label">
          {captures.length > 0
            ? "Everything you've written down. Turn it into a task or let it go — both count as dealing with it."
            : "Everything you write down lands here."}
        </p>
      </header>

      <InboxList captures={captures} timezone={user.timezone} />
    </div>
  );
}
