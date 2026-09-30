"use client";

import type { ReactNode } from "react";
import { useLinkStatus } from "next/link";

import { Spinner } from "@/components/ui/spinner";

/**
 * Put this inside a `<Link>` around its icon: the icon becomes a spinner while
 * the navigation is pending, and comes back if it's cancelled.
 *
 * `useLinkStatus` only works in a descendant of the link, which is why this is
 * its own component rather than a hook on the page. Same size in, same size
 * out — the link must not shift under a finger that just tapped it. If the
 * route was already prefetched the pending phase is skipped, and so is this.
 */
export function LinkStatusSwap({
  children,
  spinnerClassName,
}: {
  children: ReactNode;
  /** Match the icon it replaces, e.g. `size-3.5`. */
  spinnerClassName?: string;
}) {
  const { pending } = useLinkStatus();

  return pending ? <Spinner className={spinnerClassName} /> : children;
}
