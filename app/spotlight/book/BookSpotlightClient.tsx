"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  railQuote,
  RAIL_DAYS_PER_BLOCK,
  RAIL_MAX_BLOCKS,
  RAIL_MAX_ITEMS,
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
  /** The product's own website, where its Spotlight slot links. */
  websiteUrl: string;
};

/** A product that isn't listed here, described by the buyer. */
type CustomEntry = {
  key: number;
  url: string;
  name: string;
  tagline: string;
  /** https URL read from the site, or an uploaded image as a data URI. */
  logo: string | null;
  status: "idle" | "fetching" | "read" | "unreadable";
  note: string | null;
  readUrl: string | null;
};

const QUICK_DAYS = [3, 9, 30, 90];
const MAX_ICON_BYTES = 500_000;
const FIELD =
  "w-full h-10 px-3 rounded-lg border border-hairline bg-card text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-[border-color,box-shadow]";
const SMALL_BTN =
  "shrink-0 h-10 px-4 rounded-lg border border-hairline bg-card text-sm font-medium text-ink hover:border-ink-faint disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const HOW_IT_WORKS: Array<{ k: string; v: string }> = [
  {
    k: "Where it appears",
    v: "In the Spotlight list above \"Top by category\" in the left sidebar of every board, category and product page on desktop, and in the sponsored row at the top of the page on phones and tablets.",
  },
  {
    k: "What it costs",
    v: `$1 per product for every ${RAIL_DAYS_PER_BLOCK} days. Sponsor up to ${RAIL_MAX_ITEMS} products in one booking, for ${RAIL_DAYS_PER_BLOCK} days or as many as ${RAIL_MAX_BLOCKS * RAIL_DAYS_PER_BLOCK}. One payment, no subscription, nothing renews.`,
  },
  {
    k: "When it starts and ends",
    v: "Every product goes live as soon as the payment is confirmed and comes down on its own when the days you bought run out. You can book more days at any time from this page.",
  },
  {
    k: "When every slot is taken",
    v: `${RAIL_VISIBLE_SLOTS} sponsors are shown at once. With more bookings than that, the list rotates to the next ${RAIL_VISIBLE_SLOTS} every ${RAIL_ROTATE_MS / 1000} seconds, so every booking keeps getting its turn and you can always book.`,
  },
  {
    k: "Where the clicks go",
    v: "Straight to each product's own website, never to a page on The Launch Feed. Links carry ?ref=thelaunchfeed so the visits show up in your analytics, and visits to your live products are counted in your maker dashboard.",
  },
  {
    k: "What you can promote",
    v: "Your live products, launches you have scheduled, and any other product from its URL. We read its icon, name and tagline; when a site can't be read, you add them yourself. Everything you sponsor shows in your dashboard.",
  },
];

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function Logo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className="shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface flex items-center justify-center text-[11px] font-semibold text-ink-dim"
      style={{ width: size, height: size }}
    >
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} onError={() => setFailed(src)} className="w-full h-full object-cover" />
      ) : (
        (name || "?").substring(0, 2).toUpperCase()
      )}
    </span>
  );
}

