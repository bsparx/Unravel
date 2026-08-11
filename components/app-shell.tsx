"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  CalendarDays,
  Droplets,
  Dumbbell,
  Inbox,
  ListChecks,
  ListTodo,
  Moon,
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
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The desktop rail's primary group, in the order the day runs. Five is the
 * ceiling for the mobile bar; the desktop rail has room, so Exercises lives
 * here and Statistics moves to the rail's second group.
 */
const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/day", label: "Day", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
] as const;

/**
 * The mobile bottom bar: the surfaces you touch on an ordinary day, in the
 * order the day runs. The desktop rail can hold both Exercises and Statistics;
 * the bar can't, and training is the daily act.
 */
const MOBILE_NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/day", label: "Day", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
] as const;

/** There's room on the desktop rail, and losing these from it would be a loss. */
const RAIL_EXTRA = [
  { href: "/behavior", label: "Behavior", icon: Inbox },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/water", label: "Water", icon: Droplets },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/close", label: "Close the day", icon: Moon },
] as const;

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
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
  /** Read from the sidebar_state cookie so the choice survives reloads. */
  defaultOpen?: boolean;
}) {
  const pathname = usePathname();
  // `"/"` works here without a special case: the equality catches it, and
  // `startsWith("//")` is never true. Don't "fix" this into `startsWith(href)`
  // — that would light up Today on every single route.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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
                className="group-data-[collapsible=icon]:justify-center"
              >
                <Link href="/">
                  {/* The mark survives the collapse — the wordmark hides, the
                      loop doesn't. */}
                  <BrandMark className="text-primary size-6 shrink-0" />
                  <span className="font-display text-title tracking-tight group-data-[collapsible=icon]:hidden">
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
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
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
              {RAIL_EXTRA.map(({ href, label, icon: Icon }) => (
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
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </SidebarInset>

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
    </SidebarProvider>
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
