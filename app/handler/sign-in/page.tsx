"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MainLayoutShell from "@/app/MainLayoutShell";
import { authClient } from "@/lib/auth-client";
import { saveSession, UserSession } from "@/app/data";
import { LaunchFeedLoader } from "@/components/ui/LaunchFeedLoader";

type Mode = "sign_in" | "sign_up" | "magic";
type Step = "form" | "verify_otp" | "forgot";
type UiStatus = "idle" | "loading" | "success" | "error";

function hydrateSessionFromServer(returnTo: string) {
  // The Better Auth cookie is now set. Ask /api/me for the canonical
  // UserSession shape, mirror it into localStorage, then redirect.
  return fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { session: null }))
    .then((data: { session: UserSession | null }) => {
      if (data.session) saveSession(data.session);
      window.location.href = returnTo;
    })
    .catch(() => {
      window.location.href = returnTo;
    });
}

function GoogleIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}

function GithubIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function SignInInner() {
  const search = useSearchParams();
  const returnTo = (() => {
    const p = search.get("after_auth_return_to");
    return p && p.startsWith("/") ? p : "/profile";
  })();

  const [mode, setMode] = useState<Mode>("sign_in");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<UiStatus>("idle");
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const resetError = () => setMessage(null);

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const errorParam = search.get("error");
    if (errorParam) {
      setMessage({ kind: "error", text: decodeURIComponent(errorParam) });
    }
  }, [search]);

  // Check if authenticated locally or via Neon Auth callback
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // 1. First check local session
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.session && !cancelled) {
            saveSession(meData.session);
            window.location.href = returnTo;
            return;
          }
        }
      } catch {}

      // 2. Check if Neon Auth has an active session from recent OAuth redirect.
      //    Retry a few times — the session may take a moment to propagate after
      //    the OAuth callback redirect chain completes.
      const neonAuthUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
      if (neonAuthUrl) {
        for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
          try {
            const neonSessionRes = await fetch(`${neonAuthUrl}/get-session`, {
              credentials: "include",
              headers: {
                Origin: window.location.origin,
              },
            });

            if (neonSessionRes.ok) {
              const neonData = await neonSessionRes.json();
              if (neonData?.session?.token && !cancelled) {
                // Sync to local Next.js cookies and PostgreSQL
                const syncRes = await fetch("/api/auth/sync-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionToken: neonData.session.token,
                    userId: neonData.user?.id,
                  }),
                });

                if (syncRes.ok) {
                  const syncData = await syncRes.json();
                  if (syncData?.session && !cancelled) {
                    saveSession(syncData.session);
                    window.location.href = returnTo;
                    return;
                  }
                }
                // Sync found a token but sync-session failed — stop retrying
                break;
              }
            }
          } catch {}
        }
      }

      if (!cancelled) setIsChecking(false);
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  /* ─────────── Sign in with password ─────────── */
  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    resetError();
    if (!email.trim() || !password) return;
    setStatus("loading");

    const { data, error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus("error");
      setMessage({ kind: "error", text: error.message || "Invalid email or password" });
      return;
    }
    if (!data) {
      setStatus("error");
      setMessage({ kind: "error", text: "Unexpected error signing in" });
      return;
    }
    setStatus("success");
    await hydrateSessionFromServer(returnTo);
  }

  /* ─────────── Sign up ─────────── */
  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    resetError();
    if (!email.trim() || !password || password.length < 8) {
      setMessage({ kind: "error", text: "Enter your email and a password of at least 8 characters." });
      return;
    }
    setStatus("loading");

    const { data, error } = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: name.trim() || email.split("@")[0],
    });

    if (error) {
      setStatus("error");
      setMessage({ kind: "error", text: error.message || "Sign-up failed" });
      return;
    }
    if (!data) {
      setStatus("error");
      setMessage({ kind: "error", text: "Sign-up failed" });
      return;
    }

    // sendVerificationOnSignUp is enabled → an OTP was just emailed.
    setStatus("idle");
    setStep("verify_otp");
    setMessage({ kind: "info", text: `We emailed a 6-digit code to ${email.trim()}.` });
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    resetError();
    if (otp.trim().length < 4) return;
    setStatus("loading");

    const { error } = await authClient.emailOtp.verifyEmail({
      email: email.trim(),
      otp: otp.trim(),
    });

    if (error) {
      setStatus("error");
      setMessage({ kind: "error", text: error.message || "Invalid or expired code" });
      return;
    }
    setStatus("success");
    await hydrateSessionFromServer(returnTo);
  }

  async function onResendOtp() {
    resetError();
    setStatus("loading");
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "email-verification",
    });
    setStatus("idle");
    if (error) setMessage({ kind: "error", text: error.message || "Could not send code" });
    else setMessage({ kind: "info", text: "A new code is on its way." });
  }

  /* ─────────── Magic link (email OTP sign-in) ─────────── */
  async function onSendSignInOtp(e: React.FormEvent) {
    e.preventDefault();
    resetError();
    if (!email.trim()) return;
    setStatus("loading");
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    if (error) {
      setStatus("error");
      setMessage({ kind: "error", text: error.message || "Could not send sign-in code" });
      return;
    }
    setStatus("idle");
    setStep("verify_otp");
    setMessage({ kind: "info", text: `We emailed a sign-in code to ${email.trim()}.` });
  }

  async function onVerifySignInOtp(e: React.FormEvent) {
    e.preventDefault();
    resetError();
    if (otp.trim().length < 4) return;
    setStatus("loading");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signInAny = authClient.signIn as any;
    const { error } = await signInAny.emailOtp({
      email: email.trim(),
      otp: otp.trim(),
    });
    if (error) {
      setStatus("error");
      setMessage({ kind: "error", text: error.message || "Invalid or expired code" });
      return;
    }
    setStatus("success");
    await hydrateSessionFromServer(returnTo);
  }

  /* ─────────── Forgot password ─────────── */
  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    resetError();
    if (!email.trim()) return;
    setStatus("loading");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = authClient as any;
    const { error } =
      typeof client.forgetPassword === "function"
        ? await client.forgetPassword({
            email: email.trim(),
            redirectTo: `${window.location.origin}/handler/sign-in`,
          })
        : await client.forgetPassword.emailOtp({ email: email.trim() });
    setStatus("idle");
    if (error) setMessage({ kind: "error", text: error.message || "Could not send reset email" });
    else setMessage({ kind: "info", text: `Reset link sent to ${email.trim()}.` });
  }

  /* ─────────── Social ─────────── */
  async function onSocial(provider: "google" | "github") {
    resetError();
    setStatus("loading");
    // Direct browser redirect via server-side OAuth initiator
    window.location.href = `/api/auth/social?provider=${provider}&after_auth_return_to=${encodeURIComponent(returnTo)}`;
  }

  /* ─────────── UI ─────────── */
  const isOtpStep = step === "verify_otp";
  const isForgotStep = step === "forgot";

  if (isChecking) {
    return (
      <MainLayoutShell>
        <div className="w-full flex items-center justify-center py-24">
          <LaunchFeedLoader size={32} />
        </div>
      </MainLayoutShell>
    );
  }

  return (
    <MainLayoutShell>
      <div className="w-full space-y-6 font-mono text-ink">
        <div className="sticky -top-4 z-30 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="h-10 flex items-end justify-between pb-2.5">
            <Link
              href="/"
              className="text-xs font-mono text-ink-dim hover:text-ink flex items-center gap-1.5 transition-colors"
            >
              ← Back to Launch Feed
            </Link>
            <span className="text-[10px] font-mono px-2.5 py-1 border border-hairline bg-surface text-ink uppercase font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
              AUTHENTICATION GATEWAY
            </span>
          </div>
        </div>

        <div className="w-full border border-hairline bg-surface">
          <div className="border-b border-hairline px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-signal shrink-0" />
              <div className="text-xs uppercase font-bold tracking-wider text-ink font-mono">
                {isForgotStep
                  ? "RESET PASSWORD"
                  : isOtpStep
                    ? "VERIFY EMAIL"
                    : mode === "sign_in"
                      ? "SIGN IN"
                      : mode === "sign_up"
                        ? "CREATE ACCOUNT"
                        : "EMAIL SIGN-IN CODE"}
              </div>
            </div>
            <div className="text-[10px] uppercase font-mono text-ink-dim border border-hairline px-2 py-0.5 bg-void">
              Better Auth · Neon Postgres
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6 w-full font-mono">
            {/* Mode tabs — hidden while inside OTP / forgot */}
            {!isOtpStep && !isForgotStep && (
              <div className="grid grid-cols-3 gap-2 p-1 border border-hairline bg-void w-full">
                {([
                  ["sign_in", "Sign In"],
                  ["sign_up", "Sign Up"],
                  ["magic", "Email Code"],
                ] as const).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setStep("form");
                      setMessage(null);
                    }}
                    className={`py-2 text-[11px] uppercase font-bold transition-colors cursor-pointer border ${
                      mode === m
                        ? "bg-signal/10 text-signal border-signal/25"
                        : "bg-transparent text-ink-dim hover:text-ink hover:bg-surface border-transparent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {message && (
              <div
                className={`border p-3.5 text-xs font-mono space-y-1 ${
                  message.kind === "error"
                    ? "border-signal bg-signal/10 text-signal"
                    : "border-hairline bg-void text-ink-dim"
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 shrink-0 ${
                      message.kind === "error" ? "bg-signal" : "bg-ink"
                    }`}
                  />
                  {message.kind === "error" ? "AUTHENTICATION ERROR" : "NOTICE"}
                </div>
                <div className="text-ink-dim leading-relaxed text-xs">{message.text}</div>
              </div>
            )}

            <section className="space-y-4 w-full">
              {/* ─── Forgot password ─── */}
              {isForgotStep && (
                <form onSubmit={onForgot} className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-ink-dim block">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading" || !email.trim()}
                    className="w-full text-[11px] uppercase font-bold px-6 py-3 border border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {status === "loading" ? "Sending…" : "Send reset link →"}
                  </button>
                  <button
                    type="button"
                    className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                    onClick={() => {
                      setStep("form");
                      setMessage(null);
                    }}
                  >
                    ← Back to sign in
                  </button>
                </form>
              )}

              {/* ─── OTP verification (used by sign-up + magic sign-in) ─── */}
              {isOtpStep && (
                <form
                  onSubmit={mode === "sign_up" ? onVerifyOtp : onVerifySignInOtp}
                  className="space-y-3 border border-hairline p-4 bg-void"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-dim text-[10px] uppercase">
                      Code sent to: <span className="text-ink font-bold">{email}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("form");
                        setOtp("");
                        setMessage(null);
                      }}
                      className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                    >
                      ← Change email
                    </button>
                  </div>
                  <label className="text-[10px] uppercase font-bold text-ink-dim block">
                    6-digit code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 text-sm font-mono tracking-widest text-center bg-surface border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading" || otp.length < 4}
                    className="w-full text-[11px] uppercase font-bold px-6 py-3 border border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {status === "loading"
                      ? "Verifying…"
                      : mode === "sign_up"
                        ? "Verify & continue →"
                        : "Sign in →"}
                  </button>
                  <button
                    type="button"
                    onClick={onResendOtp}
                    className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                    disabled={status === "loading"}
                  >
                    Resend code
                  </button>
                </form>
              )}

              {/* ─── Sign in (password) ─── */}
              {!isOtpStep && !isForgotStep && mode === "sign_in" && (
                <form onSubmit={onSignIn} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-ink-dim block">Email</label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-ink-dim block">Password</label>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={status === "loading" || !email.trim() || !password}
                    className="w-full text-[11px] uppercase font-bold px-6 py-3 border border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {status === "loading" ? "Signing in…" : "Sign in →"}
                  </button>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("forgot");
                        setMessage(null);
                      }}
                      className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("sign_up");
                        setMessage(null);
                      }}
                      className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                    >
                      Create an account →
                    </button>
                  </div>
                </form>
              )}

              {/* ─── Sign up ─── */}
              {!isOtpStep && !isForgotStep && mode === "sign_up" && (
                <form onSubmit={onSignUp} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-ink-dim block">Name</label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-ink-dim block">Email</label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-ink-dim block">
                        Password (min 8)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={status === "loading" || !email.trim() || password.length < 8}
                    className="w-full text-[11px] uppercase font-bold px-6 py-3 border border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {status === "loading" ? "Creating account…" : "Create account & send code →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("sign_in");
                      setMessage(null);
                    }}
                    className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                  >
                    ← Already have an account
                  </button>
                </form>
              )}

              {/* ─── Magic (email code sign-in) ─── */}
              {!isOtpStep && !isForgotStep && mode === "magic" && (
                <form onSubmit={onSendSignInOtp} className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-ink-dim block">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-void border border-hairline focus:outline-none focus:border-signal placeholder:text-ink-faint transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading" || !email.trim()}
                    className="w-full text-[11px] uppercase font-bold px-6 py-3 border border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {status === "loading" ? "Sending code…" : "Email me a sign-in code →"}
                  </button>
                </form>
              )}
            </section>

            {!isOtpStep && !isForgotStep && (
              <>
                <div className="flex items-center gap-3 text-[10px] uppercase text-ink-dim w-full">
                  <div className="flex-1 h-px bg-hairline" />
                  <span>or continue with</span>
                  <div className="flex-1 h-px bg-hairline" />
                </div>

                <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => onSocial("google")}
                    className="group w-full text-left p-3.5 border border-hairline bg-void hover:border-signal/40 hover:bg-surface/50 transition-colors cursor-pointer block"
                  >
                    <div className="flex items-center gap-2.5">
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <div className="text-[11px] font-bold uppercase text-ink group-hover:text-signal transition-colors">
                        Google
                      </div>
                    </div>
                    <div className="text-[10px] text-ink-dim mt-1 pl-6.5">Continue with Google</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSocial("github")}
                    className="group w-full text-left p-3.5 border border-hairline bg-void hover:border-signal/40 hover:bg-surface/50 transition-colors cursor-pointer block"
                  >
                    <div className="flex items-center gap-2.5">
                      <GithubIcon className="w-4 h-4 shrink-0 text-ink group-hover:text-signal transition-colors" />
                      <div className="text-[11px] font-bold uppercase text-ink group-hover:text-signal transition-colors">
                        GitHub
                      </div>
                    </div>
                    <div className="text-[10px] text-ink-dim mt-1 pl-6.5">Continue with GitHub</div>
                  </button>
                </section>
              </>
            )}
          </div>

          <div className="border-t border-hairline px-5 py-3 text-[10px] uppercase text-ink-dim flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-surface">
            <span>By continuing, you agree to the Terms and Privacy Policy.</span>
            <span>
              Returning to: <span className="text-ink font-bold">{returnTo}</span>
            </span>
          </div>
        </div>
      </div>
    </MainLayoutShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8">
          <LaunchFeedLoader size={32} />
        </div>
      }
    >
      <SignInInner />
    </Suspense>
  );
}
