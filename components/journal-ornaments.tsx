import { cn } from "@/lib/utils";

/**
 * Journal ornaments — original line-art, drawn here so the spread has its
 * own hand. A washi strip and one butterfly shape, used sparingly: the
 * spread is remembered for its pages, not its stickers.
 */

export function WashiTape({
  className,
  rotate = "-2deg",
}: {
  className?: string;
  rotate?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ transform: `rotate(${rotate})` }}
      className={cn(
        "bg-washi pointer-events-none block h-5 w-24 rounded-[2px] opacity-90 shadow-sm",
        "bg-[repeating-linear-gradient(90deg,transparent_0,transparent_5px,rgba(255,255,255,0.28)_5px,rgba(255,255,255,0.28)_7px)]",
        className,
      )}
    />
  );
}

export function Butterfly({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      aria-hidden
    >
      <path
        d="M12 11.2C10.2 7.6 7.4 4.6 4.9 4.9 2.6 5.2 2.2 8 4 9.9c1.5 1.6 4.1 2 8 1.3Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : undefined}
      />
      <path
        d="M12 11.2c1.8-3.6 4.6-6.6 7.1-6.3 2.3.3 2.7 3.1.9 5-1.5 1.6-4.1 2-8 1.3Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : undefined}
      />
      <path
        d="M12 12c-1.6 1.1-3.4 2.6-4.3 4.9-.8 2.1 1 3.7 3 2.8 1.6-.7 2.2-4 2.3-7.7Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.12 : undefined}
      />
      <path
        d="M12 12c1.6 1.1 3.4 2.6 4.3 4.9.8 2.1-1 3.7-3 2.8-1.6-.7-2.2-4-2.3-7.7Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.12 : undefined}
      />
      <path d="M12 7.6c.5 1.6.5 7.2 0 9.2" />
      <path d="M11.4 6.6C11 5.1 9.6 3.9 8.4 3.5" />
      <path d="M12.6 6.6c.4-1.5 1.8-2.7 3-3.1" />
    </svg>
  );
}
