import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 uses `proxy.ts` (the file named `middleware.ts` on Next 15).
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/keys(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|mjs|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
