"use client";

import dynamic from "next/dynamic";

import { Frog } from "./frog";
import type { FrogMood } from "./frog-pond";

/**
 * The lazy half of the pond: the three.js chunk is fetched after first paint
 * so the home screen never waits on WebGL. ssr:false because there is nothing
 * to server-render — the effect draws everything client-side. The loading
 * frame shows the flat frog, so the spot is never empty.
 */
const Pond = dynamic(() => import("./frog-pond"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="relative mx-auto flex h-40 w-full max-w-md items-center justify-center sm:h-48"
    >
      <Frog className="h-14 w-auto" />
    </div>
  ),
});

export function FrogPondLazy({ mood }: { mood: FrogMood }) {
  return <Pond mood={mood} />;
}
