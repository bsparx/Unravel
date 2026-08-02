"use client";

import { useEffect, useActionState, useState } from "react";
import { Archive, Plus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS } from "@/lib/money-palette";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { archiveCategory, createCategory } from "../../actions";
import type { BudgetCategory } from "../../_lib/queries";

/** The four colours a category may wear, in picker order. */
const COLORS = ["teal", "sage", "sand", "ink"] as const;

function AddCategoryForm({ kind }: { kind: "INCOME" | "EXPENSE" }) {
  const [state, formAction, pending] = useActionState(
    createCategory,
    idleState,
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<(typeof COLORS)[number]>("teal");

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      // One-shot form clear, not a derived value: clearing while pending
      // would lose the text when the action fails.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
      setColor("teal");
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  const error =
    state.status === "error" ? state.fieldErrors?.name : undefined;

  return (
    <form action={formAction} className="space-y-2 border-t px-4 py-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="color" value={color} />

      <div className="flex items-center gap-2">
        <Label htmlFor={`category-${kind}`} className="sr-only">
          Category name
        </Label>
        <Input
          id={`category-${kind}`}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="New category…"
          className="flex-1"
        />
        <div className="flex gap-1.5">
          {COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              aria-pressed={color === option}
              aria-label={`${option} colour`}
              className={cn(
                "focus-visible:ring-ring size-5 rounded-full transition-transform focus-visible:ring-2 focus-visible:outline-none",
                color === option && "scale-110",
              )}
              style={{
                backgroundColor: CATEGORY_COLORS[option],
              }}
            />
          ))}
        </div>
        <Button type="submit" size="sm" disabled={pending || name.trim() === ""}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-label">
          {error}
        </p>
      )}
    </form>
  );
}

function CategoryRow({ category }: { category: BudgetCategory }) {
  return (
    <li className="flex items-center gap-2.5 px-4 py-2.5">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor:
            CATEGORY_COLORS[category.color] ?? "var(--muted-foreground)",
        }}
        aria-hidden
      />
      <span className="text-title min-w-0 flex-1 truncate">{category.name}</span>
      {category.builtIn ? (
        <span className="text-muted-foreground text-micro rounded-full border px-2 py-0.5">
          Built-in
        </span>
      ) : (
        <ConfirmDialog
          title="Archive this category?"
          description="It leaves the picker — the entries already logged against it keep their category."
          confirmLabel="Archive it"
          onConfirm={async () => {
            const formData = new FormData();
            formData.set("id", category.id);
            await archiveCategory(formData);
            toast.success("Archived.");
          }}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              aria-label={`Archive ${category.name}`}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Archive className="size-4" aria-hidden />
            </button>
          )}
        />
      )}
    </li>
  );
}

function CategoryGroup({
  title,
  hint,
  kind,
  categories,
}: {
  title: string;
  hint: string;
  kind: "INCOME" | "EXPENSE";
  categories: BudgetCategory[];
}) {
  return (
    <section className="border-border bg-card rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-title">{title}</h2>
        <p className="text-muted-foreground text-micro">{hint}</p>
      </header>
      {categories.length > 0 && (
        <ul className="divide-y">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}
      <AddCategoryForm kind={kind} />
    </section>
  );
}

export function CategoryManager({
  income,
  expense,
}: {
  income: BudgetCategory[];
  expense: BudgetCategory[];
}) {
  return (
    <div className="space-y-6">
      <CategoryGroup
        title="Income categories"
        hint="Where money comes from."
        kind="INCOME"
        categories={income}
      />
      <CategoryGroup
        title="Expense categories"
        hint="Where money goes."
        kind="EXPENSE"
        categories={expense}
      />
    </div>
  );
}
