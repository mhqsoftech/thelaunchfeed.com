import Link from "next/link";

type Variant = "founder" | "product" | "category" | "generic";

const CONTENT: Record<Variant, { eyebrow: string; heading: string; body: string; ctaLabel: string; ctaHref: string }> = {
  founder: {
    eyebrow: "Ship your own",
    heading: "Building something too?",
    body: "Get your product in front of the same maker audience — daily leaderboard, verified revenue, permanent backlink.",
    ctaLabel: "Submit your launch",
    ctaHref: "/submit",
  },
  product: {
    eyebrow: "Your turn",
    heading: "Launch your product on The Launch Feed",
    body: "Daily 6:00 AM IST drop, community upvotes, verified MRR, and a permanent 360° product page — free to start.",
    ctaLabel: "Submit your launch",
    ctaHref: "/submit",
  },
  category: {
    eyebrow: "Get discovered",
    heading: "Building in this space?",
    body: "List your product in this category and get real signal from an audience of engineers, founders, and buyers.",
    ctaLabel: "Submit your launch",
    ctaHref: "/submit",
  },
  generic: {
    eyebrow: "Ship. Vote. Rise.",
    heading: "Launch your product",
    body: "Daily leaderboard for indie makers, SaaS founders, and dev tools.",
    ctaLabel: "Submit your launch",
    ctaHref: "/submit",
  },
};

export default function PrimaryCTA({
  variant = "generic",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const c = CONTENT[variant];
  return (
    <section
      aria-labelledby="primary-cta-heading"
      className={`border border-signal/40 bg-signal/5 p-5 sm:p-6 space-y-3 font-mono ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
        <span className="text-[10px] uppercase tracking-widest text-signal font-bold">
          {c.eyebrow}
        </span>
      </div>
      <h2
        id="primary-cta-heading"
        className="text-lg sm:text-xl font-bold text-ink uppercase tracking-wide leading-tight"
      >
        {c.heading}
      </h2>
      <p className="text-xs sm:text-sm text-ink-dim font-sans leading-relaxed max-w-2xl">
        {c.body}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href={c.ctaHref}
          className="inline-flex items-center gap-2 px-4 py-2 bg-signal text-void text-xs font-bold uppercase tracking-wider hover:bg-signal/90 transition-colors"
        >
          {c.ctaLabel}
          <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/about"
          className="inline-flex items-center gap-2 px-4 py-2 border border-hairline text-ink text-xs font-bold uppercase tracking-wider hover:border-signal/60 hover:text-signal transition-colors"
        >
          How it works
        </Link>
      </div>
    </section>
  );
}
