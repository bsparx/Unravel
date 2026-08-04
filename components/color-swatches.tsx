import {
  CALENDAR_COLOR_NAMES,
  CALENDAR_COLORS,
  type CalendarColor,
} from "@/lib/calendar-colors";
import { cn } from "@/lib/utils";

/**
 * The twenty calendar hues as a swatch row — the same picker everywhere a
 * task's colour is chosen, so the choice always looks identical. Controlled:
 * the parent owns the value and the hidden form field.
 */
export function ColorSwatches({
  value,
  onChange,
}: {
  value: CalendarColor;
  onChange: (color: CalendarColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CALENDAR_COLOR_NAMES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          aria-label={`${option} colour`}
          title={option}
          className={cn(
            "focus-visible:ring-ring size-6 rounded-full border border-black/10 transition-transform focus-visible:ring-2 focus-visible:outline-none",
            value === option &&
              "ring-foreground/30 ring-offset-background scale-110 ring-2 ring-offset-2",
          )}
          style={{ backgroundColor: CALENDAR_COLORS[option] }}
        />
      ))}
    </div>
  );
}
