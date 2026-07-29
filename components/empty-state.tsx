import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="text-muted-foreground/60 size-6" aria-hidden />
      <div className="space-y-1">
        <p className="font-display text-title">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-label">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
