import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { ensureGlobalCategories } from "@/lib/budget";

import { CategoryManager } from "./_components/category-manager";
import { getBudgetCategories } from "../_lib/queries";

export const metadata = { title: "Budget categories" };

export default async function BudgetCategoriesPage() {
  const user = await requireUser();
  await ensureGlobalCategories();
  const categories = await getBudgetCategories(user);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/budget"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-6 inline-flex items-center gap-1.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Budget
      </Link>
      <h1 className="text-heading mb-1">Categories</h1>
      <p className="text-muted-foreground mb-8 text-label">
        Every entry lands in one. The built-ins are always there; the rest are
        yours.
      </p>

      <CategoryManager income={categories.income} expense={categories.expense} />
    </div>
  );
}
