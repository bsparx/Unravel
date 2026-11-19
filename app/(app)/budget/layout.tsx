import { BudgetNav } from "./_components/budget-nav";

/**
 * One frame for every budget section: the same width, and the section row on
 * top, which stays while the page below it loads. The deep bottom keeps the
 * last row clear of the floating capture button.
 */
export default function BudgetLayout({ children }: LayoutProps<"/budget">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-8 pb-28 md:px-8 md:pt-10">
      <BudgetNav />
      {children}
    </div>
  );
}
