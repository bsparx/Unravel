import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * One number and what it means. Big numbers keep the font's own figures
 * (equal-width digits look loose at this size); the hero is the one figure
 * a view leads with, and there is only ever one.
 */
export function StatTile({
  label,
  value,
  tone,
  hero = false,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  /** Colour the figure when it is a direction, not just a size. */
  tone?: "good" | "bad";
  hero?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-border bg-card min-w-0 rounded-lg border p-4 md:p-5", className)}>
      <h2 className="text-muted-foreground text-label">{label}</h2>
      <p
        className={cn(
          "mt-1 truncate font-semibold tracking-tight",
          hero ? "text-[2.75rem] leading-[1.1] md:text-5xl" : "text-heading md:text-[1.75rem] md:leading-9",
          tone === "bad" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {children && <div className="text-muted-foreground mt-2 space-y-1 text-label">{children}</div>}
    </section>
  );
}

/**
 * Against an earlier stretch, in words, with an arrow: "Rs 5,000 more than
 * 1 – 19 Oct". Coloured by whether that direction is good (the money-in
 * blue, or the destructive red), never by colour alone: the arrow and the
 * words say it too.
 */
export function Delta({
  now,
  then,
  label,
  goodWhenUp,
}: {
  now: number;
  then: number;
  /** The earlier stretch: "1 – 19 Oct". */
  label: string;
  goodWhenUp: boolean;
}) {
  const diff = now - then;
  if (diff === 0) {
    return (
      <p className="flex items-center gap-1">
        <Minus className="size-3.5 shrink-0" aria-hidden />
        Same as {label}
      </p>
    );
  }
  const good = goodWhenUp ? diff > 0 : diff < 0;
  const Arrow = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex items-center gap-1">
      <Arrow className={cn("size-4 shrink-0", good ? "text-money-in" : "text-destructive")} aria-hidden />
      <span>
        <span className={cn("font-medium", good ? "text-money-in" : "text-destructive")}>
          {formatMoneyCompact(Math.abs(diff))} {diff > 0 ? "more" : "less"}
        </span>{" "}
        than {label}
      </span>
    </p>
  );
}
