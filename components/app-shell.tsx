"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  Brain,
  CalendarClock,
  CalendarDays,
  Drama,
  HeartPulse,
  Inbox,
  ListChecks,
  ListTodo,
  MessagesSquare,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Repeat,
  Settings,
  Sun,
  Timer,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The desktop rail's primary group, in the order the day runs. Five is the
 * ceiling for the mobile bar; the desktop rail has room, so Body lives
 * here and Statistics moves to the rail's second group.
 */
const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/day", label: "Day", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/mind", label: "Mind", icon: Brain },
  { href: "/body", label: "Body", icon: HeartPulse },
] as const;

/**
 * The mobile bottom bar: four surfaces you touch on an ordinary day, then
 * "More", which opens a sheet holding every other page. Four plus More keeps
 * each target wide enough to hit with a thumb on a 320px screen.
 */
const MOBILE_NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/day", label: "Day", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/mind", label: "Mind", icon: Brain },
] as const;

/** There's room on the desktop rail, and losing these from it would be a loss. */
const RAIL_EXTRA = [
  { href: "/behavior", label: "Behavior", icon: Inbox },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/identities", label: "Identities", icon: Drama },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/review", label: "Weekly review", icon: MessagesSquare },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/subscriptions", label: "Subscriptions", icon: CalendarClock },
  { href: "/close", label: "Close the day", icon: Moon },
] as const;

const SETTINGS = { href: "/settings", label: "Settings", icon: Settings } as const;

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> };

/**
 * Everything the bottom bar doesn't show, derived from the desktop lists so a
 * page added to the rail can't be forgotten on phones.
 */
const MOBILE_MORE: readonly NavItem[] = [...NAV, ...RAIL_EXTRA, SETTINGS].filter(
  ({ href }) => !MOBILE_NAV.some((item) => item.href === href),
);

/**
 * The shell. The shadcn sidebar owns the desktop rail: fixed, collapsible to
 * an icon rail (Ctrl/Cmd+B, or the toggle at the top of the menu), with the
 * choice persisted in a cookie by the provider. Below `md` it never renders —
 * phones keep the bottom bar, which is the designed mobile nav.
 */
export function AppShell({
  children,
  banner,
  defaultOpen = true,
  mindEnabled = true,
  bodyEnabled = true,
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
  /** With every Mind practice switched off, the page leaves the rail. */
  mindEnabled?: boolean;
  /** Likewise Body, with both exercises and fasting off. */
  bodyEnabled?: boolean;
  /** Read from the sidebar_state cookie so the choice survives reloads. */
  defaultOpen?: boolean;
}) {
  const pathname = usePathname();
  // `"/"` works here without a special case: the equality catches it, and
  // `startsWith("//")` is never true. Don't "fix" this into `startsWith(href)`
  // — that would light up Today on every single route.
  // Mind and Body leave the nav when every one of their practices is off.
  const shown = ({ href }: { href: string }) =>
    (mindEnabled || href !== "/mind") && (bodyEnabled || href !== "/body");
  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/day" && pathname === "/days");

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip="Unravel"
              >
                <Link href="/">
                  {/* The mark survives the collapse — the wordmark hides, the
                      loop doesn't. */}
                  <BrandMark className="text-accent-foreground size-6 shrink-0" />
                  <span className="font-display text-title tracking-tight">
                    Unravel
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <CollapseToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
        {NAV.filter(shown).map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(href)}
                    tooltip={label}
                  >
                    <Link
                      href={href}
                      aria-current={isActive(href) ? "page" : undefined}
                    >
                      <Icon aria-hidden />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator className="mx-3" />

          <SidebarGroup>
            <SidebarMenu>
              {RAIL_EXTRA.filter(shown).map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(href)}
                    tooltip={label}
                  >
                    <Link
                      href={href}
                      aria-current={isActive(href) ? "page" : undefined}
                    >
                      <Icon aria-hidden />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive("/settings")}
                tooltip="Settings"
              >
                <Link
                  href="/settings"
                  aria-current={isActive("/settings") ? "page" : undefined}
                >
                  <Settings aria-hidden />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <div className="px-2 py-1.5">
                <UserButton />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {banner}
        <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </SidebarInset>

      {/* Mobile bar */}
      <nav
        aria-label="Main"
        className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_NAV.filter(shown).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              MOBILE_TAB,
              isActive(href) ? "bg-accent/40 text-accent-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
        <MobileMore items={MOBILE_MORE.filter(shown)} isActive={isActive} />
      </nav>
    </SidebarProvider>
  );
}

const MOBILE_TAB =
  "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none";

/**
 * The bar's last tab: a bottom sheet with every page the bar can't fit, plus
 * Settings and the account menu, which otherwise live only in the desktop
 * rail's footer. The tab lights up when you're on one of those pages, so the
 * bar always shows where you are.
 */
function MobileMore({
  items,
  isActive,
}: {
  items: readonly NavItem[];
  isActive: (href: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const here = items.some(({ href }) => isActive(href));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          MOBILE_TAB,
          here || open ? "bg-accent/40 text-accent-foreground" : "text-muted-foreground",
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
        More
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-title tracking-tight">More</SheetTitle>
          <SheetDescription className="sr-only">Every other page in Unravel.</SheetDescription>
        </SheetHeader>
        <nav aria-label="More pages" className="grid grid-cols-3 gap-2 px-4">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border px-1 py-3 text-center text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isActive(href)
                  ? "border-accent bg-accent/40 text-accent-foreground"
                  : "border-border text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-center gap-3 border-t px-4 py-3">
          <UserButton />
          <span className="text-muted-foreground text-sm">Account</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The collapse control, at the top of the menu so every page can reach it. */
function CollapseToggle() {
  const { state, toggleSidebar } = useSidebar();
  const expanded = state === "expanded";

  return (
    <SidebarMenuButton
      onClick={toggleSidebar}
      tooltip={expanded ? "Collapse sidebar" : "Expand sidebar"}
      aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
    >
      {expanded ? <PanelLeftClose aria-hidden /> : <PanelLeft aria-hidden />}
      <span className="text-muted-foreground">
        {expanded ? "Collapse" : "Expand"}
      </span>
    </SidebarMenuButton>
  );
}
