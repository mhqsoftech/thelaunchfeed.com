import Link from "next/link";
import type { ReactNode } from "react";
import { withLaunchTime } from "@/components/ui/withLaunchTime";
import type { Faq } from "@/lib/seo/facts";

/** Shared building blocks for the content landing pages (server-rendered). */

export function Crumbs({ trail }: { trail: Array<{ name: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-ink-dim">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((t, i) => (
          <li key={t.name} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-faint" aria-hidden>/</span>}
            {t.href ? (
              <Link href={t.href} className="hover:text-ink transition-colors">
                {t.name}
              </Link>
            ) : (
              <span className="text-ink font-medium" aria-current="page">
                {t.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Card({ children, id, labelledBy }: { children: ReactNode; id?: string; labelledBy?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className="rounded-[calc(var(--radius-card)+4px)] border border-hairline bg-card p-6 sm:p-8"
    >
      {children}
    </section>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
      {children}
    </h2>
  );
}

export function FactGrid({ facts }: { facts: Array<{ k: string; v: ReactNode }> }) {
  return (
    <dl className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-3">
      {facts.map((f) => (
        <div key={f.k} className="rounded-xl bg-surface px-4 py-3">
          <dt className="text-xs text-ink-faint">{f.k}</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Native <details> keeps every answer in the HTML for crawlers. */
export function FaqSection({ faqs, heading = "Frequently asked questions" }: { faqs: Faq[]; heading?: string }) {
  return (
    <Card labelledBy="faq-heading">
      <H2 id="faq-heading">{heading}</H2>
      <div className="mt-4 divide-y divide-hairline">
        {faqs.map((faq, i) => (
          <details key={faq.q} className="group py-1" open={i < 2}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <h3 className="text-[15px]">{faq.q}</h3>
              <span
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-hairline text-ink-dim transition-transform group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="pb-4 pr-10 text-sm leading-relaxed text-ink-dim">
              {withLaunchTime(faq.a)}
              {faq.link && (
                <>
                  {" "}
                  <Link href={faq.link.href} className="font-medium text-signal hover:underline">
                    {faq.link.label}
                  </Link>
                </>
              )}
            </p>
          </details>
        ))}
      </div>
    </Card>
  );
}

export function LaunchCta({ secondary }: { secondary?: { href: string; label: string } }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link
        href="/submit"
        className="inline-flex items-center h-10 px-5 rounded-full bg-signal text-white text-sm font-semibold hover:brightness-110"
      >
        Launch your product free
      </Link>
      {secondary && (
        <Link
          href={secondary.href}
          className="inline-flex items-center h-10 px-5 rounded-full border border-hairline text-sm font-medium text-ink hover:bg-surface"
        >
          {secondary.label}
        </Link>
      )}
    </div>
  );
}
