import { requireUser } from "@/lib/auth";

import { StatsDashboard } from "./_components/stats-dashboard";
import { getStatsOverview } from "./_lib/queries";

export const metadata = { title: "Statistics" };

export default async function StatsPage({
  searchParams,
}: PageProps<"/stats">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise. Defaults to the latest 2 weeks; older
  // 2-week windows are reached through the explicit "Previous 2 weeks" link.
  const params = await searchParams;
  const endParam = Array.isArray(params.end) ? params.end[0] : params.end;

  const overview = await getStatsOverview(user, endParam);

  return <StatsDashboard key={overview.endISO} data={overview} />;
}
