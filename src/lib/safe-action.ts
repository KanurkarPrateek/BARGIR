import type { Failed } from "./action-result";

// An error whose message is written for the person using the app
// ("Phone number already has a login"), as opposed to an internal failure.
export class UserError extends Error {}

// Wraps the body of a server action. A UserError comes back as a value the
// screen can show; anything else is logged and reported without details, so
// database or network internals never reach the browser.
export async function safe<T>(fn: () => Promise<T>): Promise<T | Failed> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UserError) return { __error: error.message };
    console.error(error);
    return { __error: "Something went wrong. Please try again." };
  }
}
