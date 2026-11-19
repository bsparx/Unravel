"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/budget", label: "Overview" },
  { href: "/budget/expenses", label: "Expenses" },
  { href: "/budget/income", label: "Income" },
  { href: "/budget/debts", label: "IOUs" },
  { href: "/budget/accounts", label: "Accounts" },
  { href: "/budget/categories", label: "Categories" },
] as const;

/**
 * The budget's sections, one row of pills. It lives in the budget layout, so
 * it stays put while a section loads beneath it. On a phone the row scrolls
 * sideways rather than wrapping into a second line. Inline containment keeps
 * the row's full width from counting as the page's minimum: without it, the
 * main column beside the sidebar was pushed past the window on tablets.
 */
export function BudgetNav() {
  const pathname = usePathname();
  const scroller = useRef<HTMLElement>(null);

  // On a phone the current section can sit past the edge: bring it in, by
  // scrolling the row sideways only, never the page.
  useEffect(() => {
    const row = scroller.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !current) return;
    const left = current.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + current.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = left - 20;
    }
  }, [pathname]);

  return (
    <nav ref={scroller} aria-label="Budget" className="-mx-5 mb-6 overflow-x-auto px-5 [contain:inline-size] [scrollbar-width:none] md:mx-0 md:px-0">
      <ul className="flex w-max gap-1">
        {SECTIONS.map((section) => {
          const active =
            section.href === "/budget" ? pathname === "/budget" : pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring inline-flex min-h-9 items-center rounded-full px-3.5 text-label whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-secondary text-secondary-foreground font-medium shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
