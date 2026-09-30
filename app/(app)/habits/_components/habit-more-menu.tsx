"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Archive, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { archiveHabit } from "../actions";

/** Infrequent actions stay visible without competing with today's check-in. */
export function HabitMoreMenu({ taskId, name }: { taskId: string; name: string; }) {
  const [pending, startTransition] = useTransition();

  const archive = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("taskId", taskId);
      try {
        await archiveHabit(formData);
        toast.success("Habit archived. You can restore it below.");
      } catch {
        toast.error("The habit could not be archived. Try again.");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={`More actions for ${name}`}
          className="min-h-11 gap-1.5 text-muted-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
          {pending ? "Saving..." : "More"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild className="min-h-11 gap-2">
          <Link href={`/habits/${taskId}`}>
            <Pencil className="size-4" aria-hidden />
            Edit habit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={archive} className="min-h-11 gap-2">
          <Archive className="size-4" aria-hidden />
          Archive habit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
