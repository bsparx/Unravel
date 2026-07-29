/**
 * Shorthand parsing for a single line of text.
 *
 * This deliberately does NOT run at capture time — the dump box takes plain
 * text and asks nothing. It runs at *triage* time, when you're promoting an
 * inbox item to a task and are already in a deciding frame of mind, and in the
 * structured quick-add on the task pages.
 */

export type ParsedQuickAdd = {
  title: string;
  minutes: number | null;
  projectName: string | null;
  priority: "P1" | "P2" | "P3" | "P4";
};

const MAX_MINUTES = 480;

export function parseQuickAdd(raw: string): ParsedQuickAdd {
  let rest = raw;

  const minutesMatch = rest.match(/(?:^|\s)(\d{1,3})\s*(m|min|mins|minutes)\b/i);
  const hoursMatch = rest.match(/(?:^|\s)(\d{1,2})\s*(h|hr|hrs|hours)\b/i);

  let minutes: number | null = null;
  if (hoursMatch) {
    minutes = Number(hoursMatch[1]) * 60;
    rest = rest.replace(hoursMatch[0], " ");
  }
  if (minutesMatch) {
    minutes = (minutes ?? 0) + Number(minutesMatch[1]);
    rest = rest.replace(minutesMatch[0], " ");
  }

  const projectMatch = rest.match(/(?:^|\s)#([\w-]{1,40})/);
  const projectName = projectMatch ? projectMatch[1] : null;
  if (projectMatch) rest = rest.replace(projectMatch[0], " ");

  const priorityMatch = rest.match(/(?:^|\s)p([1-4])\b/i);
  const priority = priorityMatch
    ? (`P${priorityMatch[1]}` as ParsedQuickAdd["priority"])
    : ("P4" as const);
  if (priorityMatch) rest = rest.replace(priorityMatch[0], " ");

  return {
    title: rest.replace(/\s+/g, " ").trim(),
    minutes: minutes && minutes > 0 ? Math.min(minutes, MAX_MINUTES) : null,
    projectName,
    priority,
  };
}
