"use client";

import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "unravel-stats-excluded";
const EMPTY_EXCLUDED: readonly string[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedParsed: readonly string[] = EMPTY_EXCLUDED;

function readExcluded(): readonly string[] {
  if (typeof window === "undefined") return EMPTY_EXCLUDED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_EXCLUDED;
      return cachedParsed;
    }
    const parsed: unknown = JSON.parse(raw);
    cachedParsed = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : EMPTY_EXCLUDED;
    return cachedParsed;
  } catch {
    return EMPTY_EXCLUDED;
  }
}

function writeExcluded(ids: readonly string[]) {
  const unique = [...new Set(ids)];
  const raw = JSON.stringify(unique);
  cachedRaw = raw;
  cachedParsed = unique;
  try {
    if (unique.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage unavailable — selection still updates in memory for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribeExcluded(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Shared client store for the user's excluded Statistics items. Used by both
 * /stats and /close so Ending Summary always reflects the exact same selection.
 */
export function useExcludedItems() {
  const excludedList = useSyncExternalStore(
    subscribeExcluded,
    readExcluded,
    () => EMPTY_EXCLUDED,
  );
  const excludedSet = useMemo(() => new Set(excludedList), [excludedList]);

  const toggleItem = (id: string) => {
    const next = new Set(excludedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeExcluded([...next]);
  };

  const setGroupIncluded = (ids: string[], include: boolean) => {
    const next = new Set(excludedSet);
    for (const id of ids) {
      if (include) next.delete(id);
      else next.add(id);
    }
    writeExcluded([...next]);
  };

  const resetAll = () => writeExcluded([]);

  return { excludedSet, toggleItem, setGroupIncluded, resetAll };
}
