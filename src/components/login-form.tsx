"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  Headphones,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";
export default function Login({
  publicDemoEnabled = true,
}: {
  publicDemoEnabled?: boolean;
}) {
  const hydrated = useHydrated();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Headphones size={22} />
          </span>
          GalleryPulse<span className="brand-dot">®</span>
        </div>
        <div>
          <div className="eyebrow">EVERY INTERACTION TELLS A STORY</div>
          <h1>
            Understand the art
            <br />
            of listening.
          </h1>
          <p>
            Credible measurements. Meaningful insights.
            <br />A clearer picture of your gallery experience.
          </p>
          <div className="login-wave">
            {Array.from({ length: 42 }, (_, i) => (
              <i
                key={i}
                style={{
                  height: Math.round(
                    20 +
                      Math.abs(Math.sin(i * 0.7)) * 110 +
                      Math.sin(i * 0.2) * 30,
                  ),
                }}
              />
            ))}
          </div>
        </div>
        <span className="small muted">
          Purpose-built for spaces that inspire.
        </span>
      </section>
      <section className="login-form">
        <div className="login-box">
          <span className="label-chip">
            <ShieldCheck size={14} /> SECURE WORKSPACE
          </span>
          <h2>Welcome back.</h2>
          <p className="muted">
            Sign in to your listening intelligence workspace.
          </p>
          <form
            method="post"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const result = await signIn("credentials", {
                  email: f.get("email"),
                  password: f.get("password"),
                  redirect: false,
                });
                // Authentication changes the cookie outside the App Router.
                // Reload so an earlier anonymous route cache cannot send the user back to login.
                if (result?.ok)
                  window.location.assign(
                    new URL("/overview", window.location.origin),
                  );
                else {
                  const health = await fetch("/api/health").catch(() => null);
                  setError(
                    !health?.ok
                      ? "The database is unavailable. Start it with npm run db:local, then try again."
                      : result?.error === "RATE_LIMIT"
                        ? "Too many sign-in attempts. Wait one minute and try again."
                        : "Unable to sign in. Check your email and password.",
                  );
                }
              } catch {
                setError("Sign-in service is unavailable. Try again.");
              }
              setBusy(false);
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@gallery.org"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div role="alert" className="alert error">
                {error}
              </div>
            )}
            <Button disabled={busy || !hydrated} type="submit">
              {busy ? <LoaderCircle size={16} className="spin" /> : null}Sign in
              to workspace
              <ArrowRight size={16} />
            </Button>
          </form>
          {publicDemoEnabled && (
            <Button asChild variant="outline" className="demo-entry">
              <Link href="/demo/overview">
                Explore demo without signing in
                <ArrowRight size={16} />
              </Link>
            </Button>
          )}
          <div className="login-note">
            Your administrator provides workspace access.
            <br />
            Demo credentials are configured during database seeding.
          </div>
        </div>
      </section>
    </main>
  );
}
