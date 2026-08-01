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

  return (
    <AuthedProviders user={user} water={water}>
      <AppShell>{children}</AppShell>
    </AuthedProviders>
  );
}
