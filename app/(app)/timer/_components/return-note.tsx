"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * "When you come back, you're on ___".
 *
 * Asked during the break, while the answer is still in your head. By the time
 * the break ends it isn't: the expensive half of a switch is coming back, and
 * what makes it expensive is reconstructing where you were. A sentence written
 * sixty seconds earlier removes that entire reconstruction.
 *
 * Prefilled from the task's next step where there is one, so the common case
 * costs nothing at all. Blank is a fine answer and clears the note — a required
 * field here would be one more reason not to take the break.
 */
export function ReturnNote({
  value,
  placeholder,
  onCommit,
}: {
  value: string | null;
  /** The next step, or the task title — whatever the cue would default to. */
  placeholder: string | null;
  onCommit: (note: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");

  return (
    <label className="mt-6 block w-full max-w-sm text-center">
      <span className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
        When you come back
      </span>
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        // Committed on blur and on Enter rather than per keystroke: this writes
        // to the session row, and one round trip per letter would be absurd.
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder ?? "what you're in the middle of"}
        maxLength={140}
        className="mt-2 text-center"
      />
    </label>
  );
}
