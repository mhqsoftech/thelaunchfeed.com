"use client";

import React, { useEffect, useRef, useState } from "react";
import { LaunchTime } from "@/components/ui/LaunchTime";

/**
 * Accepts what people actually type or paste ("acme.com", "www.acme.com",
 * "github.com/you/repo") and returns a full URL, or null if it can't be one.
 */
export function normalizeProductUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const { hostname, username } = new URL(withScheme);
    return hostname.includes(".") && !hostname.endsWith(".") && !username ? withScheme : null;
  } catch {
    return null;
  }
}

/** Shown in order while the request runs; the last one holds until it returns. */
const EXTRACTION_STATUS = [
  "Reading your pages",
  "Finding your features and pricing",
  "Checking your tech stack",
  "Writing your listing",
];
const STATUS_INTERVAL_MS = 6000;

const EXAMPLE_PRODUCT_URL = "/product/vidstats";
const EXAMPLE_LOGO =
  "https://br-frosty-moon-ayumx59h.storage.c-5.us-east-2.aws.neon.tech/thelaunchfeed/logos/1792093742943-onxlj9.webp";

/**
 * Every field /api/autofill can fill, grouped like the form, with the values from
 * the live VidStats listing (long text shortened). `null` is a field that listing
 * has no value for, shown as blank because that's what a visitor would get.
 */
const EXAMPLE_LISTING: { title: string; rows: { label: string; value: React.ReactNode | null }[] }[] = [
  {
    title: "01 Core identity",
    rows: [
      {
        label: "Logo",
        value: (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={EXAMPLE_LOGO} alt="VidStats logo" width={24} height={24} loading="lazy" className="inline-block w-6 h-6 rounded-md" />
        ),
      },
      { label: "Name", value: "VidStats" },
      { label: "Tagline", value: "Grow your YouTube channel with VidStats, the leading AI YouTube analytics platform" },
      { label: "Category", value: "Analytics" },
      { label: "Tags", value: null },
      { label: "Maker", value: "Menajul · @minhaj" },
      { label: "Website", value: "vidstats.pro" },
      { label: "Demo video", value: null },
    ],
  },
  {
    title: "02 Pitch and pricing",
    rows: [
      {
        label: "Overview",
        value:
          "VidStats is an innovative platform designed to empower YouTube creators with advanced analytics and growth tools. By leveraging AI technology, VidStats provides real-time insights into channel performance…",
      },
      { label: "Feature 1", value: "AI-powered analysis of comments to understand audience sentiment and detect emotions." },
      { label: "Feature 2", value: "Data-driven recommendations for the best times to upload videos to maximize views and engagement." },
      { label: "Feature 3", value: "Personalized video ideas based on audience preferences and current trends to boost viral potential." },
      {
        label: "Audience",
        value: "YouTube creators seeking to enhance their channel performance through data-driven insights and AI-powered tools.",
      },
      { label: "Free", value: "$0/month" },
      { label: "Pro", value: "$5/month" },
      { label: "Enterprise", value: null },
      { label: "Payments", value: "Stripe" },
    ],
  },
  {
    title: "03 Architecture",
    rows: [
      { label: "Tech stack", value: "Next.js, Google Analytics, Clerk, Vercel" },
      { label: "Hosting", value: "Vercel, Vercel Edge Network" },
      { label: "GitHub", value: null },
      { label: "API", value: "vidstats.pro/api" },
      { label: "Security", value: "HTTPS/TLS, HSTS, Content-Security-Policy, X-Frame-Options: DENY, Referrer-Policy…" },
    ],
  },
  {
    title: "04 Founder story",
    rows: [
      {
        label: "Origin",
        value:
          "VidStats began as a personal project aimed at helping a small group of creators navigate the complexities of YouTube's data landscape…",
      },
      {
        label: "Thesis",
        value:
          "At VidStats, we believe that every creator deserves access to powerful analytics tools that can help them succeed…",
      },
    ],
  },
  {
    title: "05 Changelog and roadmap",
    rows: [
      { label: "Version", value: "v1.0" },
      { label: "Changelog", value: "Initial public launch — AI-powered YouTube analytics and growth tools." },
      { label: "Next up", value: "Expand the range of AI-driven content optimization features." },
      { label: "Later", value: "Introduce new tools for deeper audience engagement analysis." },
    ],
  },
  {
    title: "06 Revenue",
    rows: [{ label: "Monthly", value: null }],
  },
  {
    title: "07 FAQ and support",
    rows: [
      { label: "Question", value: "What is VidStats?" },
      {
        label: "Answer",
        value:
          "VidStats is an AI-powered analytics platform designed to help YouTube creators analyze their channel performance, optimize content, and grow their audience…",
      },
      { label: "Question", value: "Do I need to connect my YouTube channel?" },
      {
        label: "Answer",
        value: "Yes, connecting your YouTube channel allows VidStats to access your channel data and provide personalized analytics and recommendations.",
      },
      { label: "Support", value: "support@vidstats.pro" },
    ],
  },
];

const SKELETON_WIDTHS = ["w-1/3", "w-4/5", "w-3/4", "w-1/2", "w-5/6", "w-2/3"];

function hostOf(url: string): string {
  const normalized = normalizeProductUrl(url);
  if (!normalized) return "your site";
  return new URL(normalized).hostname.replace(/^www\./, "");
}

