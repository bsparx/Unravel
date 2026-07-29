import { AuthedProviders } from "@/app/_components/authed-providers";
import { ensureUser } from "@/lib/auth";

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

  return <AuthedProviders user={user}>{children}</AuthedProviders>;
}
