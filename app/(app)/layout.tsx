import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { AuthedProviders } from "@/app/_components/authed-providers";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The sidebar provider writes `sidebar_state` ("true"/"false") on every
  // toggle; reading it here means a collapsed rail stays collapsed across
  // reloads, before any JS runs.
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AuthedProviders user={user}>
      <AppShell defaultOpen={sidebarOpen}>{children}</AppShell>
    </AuthedProviders>
  );
}
