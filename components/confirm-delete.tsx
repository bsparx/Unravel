"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

/**
 * Delete a task or habit, behind one confirmation.
 *
 * Deleting a task takes its logged sessions with it, which is the one action
 * in this app that destroys data you can't reconstruct — and the button for it
 * sits at the bottom of a form people scroll through. One dialog is the right
 * amount of friction: enough that it can't happen by accident, not so much
 * that clearing out a task you no longer want becomes a chore.
 */
export function ConfirmDelete({
  action,
  taskId,
  label,
  title,
  description,
  redirectTo,
}: {
  action: (formData: FormData) => Promise<void>;
  taskId: string;
  label: string;
  title: string;
  description: string;
  redirectTo: string;
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
        router.push(redirectTo);
      }}
      trigger={(open) => (
        <Button
          type="button"
          variant="ghost"
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
