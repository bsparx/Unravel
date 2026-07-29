import { dayOfWeek, formatDate, formatDuration, WEEKDAYS } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Day = { date: Date; iso: string; seconds: number };

/**
 * Focus time per day. Teal ramp, never amber — amber means "running right now",
 * and a chart of the past is never running.
 */
export function FocusHeatmap({ daily }: { daily: Day[] }) {
  const max = Math.max(...daily.map((day) => day.seconds), 1);

  // Pad so the first column starts on a Sunday.
  const leading = dayOfWeek(daily[0]?.date ?? new Date());
  const cells: (Day | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...daily,
  ];

  const columns: (Day | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    columns.push(cells.slice(index, index + 7));
  }

  return (
    <div className="flex gap-2">
      <div className="text-muted-foreground flex flex-col gap-[3px] pt-[1px] text-micro">
        {WEEKDAYS.map((day, index) => (
          <span
            key={day.value}
            className="flex h-[13px] items-center leading-none"
          >
            {index % 2 === 1 ? day.short : ""}
          </span>
        ))}
      </div>

      <div className="flex gap-[3px] overflow-x-auto">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, rowIndex) => {
              const day = column[rowIndex];
              if (!day) {
                return <span key={rowIndex} className="size-[13px]" />;
              }

              const intensity = day.seconds / max;
              return (
                <span
                  key={day.iso}
                  title={`${formatDate(day.date)} — ${
                    day.seconds > 0 ? formatDuration(day.seconds) : "nothing logged"
                  }`}
                  className={cn(
                    "size-[13px] rounded-[3px]",
                    day.seconds === 0 && "bg-muted",
                    intensity > 0 && intensity <= 0.25 && "bg-primary/25",
                    intensity > 0.25 && intensity <= 0.5 && "bg-primary/45",
                    intensity > 0.5 && intensity <= 0.75 && "bg-primary/70",
                    intensity > 0.75 && "bg-primary",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
