import { NextResponse } from "next/server";

/**
 * The landing page's test-token request form.
 *
 * This used to write to the retired Encore backend, which owned a
 * `token_requests` table and a rate limiter. The gateway has no equivalent: it
 * has no endpoint for "someone asked for a trial key", and its users are
 * accounts with quota rather than a queue of queued requests.
 *
 * Rather than answer `ok` and silently drop the submission, this reports that
 * the form is not wired up. The component that posted here is not rendered
 * anywhere in the app, so no visitor reaches this today; wiring it to something
 * real is a decision about where leads should go, not a mechanical port.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "not_configured",
      message:
        "Trial requests are not being collected yet. Create an account to get a key.",
    },
    { status: 503 },
  );
}