export function AutofillStart({
  url,
  onUrlChange,
  onSubmit,
  onManual,
  isExtracting,
  error,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onManual: () => void;
  isExtracting: boolean;
  error: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [statusIndex, setStatusIndex] = useState(0);

  // Ready to paste on desktop. Skipped on touch, where focus opens the keyboard
  // over the page before the visitor has read what it's for.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (!isExtracting) return;
    setStatusIndex(0);
    const timer = setInterval(
      () => setStatusIndex((i) => Math.min(i + 1, EXTRACTION_STATUS.length - 1)),
      STATUS_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [isExtracting]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-hairline bg-card p-4 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-dim">Submit your product</p>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-signal/60 bg-signal/10 text-signal uppercase font-bold">
            Next release: <LaunchTime showIst />
          </span>
        </div>

        <div className="space-y-2.5">
          <h1 className="font-mono text-2xl sm:text-4xl font-bold uppercase tracking-tight leading-[1.1] text-ink text-balance">
            Paste your link. <span className="text-signal">We&apos;ll fill out the form.</span>
          </h1>
          <p className="text-sm text-ink-dim leading-relaxed max-w-xl">
            Skip typing out seven sections. We read your website or GitHub repo and draft your
            listing. You check it, then launch.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl border-2 border-signal bg-void shadow-[0_0_0_5px_var(--color-signal-dim)] transition-shadow focus-within:shadow-[0_0_0_7px_var(--color-signal-dim)]">
            <input
              ref={inputRef}
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              readOnly={isExtracting}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="yourproduct.com"
              aria-label="Your website or GitHub repo link"
              aria-invalid={Boolean(error)}
              className="tlf-field-input w-full sm:flex-1 min-w-0 h-12 shrink-0 sm:shrink px-3 rounded-lg bg-transparent font-mono text-base text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={isExtracting}
              className="h-12 px-6 rounded-xl bg-signal text-void text-sm font-bold uppercase tracking-wide hover:bg-signal/90 transition-colors shrink-0 disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
            >
              {isExtracting ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-void animate-ping" aria-hidden />
                  <span>Reading your site</span>
                </>
              ) : (
                <>
                  <span>Fill my listing</span>
                  <span aria-hidden>→</span>
                </>
              )}
            </button>
          </div>

          {!isExtracting && (
            <p className="text-xs text-ink-dim px-1">
              Or{" "}
              <button
                type="button"
                onClick={onManual}
                className="font-semibold text-ink underline underline-offset-2 hover:text-signal transition-colors cursor-pointer"
              >
                fill in the form by hand
              </button>
            </p>
          )}

          {error ? (
            <p role="alert" className="text-xs font-semibold text-signal px-1">
              {error}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-dim">
              {["Website or GitHub repo", "No sign-up to try", "Edit everything before launch"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span className="text-verified font-bold" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="rounded-xl border border-hairline bg-void p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-wider">
            {isExtracting ? (
              <>
                <span aria-live="polite" className="text-signal truncate">
                  {EXTRACTION_STATUS[statusIndex]} on {hostOf(url)}…
                </span>
                <span className="text-ink-faint font-medium normal-case tracking-normal shrink-0">
                  Up to a minute
                </span>
              </>
            ) : (
              <>
                <span className="text-ink-dim">What you get back</span>
                <a
                  href={EXAMPLE_PRODUCT_URL}
                  target="_blank"
                  rel="noopener"
                  className="text-ink-faint hover:text-signal underline underline-offset-2 transition-colors shrink-0"
                >
                  Example: VidStats ↗
                </a>
              </>
            )}
          </div>

          <div className="sm:columns-2 gap-6 text-xs">
            {EXAMPLE_LISTING.map((group, groupIndex) => {
              const rowsBefore = EXAMPLE_LISTING.slice(0, groupIndex).reduce((n, g) => n + g.rows.length, 0);
              return (
                <section key={group.title} className="break-inside-avoid pb-4 space-y-2">
                  <h2 className="text-[11px] font-bold text-ink border-b border-hairline pb-1.5">{group.title}</h2>
                  <dl className="space-y-1.5">
                    {group.rows.map((row, rowIndex) => {
                      const i = rowsBefore + rowIndex;
                      return (
                        <div key={`${group.title}-${rowIndex}`} className="grid grid-cols-[4.75rem_1fr] gap-2 items-baseline">
                          <dt className="text-ink-faint uppercase tracking-wider text-[10px] font-bold">{row.label}</dt>
                          <dd className="min-w-0 text-ink leading-snug break-words">
                            {isExtracting ? (
                              <span
                                className={`block h-3 rounded bg-raised animate-pulse ${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}`}
                                style={{ animationDelay: `${(i % 8) * 120}ms` }}
                                aria-hidden
                              />
                            ) : (
                              <span className="tlf-autofill-value" style={{ animationDelay: `${300 + i * 60}ms` }}>
                                {row.value ?? <span className="italic opacity-60">Blank, not found</span>}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            })}
          </div>

          {!isExtracting && (
            <p className="text-[11px] text-ink-dim leading-relaxed border-t border-hairline pt-2.5">
              Example based on the live VidStats listing. Anything we can&apos;t find on your site stays
              blank for you to add. You add screenshots and pick your launch option yourself.
            </p>
          )}
        </div>
      </section>

    </div>
  );
}

/** The left rail on the start screen, in place of the seven-step progress list. */
export function AutofillStartRail() {
  const steps = [
    { title: "Paste your link", sub: "Website or GitHub repo" },
    { title: "Check the draft", sub: "Edit it and add what's missing" },
    { title: "Pick a launch", sub: "Free or paid placement" },
  ];
  return (
    <section className="space-y-3 font-sans">
      <h2 className="text-sm font-semibold text-ink">How it works</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-start gap-2.5">
            <span
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                i === 0 ? "bg-signal text-void" : "border border-hairline text-ink-dim"
              }`}
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink leading-snug">{step.title}</span>
              <span className="block text-xs text-ink-dim">{step.sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-dim border-t border-hairline pt-3">
        Goes live <LaunchTime />
      </p>
    </section>
  );
}
