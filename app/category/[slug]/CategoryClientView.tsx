"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import MainLayoutShell from "@/app/MainLayoutShell";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import PrimaryCTA from "@/components/ui/PrimaryCTA";

export type CategoryProductItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string;
  launchedAt: Date | string;
  tags: string[];
  owner: {
    username: string;
    name: string;
    image: string | null;
  };
  revenue: {
    isVerified: boolean;
    mrrCents: number;
  } | null;
};

export type CategoryMeta = {
  id: string;
  slug: string;
  name: string;
  products: CategoryProductItem[];
};

export type CategoryNavEntry = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
};

export default function CategoryClientView({
  category,
  allCategories,
}: {
  category: CategoryMeta;
  allCategories: CategoryNavEntry[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<CategoryProductItem[]>(
    category.products
  );

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredProducts(category.products);
      return;
    }
    setFilteredProducts(
      category.products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.owner.username.toLowerCase().includes(q) ||
          p.owner.name.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      )
    );
  }, [searchQuery, category.products]);

  return (
    <MainLayoutShell>
      <div className="space-y-4">
        {/* Navigation Breadcrumb & Back to Launch Feed — Aligned with Weekly/Monthly Headers */}
        <div className="sticky -top-4 z-30 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="h-10 flex items-end justify-between pb-2.5">
            <Link
              href="/"
              className="text-xs font-mono text-ink-dim hover:text-ink transition-colors flex items-center gap-1.5"
            >
              ← Back to Launch Feed
            </Link>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-faint">
              <span>Categories</span>
              <span>/</span>
              <span className="text-ink font-semibold uppercase">{category.name}</span>
            </div>
          </div>
        </div>

        {/* Horizontal Category Switcher Bar with minimal subtle backgrounds */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 pt-0.5 border-b border-hairline">
          {allCategories.map((c) => {
            const isActive = c.slug === category.slug;
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className={`px-2.5 py-1 text-xs font-mono transition-colors shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? "bg-signal/10 text-signal border border-signal/25 font-bold"
                    : "border border-hairline text-ink-dim hover:text-ink hover:bg-surface"
                }`}
              >
                <span>{c.name}</span>
                <span
                  className={`text-[10px] tabular-nums font-semibold px-1 rounded-xs ${
                    isActive
                      ? "bg-signal/15 text-signal"
                      : "bg-surface text-ink-faint"
                  }`}
                >
                  {c.productCount}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Category Header Banner */}
        <div className="h-10 flex items-end justify-between pb-2.5 border-b border-hairline shrink-0">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-black tracking-wider uppercase leading-none truncate">
              {category.name}
            </h1>
            <span className="text-ink-dim text-xs sm:text-sm font-mono tracking-widest leading-none pb-0.5 shrink-0 hidden sm:inline">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "PRODUCT" : "PRODUCTS"}
            </span>
            {category.products.length > 0 && (() => {
              const latest = category.products.reduce((acc, p) => {
                const d = new Date(p.launchedAt).getTime();
                return d > acc ? d : acc;
              }, 0);
              const iso = new Date(latest).toISOString();
              return (
                <span className="text-ink-faint text-[11px] font-mono leading-none pb-0.5 shrink-0 hidden md:inline">
                  Updated{" "}
                  <time dateTime={iso}>
                    {new Date(latest).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </time>
                </span>
              );
            })()}
          </div>

          {/* Quick Filter Search Input */}
          <div className="flex items-center gap-2">
            <input
              type="search"
              aria-label={`Filter in ${category.name}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter in ${category.name}…`}
              className="h-8 px-2.5 text-xs font-mono border border-hairline bg-void text-ink placeholder:text-ink-faint focus:outline-none focus:border-signal w-36 sm:w-48 transition-colors"
            />
          </div>
        </div>

        {/* Product Items List — Naturally structured without upvote counts */}
        <div className="divide-y divide-hairline">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((prod, i) => {
              const formattedRevenue =
                prod.revenue?.isVerified && prod.revenue.mrrCents > 0
                  ? `$${(prod.revenue.mrrCents / 100).toLocaleString()} MRR`
                  : null;

              return (
                <div
                  key={prod.id}
                  className="flex items-center gap-2.5 sm:gap-4 py-3 sm:py-4 px-2 sm:px-4 border-b border-hairline group hover:bg-surface transition-colors"
                >
                  {/* Natural Index numbering */}
                  <span className="font-display font-black w-6 sm:w-10 text-center sm:text-right shrink-0 text-base sm:text-2xl text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Product Logo with Fallback to Initials */}
                  <Link
                    href={`/product/${prod.slug}`}
                    aria-label={prod.name}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-surface border border-hairline flex-shrink-0 rounded-xs flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold text-ink-dim overflow-hidden relative"
                  >
                    {prod.logoUrl ? (
                      <img width="64" height="64"
                        src={prod.logoUrl}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      prod.name.substring(0, 2).toUpperCase()
                    )}
                  </Link>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <Link
                        href={`/product/${prod.slug}`}
                        className="font-mono text-xs sm:text-sm font-bold text-ink group-hover:text-signal transition-colors truncate"
                      >
                        {prod.name}
                      </Link>
                      <span className="text-ink-faint text-xs hidden md:inline">·</span>
                      <span className="text-ink-dim text-xs font-mono truncate hidden md:inline">
                        {prod.tagline}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-ink-dim truncate md:hidden mt-0.5">
                      {prod.tagline}
                    </div>

                    {/* Metadata strip: Maker, Launch date, Verified revenue, Tags */}
                    <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs flex-wrap">
                      <Link
                        href={`/founder/${prod.owner.username}`}
                        className="text-ink-faint hover:text-ink font-mono truncate flex items-center gap-1 transition-colors"
                      >
                        {prod.owner.image && (
                          <img width="64" height="64"
                            src={prod.owner.image}
                            alt={`${prod.owner.name || prod.owner.username} avatar`}
                            className="w-3.5 h-3.5 rounded-xs"
                          />
                        )}
                        <span>{prod.owner.name || `@${prod.owner.username}`}</span>
                      </Link>

                      <span className="text-hairline">·</span>
                      <time
                        dateTime={new Date(prod.launchedAt).toISOString()}
                        className="text-ink-faint font-mono text-[10px]"
                      >
                        {format(new Date(prod.launchedAt), "MMM d, yyyy")}
                      </time>

                      {formattedRevenue && (
                        <>
                          <span className="text-hairline">·</span>
                          <span className="text-verified font-bold uppercase tracking-wider text-[9px] sm:text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse" />
                            {formattedRevenue}
                          </span>
                        </>
                      )}

                      {prod.tags && prod.tags.length > 0 && (
                        <>
                          <span className="text-hairline hidden sm:inline">·</span>
                          <span className="text-ink-faint text-[9px] sm:text-[10px] uppercase font-mono tracking-wider hidden sm:inline">
                            {prod.tags.slice(0, 2).join(" · ")}
                          </span>
                        </>
                      )}

                      <BookmarkButton productId={prod.id} />
                    </div>
                  </div>

                  {/* Visit Product Action Button */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      href={`/product/${prod.slug}`}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-mono font-medium transition-colors flex items-center gap-1.5"
                    >
                      <span>View</span>
                      <span className="text-ink-faint">→</span>
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center border-b border-hairline">
              <div className="text-ink-dim font-mono text-sm mb-2">
                {searchQuery
                  ? `No products found matching "${searchQuery}" in ${category.name}`
                  : `No products launched in ${category.name} yet.`}
              </div>
              <Link
                href="/submit"
                className="inline-block mt-3 px-4 py-1.5 text-xs font-mono border border-signal/30 bg-signal/10 text-signal hover:bg-signal/20 transition-colors uppercase font-bold"
              >
                + Launch the first product in {category.name}
              </Link>
            </div>
          )}
        </div>
        <PrimaryCTA variant="category" className="mt-6" />
      </div>
    </MainLayoutShell>
  );
}
