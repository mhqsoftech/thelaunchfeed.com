"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  railQuote,
  RAIL_DAYS_PER_BLOCK,
  RAIL_MAX_BLOCKS,
  RAIL_PRICE_PER_BLOCK_CENTS,
  RAIL_ROTATE_MS,
  RAIL_VISIBLE_SLOTS,
} from "@/lib/rail-spotlight-shared";

export type BookableItem = {
  kind: "product" | "submission";
  id: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
};

const QUICK_DAYS = [3, 9, 30, 90];

const HOW_IT_WORKS: Array<{ k: string; v: string }> = [
  {
    k: "Where it appears",
    v: "In the Spotlight list above \"Top by category\" in the left sidebar of every board, category and product page on desktop, and in the sponsored row at the top of the page on phones and tablets.",
  },
  {
    k: "What it costs",
    v: `$1 for every ${RAIL_DAYS_PER_BLOCK} days. Book ${RAIL_DAYS_PER_BLOCK} days or as many as ${RAIL_MAX_BLOCKS * RAIL_DAYS_PER_BLOCK}, in one payment. There is no subscription and nothing renews.`,
  },
  {
    k: "When it starts and ends",
    v: "Your slot goes live as soon as the payment is confirmed and comes down on its own when the days you bought run out. You can book more days at any time from this page.",
  },
  {
    k: "When every slot is taken",
    v: `${RAIL_VISIBLE_SLOTS} sponsors are shown at once. With more bookings than that, the list rotates to the next ${RAIL_VISIBLE_SLOTS} every ${RAIL_ROTATE_MS / 1000} seconds, so every booking keeps getting its turn and you can always book.`,
  },
  {
    k: "Where the clicks go",
    v: "Straight to your website, not to a page on The Launch Feed. Links carry ?ref=thelaunchfeed so the visits show up in your own analytics, and visits to live products are counted in your maker dashboard.",
  },
  {
    k: "What you can promote",
    v: "Any live product you own or co-make, or a launch you have scheduled. The slot shows its logo, name and tagline as they appear on the site.",
  },
];

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Logo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  return (
    <span
      className="shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface flex items-center justify-center text-[11px] font-semibold text-ink-dim"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        name.substring(0, 2).toUpperCase()
      )}
    </span>
  );
}

