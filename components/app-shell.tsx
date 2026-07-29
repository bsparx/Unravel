"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  CalendarDays,
  Inbox,
  ListChecks,
  ListTodo,
  Moon,
  Repeat,
  Settings,
  Sun,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Five is the ceiling for the mobile bar, so this is the shortlist: the
 * surfaces you touch on an ordinary day, in the order the day runs.
 *
 * Calendar displaced Inbox here rather than Stats, because planning is a daily
 * act and triage is a weekly one — and the inbox is still one tap from `/`,
 * where you already are every morning.
 */
const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/day", label: "Day", icon: ListChecks },
  { href: "/calendar", label: "Plan", icon: CalendarDays },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/stats", label: "Time", icon: BarChart3 },
] as const;

/** There's room on the desktop rail, and losing these from it would be a loss. */
const RAIL_EXTRA = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/close", label: "Close the day", icon: Moon },
] as const;

export function AppShell({
  children,
  banner,
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const pathname = usePathname();
  // `"/"` works here without a special case: the equality catches it, and
  // `startsWith("//")` is never true. Don't "fix" this into `startsWith(href)`
  // — that would light up Today on every single route.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Desktop rail */}
      <nav
        aria-label="Main"
        className="bg-sidebar border-border hidden w-56 shrink-0 flex-col border-r px-3 py-6 md:flex"
      >
        <Link
          href="/"
          className="focus-visible:ring-ring mb-8 flex items-center gap-2 rounded-md px-3 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary size-2.5 rounded-full" />
          <span className="font-display text-title tracking-tight">
            Toasty Clock
          </span>
        </Link>

        <ul className="flex flex-1 flex-col gap-0.5">
          {[...NAV, ...RAIL_EXTRA].map(({ href, label, icon: Icon }, index) => (
            <li key={href} className={index === NAV.length ? "mt-4" : undefined}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-2 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  isActive(href)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-border mt-4 flex items-center justify-between gap-2 border-t px-3 pt-4">
          <UserButton />
          <Link
            href="/settings"
            aria-label="Settings"
            className={cn(
              "focus-visible:ring-ring rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
              isActive("/settings")
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings className="size-4" aria-hidden />
          </Link>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bar */}
      <nav
        aria-label="Main"
        className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-40 flex border-t backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-micro tracking-wide uppercase transition-colors",
              isActive(href) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