let nextKey = 1;
const newEntry = (): CustomEntry => ({
  key: nextKey++,
  url: "",
  name: "",
  tagline: "",
  logo: null,
  status: "idle",
  note: null,
  readUrl: null,
});

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
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items[0] ? [`${items[0].kind}:${items[0].id}`] : []));
  const [customs, setCustoms] = useState<CustomEntry[]>(() => (items.length === 0 ? [newEntry()] : []));
  const [blocks, setBlocks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ endsAt: string; products: number } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const listedChosen = items.filter((i) => picked.has(`${i.kind}:${i.id}`));
  const customsStarted = customs.filter((c) => c.url.trim() || c.name.trim());
  const customsReady = customsStarted.filter((c) => c.url.trim() && c.name.trim());
  const incomplete = customsStarted.length - customsReady.length;
  const count = listedChosen.length + customsReady.length;
  const quote = railQuote(blocks, Math.max(1, count));
  const rotates = liveCount + count > RAIL_VISIBLE_SLOTS;
  const canAddMore = listedChosen.length + customs.length < RAIL_MAX_ITEMS;
  const canPay = count > 0 && incomplete === 0 && count <= RAIL_MAX_ITEMS;

  const preview = [
    ...listedChosen.map((i) => ({ key: `${i.kind}:${i.id}`, name: i.name, tagline: i.tagline, logo: i.logoUrl, host: hostOf(i.websiteUrl) })),
    ...customsReady.map((c) => ({ key: `c${c.key}`, name: c.name.trim(), tagline: c.tagline.trim(), logo: c.logo, host: hostOf(c.url) })),
  ];

  // Back from checkout: confirm the payment and create the slots.
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
        setConfirmed({ endsAt: data.slot.endsAt, products: data.products ?? 1 });
        try {
          sessionStorage.removeItem("tlf-layout-cache-v2");
        } catch {}
        window.history.replaceState(null, "", "/spotlight/book");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setVerifying(false));
  }, []);

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (listedChosen.length + customs.length < RAIL_MAX_ITEMS) next.add(key);
      return next;
    });

  const patch = (key: number, p: Partial<CustomEntry>) =>
    setCustoms((prev) => prev.map((c) => (c.key === key ? { ...c, ...p } : c)));

  const readSite = async (entry: CustomEntry) => {
    const url = entry.url.trim();
    if (!url || entry.status === "fetching" || url === entry.readUrl) return;
    patch(entry.key, { status: "fetching", note: null });
    try {
      const r = await fetch("/api/spotlight/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.product) {
        patch(entry.key, { status: "idle", note: data.message || "That address can't be used.", readUrl: url });
        return;
      }
      const p = data.product as { url: string; name: string; tagline: string; logoUrl: string | null };
      setCustoms((prev) =>
        prev.map((c) => {
          if (c.key !== entry.key) return c;
          // Never overwrite what the buyer already typed or uploaded.
          return {
            ...c,
            url: p.url,
            readUrl: p.url,
            name: c.name.trim() ? c.name : p.name,
            tagline: c.tagline.trim() ? c.tagline : p.tagline,
            logo: c.logo ?? p.logoUrl,
            status: data.fetched ? "read" : "unreadable",
            note: data.fetched ? null : "We couldn't read that site. Add the name, tagline and icon yourself.",
          };
        })
      );
    } catch {
      patch(entry.key, { status: "unreadable", note: "We couldn't read that site. Add the name, tagline and icon yourself.", readUrl: url });
    }
  };

  const uploadIcon = (key: number, file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) {
      patch(key, { note: "Use a PNG, JPG, WebP, SVG or GIF image for the icon." });
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      patch(key, { note: "That icon is over 500 KB. A small square image works best." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch(key, { logo: String(reader.result), note: null });
    reader.readAsDataURL(file);
  };

  const checkout = async () => {
    if (!canPay) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/checkout/dodo/rail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: quote.blocks,
          items: [
            ...listedChosen.map((i) => (i.kind === "product" ? { productId: i.id } : { submissionId: i.id })),
            ...customsReady.map((c) => ({
              custom: { url: c.url.trim(), name: c.name.trim(), tagline: c.tagline.trim(), logoUrl: c.logo },
            })),
          ],
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
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
              {confirmed.products > 1 ? `Your ${confirmed.products} Spotlight slots are booked` : "Your Spotlight slot is booked"}
            </h1>
            <p className="text-ink-dim">
              {confirmed.products > 1 ? "They're live in the sidebar Spotlight now and run" : "It's live in the sidebar Spotlight now and runs"} until{" "}
              {dateLabel(new Date(confirmed.endsAt))}.
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
              Put your products in the Spotlight list on every page, each linking straight to its own website.{" "}
              {money(RAIL_PRICE_PER_BLOCK_CENTS)} per product for every {RAIL_DAYS_PER_BLOCK} days, for as long as you like.
            </p>
          </header>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-600">
              {error}
            </p>
          )}

          {!signedIn ? (
            <div className="space-y-3">
              <p className="text-ink">Sign in to choose the products to feature.</p>
              <Link
                href="/login?redirect=/spotlight/book"
                className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Sign in to reserve
              </Link>
            </div>
          ) : (
            <>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-ink">Products</legend>
                <p className="text-xs text-ink-faint -mt-1">Pick one or more, up to {RAIL_MAX_ITEMS}. Each gets its own slot.</p>

                {items.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((i) => {
                      const key = `${i.kind}:${i.id}`;
                      const on = picked.has(key);
                      return (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-signal/40 ${
                            on ? "border-signal bg-signal-dim" : "border-hairline bg-card hover:border-ink-faint"
                          }`}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggle(key)} className="sr-only" />
                          <Logo src={i.logoUrl} name={i.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink truncate">{i.name}</span>
                            <span className="block text-xs text-ink-dim truncate">
                              {hostOf(i.websiteUrl)}
                              {i.kind === "submission" ? ", scheduled launch" : ""}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center text-[11px] font-bold ${
                              on ? "border-signal bg-signal text-white" : "border-hairline"
                            }`}
                          >
                            {on ? "✓" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {customs.map((c, idx) => (
                  <div key={c.key} className="rounded-xl border border-hairline bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">Other product {customs.length > 1 ? idx + 1 : ""}</p>
                      <button
                        type="button"
                        onClick={() => setCustoms((prev) => prev.filter((x) => x.key !== c.key))}
                        className="text-xs text-ink-dim hover:text-rose-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor={`url-${c.key}`} className="block text-xs font-medium text-ink-dim">
                        Product URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          id={`url-${c.key}`}
                          type="url"
                          inputMode="url"
                          placeholder="https://yourproduct.com"
                          value={c.url}
                          onChange={(e) => patch(c.key, { url: e.target.value })}
                          onBlur={() => void readSite(c)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void readSite(c);
                            }
                          }}
                          className={FIELD}
                        />
                        <button type="button" onClick={() => void readSite(c)} disabled={!c.url.trim() || c.status === "fetching"} className={SMALL_BTN}>
                          {c.status === "fetching" ? "Reading…" : "Fetch details"}
                        </button>
                      </div>
                      <p className={`text-xs ${c.note ? "text-amber-700 dark:text-amber-400" : "text-ink-faint"}`} aria-live="polite">
                        {c.note ?? "We read the icon, name and tagline from the site. You can change any of them."}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] items-start">
                      <div className="space-y-1.5">
                        <span className="block text-xs font-medium text-ink-dim">Icon</span>
                        <Logo src={c.logo} name={c.name} size={56} />
                        <label className="block text-xs font-medium text-signal hover:underline cursor-pointer focus-within:underline">
                          {c.logo ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                            className="sr-only"
                            onChange={(e) => uploadIcon(c.key, e.target.files?.[0])}
                          />
                        </label>
                      </div>
                      <div className="space-y-3 min-w-0">
                        <div className="space-y-1.5">
                          <label htmlFor={`name-${c.key}`} className="block text-xs font-medium text-ink-dim">
                            Name
                          </label>
                          <input
                            id={`name-${c.key}`}
                            value={c.name}
                            maxLength={60}
                            placeholder="Product name"
                            onChange={(e) => patch(c.key, { name: e.target.value })}
                            className={FIELD}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor={`tagline-${c.key}`} className="block text-xs font-medium text-ink-dim">
                            Tagline
                          </label>
                          <input
                            id={`tagline-${c.key}`}
                            value={c.tagline}
                            maxLength={140}
                            placeholder="What it does, in one line"
                            onChange={(e) => patch(c.key, { tagline: e.target.value })}
                            className={FIELD}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setCustoms((prev) => [...prev, newEntry()])}
                  disabled={!canAddMore}
                  className="w-full h-11 rounded-xl border border-dashed border-hairline text-sm font-medium text-ink-dim hover:border-signal hover:text-signal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {customs.length === 0 ? "Add a product that isn't listed here" : "Add another product"}
                </button>
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
                <p className="text-xs text-ink-faint">
                  Booked in {RAIL_DAYS_PER_BLOCK}-day blocks, up to {RAIL_MAX_BLOCKS * RAIL_DAYS_PER_BLOCK} days. Every product runs for the same days.
                </p>
              </fieldset>
            </>
          )}
        </section>

        {/* Summary: the price set big, how it adds up, and the slots as they will look. */}
        <aside className="lg:pt-2 space-y-5" aria-label="Your booking">
          <div className="space-y-1">
            <p className="font-mono text-[56px] leading-none font-semibold text-ink tabular-nums">{money(count > 0 ? quote.amountCents : 0)}</p>
            <p className="text-sm text-ink-dim tabular-nums">
              {count === 0 ? "Pick a product to see the price" : `${count} ${count === 1 ? "product" : "products"} × ${quote.days} days`}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-y-2 text-sm border-t border-hairline pt-4">
            <dt className="text-ink-dim">Price</dt>
            <dd className="text-right font-medium text-ink">$1 per product, per 3 days</dd>
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
              : `There's room for ${RAIL_VISIBLE_SLOTS} at once, so yours stay in view. With more sponsors, the slots rotate every ${RAIL_ROTATE_MS / 1000} seconds.`}
          </p>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-ink-faint">Preview</p>
              <ul className="rounded-xl border border-hairline bg-card divide-y divide-hairline overflow-hidden">
                {preview.map((p) => (
                  <li key={p.key} className="flex items-center gap-2.5 h-12 px-3">
                    <Logo src={p.logo} name={p.name} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink truncate">{p.name}</span>
                      <span className="block text-xs text-ink-faint truncate">{p.tagline || p.host}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signedIn && (
            <button
              type="button"
              onClick={checkout}
              disabled={!canPay || busy}
              className="tlf-launch w-full h-12 rounded-full text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? "Opening checkout…" : count > 0 ? `Pay ${money(quote.amountCents)} and reserve` : "Pick a product"}
            </button>
          )}
          {incomplete > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {incomplete === 1 ? "One product needs" : `${incomplete} products need`} a URL and a name before you can pay.
            </p>
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