export default function BookSpotlightClient({
  signedIn,
  items,
  liveCount,
}: {
  signedIn: boolean;
  items: BookableItem[];
  /** Sidebar bookings live right now. */
  liveCount: number;
}) {
  const [selected, setSelected] = useState<string>(items[0] ? `${items[0].kind}:${items[0].id}` : "");
  const [blocks, setBlocks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const quote = railQuote(blocks);
  const rotates = liveCount + 1 > RAIL_VISIBLE_SLOTS;
  const item = items.find((i) => `${i.kind}:${i.id}` === selected) ?? null;

  // Back from checkout: confirm the payment and create the slot.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const purchaseId = qs.get("purchaseId");
    if (qs.get("checkout") !== "success" || !purchaseId) return;
    setVerifying(true);
    fetch("/api/checkout/dodo/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseId, paymentId: qs.get("payment_id") || "" }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || "We couldn't confirm the payment.");
        setConfirmed({ startsAt: data.slot.startsAt, endsAt: data.slot.endsAt });
        try {
          sessionStorage.removeItem("tlf-layout-cache-v2");
        } catch {}
        window.history.replaceState(null, "", "/spotlight/book");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setVerifying(false));
  }, []);

  const checkout = async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/checkout/dodo/rail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: quote.blocks,
          ...(item.kind === "product" ? { productId: item.id } : { submissionId: item.id }),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.checkoutUrl) throw new Error(data.message || "Checkout could not start.");
      window.location.assign(data.checkoutUrl);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const setDays = (days: number) => setBlocks(Math.max(1, Math.min(RAIL_MAX_BLOCKS, Math.ceil(days / RAIL_DAYS_PER_BLOCK))));

  if (verifying || confirmed) {
    return (
      <section className="max-w-xl space-y-4 py-4" aria-live="polite">
        {verifying ? (
          <p className="text-ink-dim">Confirming your payment…</p>
        ) : confirmed ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Your Spotlight slot is booked</h1>
            <p className="text-ink-dim">
              It&apos;s live in the sidebar Spotlight now and runs until {dateLabel(new Date(confirmed.endsAt))}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                See it on the board
              </Link>
              <Link href="/profile?tab=subscriptions" className="inline-flex items-center h-10 px-4 rounded-full border border-hairline text-sm font-medium text-ink hover:bg-surface transition-colors">
                Your placements
              </Link>
            </div>
          </>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-14 py-2">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
      <section aria-labelledby="book-heading" className="min-w-0 space-y-8">
        <header className="space-y-2">
          <h1 id="book-heading" className="text-[28px] sm:text-[34px] font-semibold tracking-tight leading-tight text-ink">
            Reserve a Spotlight slot
          </h1>
          <p className="text-ink-dim max-w-prose">
            Put your product in the Spotlight list on every page, linking straight to your site. {money(RAIL_PRICE_PER_BLOCK_CENTS)} for
            every {RAIL_DAYS_PER_BLOCK} days, for as long as you like.
          </p>
        </header>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-600">
            {error}
          </p>
        )}

        {!signedIn ? (
          <div className="space-y-3">
            <p className="text-ink">Sign in to pick which of your products to feature.</p>
            <Link
              href="/login?redirect=/spotlight/book"
              className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in to reserve
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-3">
            <p className="text-ink">Spotlight slots promote a product you&apos;ve launched or scheduled here. You don&apos;t have one yet.</p>
            <Link
              href="/submit"
              className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Submit your product
            </Link>
          </div>
        ) : (
          <>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-ink mb-3">Product</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((i) => {
                  const key = `${i.kind}:${i.id}`;
                  const on = key === selected;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-signal/40 ${
                        on ? "border-signal bg-signal-dim" : "border-hairline bg-card hover:border-ink-faint"
                      }`}
                    >
                      <input type="radio" name="product" value={key} checked={on} onChange={() => setSelected(key)} className="sr-only" />
                      <Logo src={i.logoUrl} name={i.name} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink truncate">{i.name}</span>
                        <span className="block text-xs text-ink-dim truncate">
                          {i.kind === "submission" ? "Scheduled launch" : i.tagline}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-ink mb-3">How long</legend>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-hairline bg-card">
                  <button
                    type="button"
                    onClick={() => setBlocks((b) => Math.max(1, b - 1))}
                    disabled={blocks <= 1}
                    aria-label={`${RAIL_DAYS_PER_BLOCK} days fewer`}
                    className="w-10 h-10 rounded-full text-lg text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <output className="min-w-24 text-center text-sm font-semibold text-ink tabular-nums" aria-live="polite">
                    {quote.days} days
                  </output>
                  <button
                    type="button"
                    onClick={() => setBlocks((b) => Math.min(RAIL_MAX_BLOCKS, b + 1))}
                    disabled={blocks >= RAIL_MAX_BLOCKS}
                    aria-label={`${RAIL_DAYS_PER_BLOCK} days more`}
                    className="w-10 h-10 rounded-full text-lg text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      aria-pressed={quote.days === d}
                      className={`h-8 px-3 rounded-full border text-xs font-medium transition-colors ${
                        quote.days === d ? "border-ink bg-ink text-void" : "border-hairline text-ink-dim hover:text-ink hover:border-ink-faint"
                      }`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-ink-faint">Booked in {RAIL_DAYS_PER_BLOCK}-day blocks, up to {RAIL_MAX_BLOCKS * RAIL_DAYS_PER_BLOCK} days at a time.</p>
            </fieldset>
          </>
        )}
      </section>

      {/* Summary: the price set big, the dates, and the slot as it will look. */}
      <aside className="lg:pt-2 space-y-5" aria-label="Your booking">
        <div className="space-y-1">
          <p className="font-mono text-[56px] leading-none font-semibold text-ink tabular-nums">{money(quote.amountCents)}</p>
          <p className="text-sm text-ink-dim">
            {quote.days} days in the sidebar Spotlight
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm border-t border-hairline pt-4">
          <dt className="text-ink-dim">Starts</dt>
          <dd className="text-right font-medium text-ink">As soon as you pay</dd>
          <dt className="text-ink-dim">Runs for</dt>
          <dd className="text-right font-medium text-ink tabular-nums">{quote.days} days</dd>
          <dt className="text-ink-dim">Sponsors live now</dt>
          <dd className="text-right font-medium text-ink tabular-nums">{liveCount}</dd>
        </dl>
        <p className="text-xs text-ink-dim">
          {rotates
            ? `The sidebar shows ${RAIL_VISIBLE_SLOTS} sponsors at a time and rotates every ${RAIL_ROTATE_MS / 1000} seconds, so every booking gets its turn.`
            : `There's room for ${RAIL_VISIBLE_SLOTS} at once, so yours stays in view. With more sponsors, the slots rotate every ${RAIL_ROTATE_MS / 1000} seconds.`}
        </p>

        {item && (
          <div className="space-y-2">
            <p className="text-xs text-ink-faint">Preview</p>
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-hairline bg-card">
              <Logo src={item.logoUrl} name={item.name} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{item.name}</div>
                <div className="text-xs text-ink-dim truncate">{item.tagline}</div>
              </div>
            </div>
          </div>
        )}

        {signedIn && items.length > 0 && (
          <button
            type="button"
            onClick={checkout}
            disabled={!item || busy}
            className="tlf-launch w-full h-12 rounded-full text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "Opening checkout…" : `Pay ${money(quote.amountCents)} and reserve`}
          </button>
        )}
        <p className="text-xs text-ink-faint">One-time payment through Dodo Payments. No subscription, nothing renews.</p>
      </aside>
    </div>

      {/* How it works: the facts a buyer needs before paying. */}
      <section aria-labelledby="how-heading" className="border-t border-hairline pt-8 space-y-6">
        <h2 id="how-heading" className="text-xl font-semibold tracking-tight text-ink">
          How Spotlight slots work
        </h2>
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {HOW_IT_WORKS.map((f) => (
            <div key={f.k} className="space-y-1.5">
              <dt className="text-sm font-semibold text-ink">{f.k}</dt>
              <dd className="text-sm text-ink-dim leading-relaxed">{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
