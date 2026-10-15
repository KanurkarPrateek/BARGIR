// How server actions report a problem the user should read.
//
// In production Next.js replaces the message of any error thrown by a server
// action with a generic one. So actions that have something to tell the user
// return it as a value (see safe() in src/lib/safe-action.ts) and the screen
// turns it back into an error with call().

export interface Failed {
  __error: string;
}

const isFailed = (value: unknown): value is Failed =>
  typeof value === "object" && value !== null && "__error" in value;

// Awaits a server action; throws its message if it reported a problem.
export async function call<T>(result: Promise<T | Failed>): Promise<T> {
  const value = await result;
  if (isFailed(value)) throw new Error(value.__error);
  return value;
}
