"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

/**
 * Delete a task or habit, behind one confirmation.
 *
 * Deleting takes its logged sessions with it, which is the one action in this
 * app that destroys data you can't reconstruct — and the button for it sits
 * either at the bottom of a form people scroll through or in a dense list row.
 * One dialog is the right amount of friction: enough that it can't happen by
 * accident, not so much that clearing out a task you no longer want becomes a
 * chore.
 *
 * `redirectTo` is optional because the two callers need opposite things. From
 * an edit page the deleted row's own route is gone, so it has to navigate. In
 * a list the user is already where they should end up, and pushing the route
 * they're on is a no-op that leaves the deleted row on screen — so the
 * in-place case refreshes instead, picking up the server component's
 * revalidated render.
 */
export function ConfirmDelete({
  action,
  taskId,
  label,
  title,
  description,
  redirectTo,
  size = "default",
}: {
  action: (formData: FormData) => Promise<void>;
  taskId: string;
  label: string;
  title: string;
  description: string;
  redirectTo?: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();

  return (
    <ConfirmDialog
      title={title}
      description={description}
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("taskId", taskId);
        await action(formData);
        toast.success("Deleted.");
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }}
      trigger={(open) => (
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={open}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
          {label}
        </Button>
      )}
    />
  );
}
