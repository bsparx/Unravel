import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { AuthedProviders } from "@/app/_components/authed-providers";
import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { getWaterToday } from "@/lib/water-data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const water = await getWaterToday(user, todayLocal(user.timezone));

  // The sidebar provider writes `sidebar_state` ("true"/"false") on every
  // toggle; reading it here means a collapsed rail stays collapsed across
  // reloads, before any JS runs.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AuthedProviders user={user} water={water}>
      <AppShell defaultOpen={sidebarOpen}>{children}</AppShell>
    </AuthedProviders>
  );
}
