import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { cuid } from "@/lib/validation";
import { getBook } from "@/lib/reading-data";

import { BookNotebook } from "./_components/book-notebook";

// One read per request, shared by the title and the page.
const loadBook = cache(async (id: string) => {
  const user = await requireUser();
  if (!cuid.safeParse(id).success) return { user, view: null };
  return { user, view: await getBook(user, id) };
});

export async function generateMetadata({ params }: PageProps<"/mind/books/[id]">) {
  const { id } = await params;
  const { view } = await loadBook(id);
  return { title: view ? view.book.title : "Reading" };
}

/**
 * One book's notebook: the cover, how far you are, what you've written in
 * your own words, and every reading's note in page order. Its own page
 * rather than a dialog, because notes grow long and are worth linking to.
 */
export default async function BookPage({ params }: PageProps<"/mind/books/[id]">) {
  const { id } = await params;
  const { user, view } = await loadBook(id);
  if (!user.mindReadingEnabled) redirect("/mind");
  if (!view) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <BookNotebook view={view} />
    </div>
  );
}
