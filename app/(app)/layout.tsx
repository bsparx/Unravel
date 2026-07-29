import { AppShell } from "@/components/app-shell";
import { AuthedProviders } from "@/app/_components/authed-providers";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AuthedProviders user={user}>
      <AppShell>{children}</AppShell>
    </AuthedProviders>
  );
}
