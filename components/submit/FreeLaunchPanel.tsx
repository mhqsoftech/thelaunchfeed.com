"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getFreeLaunchStatus, verifyFreeLaunchBadge, type FreeLaunchStatus } from "@/app/actions/freeLaunch";

/**
 * Free ($0) launch requirements shown on the submit page:
 *   1. Embed The Launch Feed badge on your site → Verify
 *   2. Upvote any 3 launched products (newest first) — 3 new ones per free launch;
 *      fewer (or none) when the maker has no unused launches left to upvote
 * Reports `qualified` upward so the submit button can unlock.
 */
export function FreeLaunchPanel({
  websiteUrl,
  onQualifiedChange,
}: {
  websiteUrl: string;
  onQualifiedChange: (qualified: boolean) => void;
}) {
  const [status, setStatus] = useState<FreeLaunchStatus | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getFreeLaunchStatus(websiteUrl));
    } catch (err) {
      console.error("[free-launch] status failed:", err);
    }
  }, [websiteUrl]);

  useEffect(() => {
    const t = setTimeout(refresh, 300); // debounce typing in the URL field
    return () => clearTimeout(t);
  }, [refresh]);

  // Upvotes happen on each product's own page (opened in a new tab), so
  // re-check progress whenever the founder comes back to this tab.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);

  useEffect(() => {
    onQualifiedChange(Boolean(status?.qualified));
  }, [status?.qualified, onQualifiedChange]);

  const verify = async () => {
    if (!websiteUrl.trim()) {
      setVerifyMsg({ ok: false, text: "Add your website URL in step 01 first." });
      return;
    }
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await verifyFreeLaunchBadge(websiteUrl);
      setVerifyMsg(
        res.verified
          ? { ok: true, text: `Badge found on ${res.domain}${res.method === "referer" ? " (badge image loaded from your site)" : ""}.` }
          : { ok: false, text: res.reason || "Badge not found yet." }
      );
      await refresh();
    } catch (err) {
      setVerifyMsg({ ok: false, text: err instanceof Error && err.message === "UNAUTHENTICATED" ? "Sign in to verify your badge." : "Verification failed — try again." });
    } finally {
      setVerifying(false);
    }
  };

  const copy = async () => {
    if (!status) return;
    try {
      await navigator.clipboard.writeText(status.snippets[theme]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!status) {
    return <div className="h-40 rounded-[var(--radius-card)] border border-hairline bg-card animate-pulse" aria-busy="true" />;
  }

  const site = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");
  const upvoteOk = status.upvotesDone >= status.required;
  const visible = showAll ? status.products : status.products.slice(0, 8);

  return (
    <section aria-labelledby="free-launch-heading" className="rounded-[var(--radius-card)] border border-hairline bg-card p-4 sm:p-6 space-y-5 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="free-launch-heading" className="text-base font-semibold text-ink">
            Unlock your free launch
          </h2>
          <p className="text-sm text-ink-dim mt-0.5">Two quick steps keep free launches fair for everyone.</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            status.qualified ? "bg-verified/10 text-verified" : "bg-surface text-ink-dim"
          }`}
        >
          {(status.badge.verified ? 1 : 0) + (upvoteOk ? 1 : 0)} / 2 done
        </span>
      </div>

      {!status.signedIn && (
        <p className="text-sm rounded-xl bg-signal-dim text-signal px-4 py-3">
          <Link href="/login?redirect=/submit" className="font-semibold underline">Sign in</Link> to verify your badge and
          record upvotes. Your form is saved automatically.
        </p>
      )}

      {/* Step 1 — badge */}
      <div className="rounded-xl border border-hairline p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink flex items-center gap-2">
            <StepDot done={status.badge.verified} n={1} />
            Add our badge to your website
          </h3>
          {status.badge.verified && <span className="text-xs font-semibold text-verified">Verified ✓</span>}
        </div>
        <p className="text-sm text-ink-dim">
          Paste this on your homepage (footer is fine) — it&apos;s made for your URL, so it works before you launch. Until
          your product is live it links to our homepage; the moment it launches, the same badge links to your product page
          and shows your live votes. No re-embed needed. Free launches keep their dofollow backlink while the badge stays up.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${site}/api/badge/featured?theme=${theme}`} alt="Featured on The Launch Feed badge preview" width={220} height={48} className="h-12 w-auto" />
          <div role="radiogroup" aria-label="Badge theme" className="flex p-0.5 rounded-full border border-hairline text-xs">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1 rounded-full capitalize ${theme === t ? "bg-ink text-void" : "text-ink-dim"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <pre className="text-xs font-mono bg-surface rounded-lg p-3 pr-20 overflow-x-auto whitespace-pre-wrap break-all text-ink-dim">
            {status.snippets[theme]}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 h-8 px-3 rounded-full border border-hairline bg-card text-xs font-semibold text-ink hover:border-ink-faint"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={verify}
            disabled={verifying || !status.signedIn}
            className="h-10 px-4 rounded-full bg-ink text-void text-sm font-semibold disabled:opacity-50"
          >
            {verifying ? "Checking your site…" : status.badge.verified ? "Re-check badge" : "Verify badge"}
          </button>
          <span className="text-xs text-ink-faint">{status.badge.domain ? `Checking ${status.badge.domain}` : "Uses the website URL from step 01"}</span>
        </div>
        {verifyMsg && (
          <p role="status" className={`text-sm ${verifyMsg.ok ? "text-verified" : "text-signal"}`}>
            {verifyMsg.text}
          </p>
        )}
      </div>

      {/* Step 2 — upvotes */}
      <div className="rounded-xl border border-hairline p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink flex items-center gap-2">
            <StepDot done={upvoteOk} n={2} />
            {status.required === 0
              ? "Upvote new launched products"
              : `Upvote any ${status.required} new launched product${status.required === 1 ? "" : "s"}`}
          </h3>
          <span className={`text-xs font-semibold tabular-nums ${upvoteOk ? "text-verified" : "text-ink-dim"}`}>
            {status.upvotesDone} / {status.required}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface overflow-hidden" aria-hidden>
          <div className="h-full bg-signal transition-all" style={{ width: `${status.required ? (status.upvotesDone / status.required) * 100 : 100}%` }} />
        </div>
        {status.required === 0 ? (
          <p className="text-sm text-ink-dim">
            Nothing left to upvote — you&apos;ve already used every live launch for earlier free launches, so your verified
            badge is all this launch needs.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-dim">
              Open a launch, check it out, and upvote it on its product page. Every free launch needs {status.required} new
              upvote{status.required === 1 ? "" : "s"} — products you upvoted for an earlier free launch don&apos;t count again.
              Progress updates when you come back to this tab.
            </p>
            <ul className="divide-y divide-hairline">
              {visible.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-10 h-10 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface flex items-center justify-center text-[10px] font-mono font-bold text-ink-dim">
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logoUrl} alt="" width={40} height={40} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      p.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a href={`/product/${p.slug}`} target="_blank" rel="noopener" className="text-sm font-semibold text-ink hover:text-signal truncate block">
                      {p.name}
                    </a>
                    <p className="text-xs text-ink-dim truncate">
                      {p.tagline}
                      <span className="text-ink-faint"> · {new Date(p.launchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </p>
                  </div>
                  {p.voted ? (
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full text-xs font-semibold ${
                        p.counts ? "bg-verified/10 text-verified" : "bg-surface text-ink-faint"
                      }`}
                      title={p.counts ? "Counts toward your free launch" : "Already used for an earlier free launch — upvote a different product"}
                    >
                      ✓ Upvoted
                    </span>
                  ) : (
                    <a
                      href={`/product/${p.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-hairline text-xs font-semibold text-ink hover:border-signal hover:text-signal transition-colors"
                      aria-label={`Open ${p.name} to upvote it`}
                    >
                      Open &amp; upvote <span aria-hidden>↗</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {status.products.length > 8 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-signal hover:underline">
                {showAll ? "Show fewer" : `Show ${status.products.length - 8} more launches`}
              </button>
            )}
          </>
        )}
      </div>

      {!status.qualified && (
        <p className="text-sm text-ink-dim">
          Don&apos;t want to wait? The $5 and $10 launches skip these steps and add a 30-day spotlight.
        </p>
      )}
    </section>
  );
}

function StepDot({ done, n }: { done: boolean; n: number }) {
  return (
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? "bg-verified text-white" : "bg-surface text-ink-dim border border-hairline"
      }`}
      aria-hidden
    >
      {done ? "✓" : n}
    </span>
  );
}
