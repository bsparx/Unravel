"use client";

import { Grape, Monitor, Moon, Sun } from "lucide-react";

import { useMounted, useTheme } from "@/components/theme-provider";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  // No lucide eggplant; a grape reads purple. The theme is the violet night.
  { value: "eggplant", label: "Eggplant", icon: Grape },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // The server has no idea which theme is active, so the selected state can
  // only be shown once we're on the client — otherwise the markup would
  // hydrate with the wrong option highlighted.
  const hydrated = useMounted();

  return (
    <div className="space-y-2">
      <Label>Appearance</Label>
      <div className="flex gap-1.5">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = hydrated && theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
