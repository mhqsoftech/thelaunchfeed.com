"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LaunchFeedBrandLogo } from "@/components/ui/LaunchFeedLogo";
import { sendContactMessage } from "@/app/actions/contact";

interface ContactTopic {
  id: string;
  label: string;
  badge?: string;
  hint?: string;
}

const CONTACT_TOPICS: ContactTopic[] = [
  {
    id: "general",
    label: "General Support & Inquiry",
    badge: "SUPPORT",
    hint: "General questions, account issues, or platform help",
  },
  {
    id: "product",
    label: "Product Launch / Review Question",
    badge: "LAUNCH",
    hint: "Submission updates, launch queue status, or review edits",
  },
  {
    id: "sponsor",
    label: "Featured Placement & Sponsorship",
    badge: "SPONSOR",
    hint: "Homepage spotlights, sticky slots, or newsletter ads",
  },
  {
    id: "security",
    label: "Security & Vulnerability Disclosure",
    badge: "SECURITY",
    hint: "Responsible security disclosure and vulnerability reports",
  },
  {
    id: "feedback",
    label: "Feedback & Feature Suggestions",
    badge: "FEEDBACK",
    hint: "Feature requests, leaderboard ideas, or user feedback",
  },
];

function BrutalistTopicSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = CONTACT_TOPICS.find((t) => t.id === value) || CONTACT_TOPICS[0];

  return (
    <div className="relative font-mono text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 border border-hairline bg-surface text-xs font-mono text-ink text-left flex items-center justify-between hover:border-ink focus:border-signal transition-colors cursor-pointer outline-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
          <span className="font-bold tracking-wider uppercase truncate">
            {selected.label}
          </span>
          {selected.badge && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 border border-hairline bg-void text-[10px] text-ink-dim font-bold tracking-wider">
              {selected.badge}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-ink-dim transition-transform shrink-0 ml-2 ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-hairline bg-surface max-h-72 overflow-y-auto no-scrollbar divide-y divide-hairline/50 shadow-2xl">
            {CONTACT_TOPICS.map((item) => {
              const isCurrent = item.id === selected.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left text-xs font-mono transition-colors cursor-pointer flex items-center justify-between ${
                    isCurrent
                      ? "bg-ink text-void font-bold"
                      : "text-ink hover:bg-raised"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? "bg-void" : "bg-signal"}`} />
                      <span className="font-bold uppercase truncate">{item.label}</span>
                    </div>
                    {item.hint && (
                      <span
                        className={`text-[10px] normal-case pl-3.5 pt-0.5 truncate ${
                          isCurrent ? "text-void/70" : "text-ink-dim"
                        }`}
                      >
                        {item.hint}
                      </span>
                    )}
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] uppercase font-bold shrink-0">[SELECTED]</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ContactClientView() {
  const [topic, setTopic] = useState("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [dispatchedDetails, setDispatchedDetails] = useState<{
    name: string;
    email: string;
    topicLabel: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const topicLabel =
      CONTACT_TOPICS.find((t) => t.id === topic)?.label || "General Inquiry";

    try {
      const res = await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
      });

      if (res.success) {
        setDispatchedDetails({
          name: name.trim(),
          email: email.trim(),
          topicLabel,
        });
        setSubmitted(true);
        setMessage("");
      } else {
        setErrorMessage(res.error || "Failed to dispatch message. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "An unexpected error occurred while sending your message."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyEmail = (mail: string) => {
    navigator.clipboard.writeText(mail);
    setCopiedEmail(mail);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto py-5 sm:py-10 px-3.5 sm:px-6 space-y-6 sm:space-y-8 font-mono text-ink">
      <h1 className="sr-only">Contact The Launch Feed</h1>
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-hairline pb-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono text-ink-dim">
          <Link
            href="/"
            className="hover:text-ink transition-colors flex items-center gap-1"
          >
            <span>Home</span>
          </Link>
          <span className="text-ink-faint">/</span>
          <span className="text-ink font-semibold">Contact</span>
        </nav>

        <div className="text-xs text-ink-dim flex items-center gap-2 flex-wrap">
          <Link href="/about" className="hover:text-ink transition-colors">About</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="/contact" className="text-signal font-bold">Contact</Link>
        </div>
      </div>

      {/* Header */}
      <div className="border border-hairline p-4 sm:p-7 bg-surface/30 space-y-3 rounded-xs">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <LaunchFeedBrandLogo height={28} />
          </Link>
        </div>
        <p className="text-xs sm:text-sm text-ink-dim font-sans leading-relaxed max-w-2xl">
          Have a question about your product launch, featured placements, or need developer assistance? Send us a direct message below or reach out via our official communication channels.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left 2 Cols: Interactive Contact Form */}
        <div className="lg:col-span-2 border border-hairline p-4 sm:p-6 bg-void space-y-5 sm:space-y-6 rounded-xs">
          <div className="border-b border-hairline pb-3">
            <h2 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-signal" />
              <span>Send a Message</span>
            </h2>
          </div>

          {submitted && dispatchedDetails ? (
            <div className="p-6 border border-signal/40 bg-signal/10 space-y-4 font-mono">
              <div className="flex items-center gap-2 text-signal font-bold text-sm">
                <span className="px-1.5 py-0.5 border border-signal/40 bg-void text-xs">SENT</span>
                <span>Inquiry Dispatched Successfully!</span>
              </div>

              <p className="text-xs text-ink-dim font-sans leading-relaxed">
                Thank you for reaching out{dispatchedDetails.name ? `, ${dispatchedDetails.name}` : ""}. Your message regarding{" "}
                <strong className="text-ink">{dispatchedDetails.topicLabel}</strong> has been received by our direct desk. We will review your inquiry and reply to <strong className="text-ink">{dispatchedDetails.email}</strong> within 24 hours.
              </p>

              <div className="border border-hairline bg-surface/50 p-3 space-y-1.5 text-xs text-ink-dim">
                <div className="flex justify-between">
                  <span className="text-[10px] uppercase font-bold text-ink-faint">Topic:</span>
                  <span className="text-ink font-bold">{dispatchedDetails.topicLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] uppercase font-bold text-ink-faint">Destination:</span>
                  <span className="text-ink font-mono font-bold">hi@thelaunchfeed.com</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] uppercase font-bold text-ink-faint">Recipient:</span>
                  <span className="text-ink font-mono">{dispatchedDetails.email}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setSubmitted(false);
                  setDispatchedDetails(null);
                  setMessage("");
                  setErrorMessage(null);
                }}
                className="mt-2 px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs text-ink font-bold transition-colors cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 border border-red-500/40 bg-red-500/10 text-xs text-red-400 font-mono space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚠</span>
                    <span>Dispatch Failed</span>
                  </div>
                  <div>{errorMessage}</div>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase font-bold text-ink-dim mb-1.5">
                  Select Topic *
                </label>
                <BrutalistTopicSelect value={topic} onChange={(v) => setTopic(v)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs uppercase font-bold text-ink-dim mb-1.5">
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-hairline bg-surface text-ink text-xs font-mono focus:border-signal outline-none placeholder:text-ink-faint disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs uppercase font-bold text-ink-dim mb-1.5">
                    Email Address *
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    placeholder="e.g. alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-hairline bg-surface text-ink text-xs font-mono focus:border-signal outline-none placeholder:text-ink-faint disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs uppercase font-bold text-ink-dim mb-1.5">
                  Message / Details *
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Describe your inquiry, product launch question, or feedback in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-hairline bg-surface text-ink text-xs font-mono focus:border-signal outline-none placeholder:text-ink-faint resize-y disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-ink-faint">
                  Typical response time: &lt; 24 hours
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 bg-signal text-void text-xs font-bold font-mono transition-colors flex items-center gap-2 ${
                    isSubmitting
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:bg-signal/90 cursor-pointer"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-void border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>DISPATCHING...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <span>Dispatch Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right 1 Col: Direct Channels & Emails */}
        <div className="space-y-4">
          <div className="border border-hairline p-5 bg-surface/30 space-y-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-hairline pb-2">
              Official Email
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 border border-hairline bg-surface space-y-2">
                <div className="text-[10px] uppercase font-bold text-ink-faint">Direct Inbox</div>
                <div className="flex items-center justify-between">
                  <a
                    href="mailto:hi@thelaunchfeed.com"
                    className="text-xs font-bold text-ink hover:text-signal transition-colors break-all"
                  >
                    hi@thelaunchfeed.com
                  </a>
                  <button
                    onClick={() => handleCopyEmail("hi@thelaunchfeed.com")}
                    className="text-[10px] text-signal hover:underline cursor-pointer shrink-0 ml-2"
                  >
                    {copiedEmail === "hi@thelaunchfeed.com" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] text-ink-dim font-sans leading-relaxed pt-1 border-t border-hairline/60">
                  Our single inbox for support, launch review inquiries, sponsorship proposals, press, and privacy requests.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-hairline p-5 bg-surface/30 space-y-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-hairline pb-2">
              Official Social Channels
            </h3>
            <div className="space-y-2 text-xs">
              <a
                href="https://bsky.app/profile/thelaunchfeed.bsky.social"
                target="_blank"
                rel="noreferrer"
                className="p-2 border border-hairline bg-surface hover:bg-raised flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 600 530" aria-hidden="true">
                    <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.26-54.316 97.782-155.54 164.28-205.463C512.26 8.024 590 -19.44 590 69.24c0 17.7-10.15 148.79-16.11 170.07-20.68 73.94-96.14 92.86-163.23 81.42 117.3 19.95 147.16 86.06 82.72 152.16-122.34 125.55-175.83-31.51-189.53-71.76-2.51-7.38-3.68-10.83-3.85-7.88-.17-2.95-1.34.5-3.85 7.88-13.7 40.26-67.19 197.31-189.53 71.76-64.44-66.1-34.58-132.21 82.72-152.16-67.09 11.44-142.55-7.48-163.22-81.42C20.15 217.99 10 86.9 10 69.24c0-88.68 77.74-61.216 125.72-25.21z" />
                  </svg>
                  <span>Follow @thelaunchfeed.bsky.social on Bluesky</span>
                </div>
                <span className="text-[10px] text-ink-faint">→</span>
              </a>

              <a
                href="https://t.me/thelaunchfeed"
                target="_blank"
                rel="noreferrer"
                className="p-2 border border-hairline bg-surface hover:bg-raised flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                  <span>Telegram Daily Drops</span>
                </div>
                <span className="text-[10px] text-ink-faint">→</span>
              </a>

              <a
                href="https://chat.whatsapp.com/HxTenCRhtHa9PIviuQNl9U"
                target="_blank"
                rel="noreferrer"
                className="p-2 border border-hairline bg-surface hover:bg-raised flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.79 14.07c-.24.68-1.2 1.26-1.66 1.32-.44.06-1.01.09-3.26-.84-2.73-1.13-4.48-3.9-4.62-4.08-.13-.19-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.24-.27.54-.34.72-.34.18 0 .36 0 .52.01.17.01.4.06.62.53.24.51.81 1.98.88 2.12.07.15.12.32.02.51-.09.19-.14.3-.29.47-.15.17-.31.38-.45.51-.15.15-.3.31-.13.61.17.3 1.05 1.74 2.26 2.82 1.55 1.38 2.86 1.81 3.27 2.01.41.2.65.17.89-.1.24-.27 1.03-1.2 1.3-1.61.27-.41.54-.34.91-.2.37.14 2.37 1.12 2.78 1.32.41.2.68.3.78.47.1.18.1.99-.14 1.67z" />
                  </svg>
                  <span>WhatsApp Community</span>
                </div>
                <span className="text-[10px] text-ink-faint">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Actions */}
      <div className="border-t border-hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-hairline bg-surface hover:bg-raised text-xs font-mono font-bold text-ink transition-colors cursor-pointer group rounded-xs w-full sm:w-auto justify-center"
        >
          <span className="text-signal group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to Leaderboard</span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-ink-dim flex-wrap justify-center">
          <Link href="/about" className="hover:text-signal transition-colors">About</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-signal transition-colors">Terms</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-signal transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="/badges" className="hover:text-signal transition-colors">Badges</Link>
        </div>
      </div>
    </div>
  );
}
