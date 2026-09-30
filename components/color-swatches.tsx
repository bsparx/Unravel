import {
  CALENDAR_COLOR_NAMES,
  CALENDAR_COLORS,
  type CalendarColor,
} from "@/lib/calendar-colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
        <Button
          key={option}
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          aria-label={`${option} colour`}
          title={option}
          className="size-11"
        >
          <span
            aria-hidden
            className={cn("size-6 rounded-full border border-black/10", value === option && "ring-accent-foreground ring-2 ring-offset-2 ring-offset-background")}
            style={{ backgroundColor: CALENDAR_COLORS[option] }}
          />
        </Button>
      ))}
    </div>
  );
}
