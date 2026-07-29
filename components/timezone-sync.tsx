"use client";

import { useEffect, useRef } from "react";

import { adoptBrowserTimezone } from "@/app/(app)/settings/actions";

/**
 * Every calendar day in this app is bucketed in `User.timezone`, and the server
 * has no way to know what that is. Rather than make the first thing a new user
 * sees be a timezone dropdown, adopt the browser's zone once while it's still
 * the default, and leave changing it to settings.
 */
export function TimezoneSync({ currentTimezone }: { currentTimezone: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || currentTimezone !== "UTC") return;

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserZone || browserZone === "UTC") return;

    sent.current = true;
    void adoptBrowserTimezone(browserZone);
  }, [currentTimezone]);

  return null;
}
