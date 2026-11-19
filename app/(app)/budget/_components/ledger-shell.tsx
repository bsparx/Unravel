"use client";

import { createContext, useCallback, useContext, useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type LedgerNav = {
  /** Swap the page's query for `href`'s, keeping the scroll where it is. */
  go: (href: string) => void;
  pending: boolean;
};

const LedgerNavContext = createContext<LedgerNav | null>(null);

/** The income and expense pages' navigator, or null anywhere else. */
export function useLedgerNav(): LedgerNav | null {
  return useContext(LedgerNavContext);
}

/**
 * Every control on a ledger page (the filters, a tap on a bar, the sort, show
 * more) changes the URL and nothing else; the server reads it and renders the
 * slice. The change runs as a transition, so the page holds its last render,
 * dimmed, until the new one lands: no skeleton, no jump.
 */
export function LedgerShell({ filters, children }: { filters: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (href: string) => startTransition(() => router.replace(href, { scroll: false })),
    [router],
  );
  const value = useMemo(() => ({ go, pending }), [go, pending]);

  return (
    <LedgerNavContext.Provider value={value}>
      {filters}
      <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "opacity-55")}>
        {children}
      </div>
    </LedgerNavContext.Provider>
  );
}
