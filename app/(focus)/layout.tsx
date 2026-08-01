import { AuthedProviders } from "@/app/_components/authed-providers";
import { ensureUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { getWaterToday } from "@/lib/water-data";

/**
 * No rail, no bottom bar, no banner. The absence is the feature — this is the
 * layout for the two screens where a list of six links would be the problem.
 *
 * `ensureUser()` and not `requireUser()`, deliberately: `/` lives in this group
 * and has to render the landing page for a signed-out visitor, so this layout
 * must be reachable without a session. Routes in here that *do* need one guard
 * themselves — `/close` calls `requireUser()` and redirects. A layout that
 * redirected would make the landing unreachable.
 */
export default async function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUser();

  if (!user) return <>{children}</>;

  const water = await getWaterToday(user, todayLocal(user.timezone));

  return (
    <AuthedProviders user={user} water={water}>
      {children}
    </AuthedProviders>
  );
}
