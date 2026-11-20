"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A calendar link that fetches the whole view the moment a pointer shows
 * intent.
 *
 * The calendar is a dynamic page, so a default link only prefetches its
 * skeleton and the click still waits on the server. Asking for the full route
 * on hover or focus buys the round trip a head start — usually enough that
 * the day is simply there when the click lands — without rendering forty-two
 * month cells' worth of days nobody asked for.
 */
export function IntentLink({
  onPointerEnter,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? true : false}
      onPointerEnter={(event) => {
        setIntent(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
    />
  );
}

const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

/**
 * Single-key shortcuts on `/calendar` should stay silent while typing,
 * while a modifier is held, or while a modal dialog owns focus.
 */
export function shouldIgnoreCalendarShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat) return true;
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  if (isTyping(event.target)) return true;
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  return false;
}

/**
 * Google Calendar's keys, for the same reason it has them: moving through
 * days is the thing you do most here, and it shouldn't need the mouse.
 *
 *   T today · J / N next · K / P previous · D day · W week
 *
 * Silent while typing and while a dialog is open, so a block's title can
 * still contain a "t".
 */
export function CalendarShortcuts({
  todayHref,
  prevHref,
  nextHref,
  dayHref,
  weekHref,
}: {
  todayHref: string;
  prevHref: string;
  nextHref: string;
  dayHref: string;
  weekHref: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const routes: Record<string, string> = {
      t: todayHref,
      j: nextHref,
      n: nextHref,
      k: prevHref,
      p: prevHref,
      d: dayHref,
      w: weekHref,
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreCalendarShortcut(event)) return;

      const href = routes[event.key.toLowerCase()];
      if (!href) return;
      event.preventDefault();
      router.push(href);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, todayHref, prevHref, nextHref, dayHref, weekHref]);

  return null;
}
