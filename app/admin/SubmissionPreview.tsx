"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getNeonStorageUrl } from "@/lib/storage-url";
import type { listSubmissions } from "@/app/actions/submissions";

/**
 * Full read-only preview of a submission for the admin review queue: every
 * field the maker entered on /submit, laid out roughly like the public
 * product page, plus the approve / reject actions so the decision can be
 * made without leaving the drawer.
 */

export type AdminSubmission = Awaited<ReturnType<typeof listSubmissions>>[number];

type Details = Record<string, unknown>;

/* ─────────── safe accessors (details is untyped JSON from the client) ─────────── */

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function objList<T extends Record<string, unknown>>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : [];
}

/** Only http(s) links are clickable; anything else (javascript:, data:) is shown as text. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(u)) return `https://${u}`;
  return null;
}

/** Stored images are either full URLs or keys in the storage bucket. */
export function imageSrc(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^(https?:|data:image\/)/i.test(v) || v.startsWith("/")) return v;
  return getNeonStorageUrl(v);
}

export function launchTierInfo(details: Details | null): { label: string; tone: "paid" | "free" | "pending" } {
  const d = details || {};
  if (d.isPaidPlacement) return { label: "Paid launch", tone: "paid" };
  const tier = Number(d.launchTier);
  if (tier === 5 || tier === 10) return { label: `$${tier} tier · awaiting payment`, tone: "pending" };
  const stamp = d.freeLaunch as { qualified?: boolean } | undefined;
  return { label: stamp?.qualified ? "Free · requirements met" : "Free launch", tone: "free" };
}

/* ─────────── small building blocks ─────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline pt-5">
      <h3 className="font-mono text-[11px] uppercase tracking-wider font-bold text-ink-dim mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Prose({ text }: { text: string }) {
  return <p className="font-sans text-sm leading-relaxed text-ink whitespace-pre-wrap break-words">{text}</p>;
}

function Field({ label, value, href }: { label: string; value: string; href?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint font-bold">{label}</dt>
      <dd className="font-sans text-sm text-ink mt-0.5 break-words">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-signal hover:underline underline-offset-2">
            {value} ↗
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/* ─────────── drawer ─────────── */

