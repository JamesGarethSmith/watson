import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { login } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Family calendar</p>
        <h1>Welcome back</h1>
        <p className="intro">Sign in to see what&rsquo;s coming up.</p>

        <form action={login} className="login-form">
          <label>
            Email
            <input
              autoComplete="email"
              autoFocus
              name="email"
              required
              type="email"
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              minLength={6}
              name="password"
              required
              type="password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
