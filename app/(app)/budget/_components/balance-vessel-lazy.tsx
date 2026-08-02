"use client";

import dynamic from "next/dynamic";

/**
 * The lazy half of the jar: the three.js chunk is fetched after first paint
 * so the ledger never waits on WebGL. `ssr: false` because there is nothing
 * to server-render — the effect draws everything client-side.
 */
const Vessel = dynamic(() => import("./balance-vessel"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-64 w-44 md:h-72 md:w-52" />,
});

export function BalanceVesselLazy({
  balanceCents,
  incomeCents,
}: {
  balanceCents: number;
  incomeCents: number;
}) {
  return <Vessel balanceCents={balanceCents} incomeCents={incomeCents} />;
}
