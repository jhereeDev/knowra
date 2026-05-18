import { clerkMiddleware } from '@clerk/nextjs/server';

// We don't *protect* any routes at the middleware level — anonymous
// access is the default for cards/search/events. The middleware exists
// so that `auth()` works inside the /api/sync/* handlers (and any
// future authenticated routes) without each route having to wire up
// Clerk itself.
//
// If Clerk env vars are absent (dev without keys), clerkMiddleware is
// a no-op pass-through.
export default clerkMiddleware();

export const config = {
  // Run on everything except static assets, Next internals, and image
  // optimization. Same matcher Clerk's docs recommend.
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