export default function SubmissionPreview({
  sub,
  onClose,
  onPublish,
  onReject,
  busy,
}: {
  sub: AdminSubmission;
  onClose: () => void;
  onPublish?: () => void;
  onReject?: (reason: string) => void;
  busy?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [activeShot, setActiveShot] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const d: Details = (sub.details as Details | null) ?? {};
  const shots = sub.screenshots.map(imageSrc).filter((s): s is string => !!s);
  const logo = imageSrc(sub.logoUrl);
  const tags = sub.tags.length ? sub.tags : strList(d.tags);
  const description = str(sub.description) || str(d.overviewPitch);
  const features = strList(d.features);
  const pricingTiers = objList<{ name?: unknown; price?: unknown; specs?: unknown }>(d.pricingTiers).filter(
    (t) => str(t.name) || str(t.price) || str(t.specs)
  );
  const faqs = objList<{ q?: unknown; a?: unknown }>(d.faqs).filter((f) => str(f.q) || str(f.a));
  const videoUrl = sub.videoUrl || str(d.videoUrl);
  const tier = launchTierInfo(d);
  const website = safeHref(sub.websiteUrl);
  const isScheduled = sub.status === "SCHEDULED";

  const planFields: [string, string][] = [
    ["Free plan", str(d.freePlan)],
    ["Pro plan", str(d.proPlan)],
    ["Enterprise plan", str(d.enterprisePlan)],
    ["Billing / payments", str(d.pricingPartner)],
    ["Revenue (self-reported)", str(d.revenue)],
  ];
  const techFields: [string, string, string | null][] = [
    ["Tech stack", str(d.techStack), null],
    ["Hosting / infra", str(d.infraHosting), null],
    ["Security", str(d.securityStandards), null],
    ["API", str(d.apiUrl), safeHref(str(d.apiUrl))],
    ["GitHub", str(d.githubUrl), safeHref(str(d.githubUrl))],
    ["Support email", str(d.supportEmail), null],
  ];
  const storyFields: [string, string][] = [
    ["Target audience", str(d.targetAudience)],
    ["Origin story", str(d.originStory)],
    ["Maker thesis", str(d.makerThesis)],
  ];
  const roadmapFields: [string, string][] = [
    ["Latest version", str(d.latestVersion)],
    ["Changelog", str(d.latestChangelog)],
    ["Roadmap · Q3", str(d.roadmapQ3)],
    ["Roadmap · Q4", str(d.roadmapQ4)],
  ];
  const has = (rows: [string, string, ...unknown[]][]) => rows.some((r) => r[1]);

  const tierClass =
    tier.tone === "paid"
      ? "border-verified/40 text-verified bg-verified/10"
      : tier.tone === "pending"
        ? "border-signal/40 text-signal bg-signal-dim"
        : "border-hairline text-ink-dim bg-surface";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-label={`Preview ${sub.name}`}>
      <button type="button" aria-label="Close preview" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] cursor-default" />

      <div className="relative h-full w-full max-w-[760px] bg-void border-l border-hairline shadow-lift flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-6 h-14 border-b border-hairline bg-void">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-ink-dim">Submission preview</span>
            <span className={`font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 border rounded-sm ${tierClass}`}>{tier.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center border border-hairline rounded-md text-ink-dim hover:text-ink hover:bg-raised transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-6">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 shrink-0 rounded-xl border border-hairline bg-surface overflow-hidden flex items-center justify-center font-mono font-bold text-lg text-ink-dim">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                sub.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-2xl font-bold tracking-tight text-ink break-words">{sub.name}</h2>
              <p className="font-sans text-base text-ink-dim mt-1 break-words">{sub.tagline || "No tagline"}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {sub.category?.name && (
                  <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-signal-dim text-signal">{sub.category.name}</span>
                )}
                {tags.map((t) => (
                  <span key={t} className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm border border-hairline text-ink-dim">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Key facts */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 border border-hairline rounded-lg bg-card p-4">
            <Field label="Website" value={sub.websiteUrl} href={website} />
            <Field label="Demo video" value={videoUrl} href={safeHref(videoUrl)} />
            <Field
              label="Maker"
              value={`${sub.makerName} · ${sub.makerHandle}${sub.owner?.emailVerified ? " · verified email" : ""}`}
              href={sub.owner?.username ? `/founder/${encodeURIComponent(sub.owner.username)}` : null}
            />
            <Field label="Contact" value={sub.makerEmail} />
            <Field label="Submitted" value={new Date(sub.createdAt).toLocaleString()} />
            <Field label={isScheduled ? "Scheduled for" : "Status"} value={isScheduled ? new Date(sub.scheduledFor).toLocaleString() : sub.status} />
          </dl>
          {!website && sub.websiteUrl && (
            <p className="-mt-3 font-mono text-[11px] text-signal font-bold">⚠ Website URL is not an http(s) link. Check it before approving.</p>
          )}

          {/* Screenshots */}
          {shots.length > 0 && (
            <div className="space-y-2">
              <div className="aspect-video w-full rounded-lg border border-hairline bg-surface overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shots[Math.min(activeShot, shots.length - 1)]} alt={`${sub.name} screenshot`} className="w-full h-full object-contain" />
              </div>
              {shots.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {shots.map((s, i) => (
                    <button
                      key={s + i}
                      type="button"
                      onClick={() => setActiveShot(i)}
                      className={`w-24 aspect-video shrink-0 rounded-md overflow-hidden border-2 cursor-pointer transition-colors ${
                        i === activeShot ? "border-signal" : "border-hairline hover:border-ink-faint"
                      }`}
                      aria-label={`Show screenshot ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {shots.length === 0 && (
            <p className="font-mono text-xs text-ink-faint border border-dashed border-hairline rounded-lg p-4 text-center">No screenshots uploaded.</p>
          )}

          <Section title="Description">
            {description ? <Prose text={description} /> : <p className="font-sans text-sm text-ink-faint">No description provided.</p>}
          </Section>

          {features.length > 0 && (
            <Section title={`Features (${features.length})`}>
              <ul className="space-y-1.5">
                {features.map((f, i) => (
                  <li key={i} className="font-sans text-sm text-ink flex gap-2">
                    <span className="text-signal font-bold">→</span>
                    <span className="break-words">{f}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(pricingTiers.length > 0 || has(planFields)) && (
            <Section title="Pricing">
              {pricingTiers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  {pricingTiers.map((t, i) => (
                    <div key={i} className="border border-hairline rounded-lg bg-card p-3">
                      <div className="font-mono text-[11px] uppercase font-bold text-ink-dim">{str(t.name) || "Tier"}</div>
                      <div className="font-sans text-lg font-bold text-ink mt-0.5">{str(t.price) || "—"}</div>
                      {str(t.specs) && <p className="font-sans text-xs text-ink-dim mt-1 whitespace-pre-wrap break-words">{str(t.specs)}</p>}
                    </div>
                  ))}
                </div>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {planFields.map(([l, v]) => (
                  <Field key={l} label={l} value={v} />
                ))}
              </dl>
            </Section>
          )}

          {has(storyFields) && (
            <Section title="Story & audience">
              <div className="space-y-3">
                {storyFields
                  .filter(([, v]) => v)
                  .map(([l, v]) => (
                    <div key={l}>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint font-bold mb-0.5">{l}</div>
                      <Prose text={v} />
                    </div>
                  ))}
              </div>
            </Section>
          )}

          {has(techFields) && (
            <Section title="Technical">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {techFields.map(([l, v, h]) => (
                  <Field key={l} label={l} value={v} href={h} />
                ))}
              </dl>
            </Section>
          )}

          {has(roadmapFields) && (
            <Section title="Versions & roadmap">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {roadmapFields.map(([l, v]) => (
                  <Field key={l} label={l} value={v} />
                ))}
              </dl>
            </Section>
          )}

          {faqs.length > 0 && (
            <Section title={`FAQ (${faqs.length})`}>
              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <div key={i}>
                    <div className="font-sans text-sm font-semibold text-ink">{str(f.q) || "(no question)"}</div>
                    <p className="font-sans text-sm text-ink-dim mt-0.5 whitespace-pre-wrap break-words">{str(f.a)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {sub.status === "REJECTED" && sub.rejectionReason && (
            <Section title="Rejection reason">
              <Prose text={sub.rejectionReason} />
            </Section>
          )}
        </div>

        {/* Decision bar */}
        {isScheduled && (onPublish || onReject) && (
          <div className="shrink-0 border-t border-hairline bg-surface px-5 sm:px-6 py-3.5">
            {rejecting ? (
              <div className="space-y-2">
                <label className="block font-mono text-[11px] uppercase font-bold text-ink-dim">
                  Reason for rejection · emailed to {sub.makerEmail}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Be specific. The founder receives this text as written."
                  className="w-full px-3 py-2 font-sans text-sm bg-void border border-hairline rounded-md focus:outline-none focus:border-ink"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(false);
                      setReason("");
                    }}
                    className="h-9 px-4 font-mono text-xs uppercase font-bold border border-hairline rounded-md hover:bg-raised cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!reason.trim() || busy}
                    onClick={() => onReject?.(reason.trim())}
                    className="h-9 px-4 font-mono text-xs uppercase font-bold rounded-md bg-signal text-white disabled:opacity-40 cursor-pointer"
                  >
                    Reject & email maker
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-ink-dim">
                  Goes live automatically {new Date(sub.scheduledFor).toLocaleString()} unless rejected.
                </span>
                <div className="flex gap-2">
                  {onReject && (
                    <button
                      type="button"
                      onClick={() => setRejecting(true)}
                      className="h-9 px-4 font-mono text-xs uppercase font-bold border border-hairline rounded-md hover:border-signal hover:text-signal cursor-pointer transition-colors"
                    >
                      Reject…
                    </button>
                  )}
                  {onPublish && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onPublish}
                      className="h-9 px-4 font-mono text-xs uppercase font-bold rounded-md bg-ink text-void hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      Approve & publish now
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
