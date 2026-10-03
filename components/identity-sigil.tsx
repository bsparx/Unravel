import type { CSSProperties } from "react";
import {
  BookOpen,
  Compass,
  Feather,
  HeartHandshake,
  Lamp,
  Landmark,
  Laugh,
  Mountain,
  Palette,
  Search,
  Sprout,
  Swords,
  type LucideIcon,
} from "lucide-react";

import { hueVar, type Sigil } from "@/lib/identity-look";
import { cn } from "@/lib/utils";

const ICONS: Record<Sigil, LucideIcon> = {
  search: Search,
  palette: Palette,
  landmark: Landmark,
  swords: Swords,
  compass: Compass,
  feather: Feather,
  "heart-handshake": HeartHandshake,
  mountain: Mountain,
  lamp: Lamp,
  laugh: Laugh,
  "book-open": BookOpen,
  sprout: Sprout,
};

export const SIZES = {
  sm: "size-7 rounded-md [&_svg]:size-4",
  md: "size-10 rounded-xl [&_svg]:size-5",
  lg: "size-13 rounded-xl [&_svg]:size-6",
} as const;

/** The style that carries an identity's hue to everything inside it. */
export const hueStyle = (slot: number): CSSProperties =>
  ({ "--hue": hueVar(slot) }) as CSSProperties;

/**
 * An identity's face: its sigil on a wash of its hue. Decorative — the name
 * always sits beside it, so it is hidden from assistive tech.
 */
export function IdentitySigil({
  sigil,
  slot,
  size = "md",
  className,
}: {
  sigil: Sigil;
  slot: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = ICONS[sigil];
  return (
    <span
      aria-hidden
      style={hueStyle(slot)}
      className={cn(
        "inline-grid shrink-0 place-items-center text-[var(--hue)] [&_svg]:stroke-[1.8]",
        "bg-[color-mix(in_srgb,var(--hue)_14%,var(--input-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--hue)_30%,transparent)]",
        SIZES[size],
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/** A compact name tag: sigil-coloured icon, name in text colour. */
export function IdentityChip({
  name,
  sigil,
  slot,
  className,
}: {
  name: string;
  sigil: Sigil;
  slot: number;
  className?: string;
}) {
  const Icon = ICONS[sigil];
  return (
    <span
      style={hueStyle(slot)}
      className={cn(
        "text-foreground inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--hue)_12%,transparent)] py-0.5 pr-2 pl-1.5 text-micro font-semibold whitespace-nowrap",
        className,
      )}
    >
      <Icon className="size-3.5 stroke-2 text-[var(--hue)]" aria-hidden />
      {name}
    </span>
  );
}
