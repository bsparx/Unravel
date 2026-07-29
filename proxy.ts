import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. The exported function must be
 * named `proxy` (or be the default export), and it always runs on the Node
 * runtime — the `edge` runtime is not supported here.
 *
 * Deliberately no `createRouteMatcher` / `auth.protect()` here: Clerk 7
 * deprecated that pattern because path matching can diverge from how Next
 * actually routes a request, leaving a protected resource reachable. Every
 * protected resource guards itself instead — `requireUser()` in
 * `app/(app)/layout.tsx` and in every Server Action, and `getUser()` in the
 * beacon route handler.
 */
export const proxy = clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static files, unless they carry a
    // query string.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes — Server Actions POST to the route they live
    // on, so skipping them here would leave the auth context unpopulated.
    "/(api|trpc)(.*)",
  ],
};
