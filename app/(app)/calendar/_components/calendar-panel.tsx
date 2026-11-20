"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PanelRight, PanelRightClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  CALENDAR_PANEL_ID,
  formatCalendarPanelCookie,
} from "../_lib/panel-cookie";
import { shouldIgnoreCalendarShortcut } from "./calendar-nav";

type CalendarPanelContextValue = {
  open: boolean;
  toggle: () => void;
};

const CalendarPanelContext = createContext<CalendarPanelContextValue | null>(
  null,
);

function useCalendarPanel(): CalendarPanelContextValue {
  const ctx = useContext(CalendarPanelContext);
  if (!ctx) {
    throw new Error(
      "useCalendarPanel must be used within CalendarPanelProvider.",
    );
  }
  return ctx;
}

/**
 * Owns open/collapsed state for the right-hand planning panel (mini-calendar
 * and "Not on the day yet"), persisted in a cookie so SSR renders the saved
 * layout without a flash.
 */
export function CalendarPanelProvider({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      document.cookie = formatCalendarPanelCookie(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreCalendarShortcut(event)) return;
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo(() => ({ open, toggle }), [open, toggle]);

  return (
    <CalendarPanelContext.Provider value={value}>
      {children}
    </CalendarPanelContext.Provider>
  );
}

/**
 * Header toolbar button that toggles the right-hand mini-calendar and
 * unscheduled list. Mirrors the left rail's PanelLeft/PanelLeftClose pattern.
 */
export function CalendarPanelToggle({
  unscheduledCount,
}: {
  unscheduledCount: number;
}) {
  const { open, toggle } = useCalendarPanel();

  return (
    <Button
      type="button"
      variant={open ? "secondary" : "outline"}
      size="sm"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={CALENDAR_PANEL_ID}
      aria-keyshortcuts="s"
      title={open ? "Hide side panel (S)" : "Show side panel (S)"}
      className="min-h-11 rounded-[10px] px-3"
    >
      {open ? (
        <PanelRightClose className="size-4" aria-hidden />
      ) : (
        <PanelRight className="size-4" aria-hidden />
      )}
      <span>Panel</span>
      {!open && unscheduledCount > 0 && (
        <>
          <span className="sr-only">
            {" "}
            ({unscheduledCount} not on the day yet)
          </span>
          <span
            aria-hidden
            className="bg-secondary text-secondary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-micro font-medium tabular-nums"
          >
            {unscheduledCount}
          </span>
        </>
      )}
    </Button>
  );
}

/**
 * Responsive split between the calendar grid (`main`) and the collapsible
 * right-hand panel (`panel`). Keeping `main` unconditionally in slot 0 ensures
 * toggling the panel never remounts the grid or resets its scroll position.
 */
export function CalendarSplitLayout({
  main,
  panel,
}: {
  main: ReactNode;
  panel: ReactNode;
}) {
  const { open } = useCalendarPanel();

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        open && "lg:grid-cols-[minmax(0,1fr)_18rem]",
      )}
    >
      {main}
      {open && (
        <aside id={CALENDAR_PANEL_ID} className="space-y-6">
          {panel}
        </aside>
      )}
    </div>
  );
}
