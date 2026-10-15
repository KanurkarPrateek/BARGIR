import { signInAction } from "../actions";
import { btn, Notice } from "@/components/ui";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={signInAction} className="w-full max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <div>
          <h1 className="text-lg font-semibold">Control Panel</h1>
          <p className="text-sm text-stone-500">Internal: clusters, gyms, billing and sales.</p>
        </div>
        <Notice params={params} />
        <div className="space-y-1"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" /></div>
        <div className="space-y-1"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
        <button className={`${btn} w-full`}>Sign in</button>
      </form>
    </main>
  );
}
