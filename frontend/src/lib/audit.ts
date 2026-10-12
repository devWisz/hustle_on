/**
 * Shared audit vocabulary.
 *
 * This lives in a plain module rather than beside the components that use it for
 * a specific and easily-missed reason: `DECISION_ACTIONS` was exported from
 * `components/admin/audit-log.tsx`, which is a `"use client"` module, and imported
 * into the admin overview, which is a server component. Across that boundary Next
 * replaces every non-component export with a client *reference*, so the array
 * arrived as a proxy object and `DECISION_ACTIONS.includes(...)` threw
 * "includes is not a function" — a 500 on the console's front page.
 *
 * Components may cross that boundary. Plain values may not. Anything both sides
 * need belongs here.
 */

/** The audit actions that represent a review decision on a submission. */
export const DECISION_ACTIONS: readonly string[] = ["timelapse.approve", "timelapse.reject"];
