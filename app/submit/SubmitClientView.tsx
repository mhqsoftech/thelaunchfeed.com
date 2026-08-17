"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayoutShell from "../MainLayoutShell";
import { slugify, getStoredSession, saveSession } from "../data";
import {
  createSubmission,
  getEditablePayload,
  updateMySubmission,
  updateMyProduct,
  type EditablePayload,
} from "@/app/actions/submissions";
import { useSearchParams } from "next/navigation";
import { listCategories } from "@/app/actions/categories";
import { savePaymentApiKey } from "@/app/actions/revenue";
import SubmissionTimer from "../components/SubmissionTimer";
import { LaunchFeedLogo } from "@/components/ui/LaunchFeedLogo";
import { formatReleaseUtcWithIst } from "@/lib/schedule";

type QueuedSubmission = {
  id: string;
  scheduledFor: string;
  launchTier?: 0 | 5 | 10;
  productName?: string;
  isPaid?: boolean;
};
import { convertImageFileToAvifDataUrl } from "../lib/avifConverter";
import {
  REVENUE_PROVIDERS,
  fetchLiveRevenueFromSDK,
  PaymentProviderLogo,
} from "../lib/revenueTelemetrySDK";

function PixelatedShipmentBox({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
    >
      <rect x="1" y="2" width="14" height="12" fill="currentColor" fillOpacity="0.2" />
      <rect x="1" y="2" width="14" height="1" fill="currentColor" />
      <rect x="1" y="13" width="14" height="1" fill="currentColor" />
      <rect x="1" y="2" width="1" height="12" fill="currentColor" />
      <rect x="14" y="2" width="1" height="12" fill="currentColor" />
      <rect x="8" y="2" width="1" height="12" fill="currentColor" />
      <rect x="1" y="7" width="14" height="1" fill="currentColor" />
      <rect x="3" y="4" width="3" height="2" fill="currentColor" />
    </svg>
  );
}

function BrutalistCategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = React.useState<readonly string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await listCategories();
        if (!cancelled) setCategories(rows.map((r) => r.name));
      } catch {
        // fall back to the static list if the DB is unreachable during dev
      }
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, []);

  return (
    <div className="relative font-mono text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink text-left flex items-center justify-between hover:border-ink transition-colors cursor-pointer"
      >
        <span className="font-bold tracking-wider uppercase">
          {value || "Select Category"}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-ink-dim transition-transform ${
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
          <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-hairline bg-surface max-h-60 overflow-y-auto no-scrollbar divide-y divide-hairline/50">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-mono transition-colors cursor-pointer uppercase flex items-center justify-between ${
                  value === cat
                    ? "bg-ink text-void font-bold"
                    : "text-ink hover:bg-raised"
                }`}
              >
                <span>{cat}</span>
                {value === cat && (
                  <span className="text-[10px] uppercase font-bold">[SELECTED]</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BrutalistProviderSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedProv =
    REVENUE_PROVIDERS.find(
      (p) => p.id === value || p.name === value || p.id === value?.toLowerCase()
    ) || REVENUE_PROVIDERS[0];

  return (
    <div className="relative font-mono text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink text-left flex items-center justify-between hover:border-ink transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <PaymentProviderLogo id={selectedProv.id} className="w-4 h-4 shrink-0" />
          <span className="font-bold tracking-wider uppercase truncate">
            {selectedProv.name} ({selectedProv.sdkName})
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-ink-dim transition-transform shrink-0 ${
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
          <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-hairline bg-surface max-h-64 overflow-y-auto no-scrollbar divide-y divide-hairline/50">
            {REVENUE_PROVIDERS.map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => {
                  onChange(prov.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left text-xs font-mono transition-colors cursor-pointer uppercase flex items-center justify-between ${
                  selectedProv.id === prov.id
                    ? "bg-ink text-void font-bold"
                    : "text-ink hover:bg-raised"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PaymentProviderLogo id={prov.id} className="w-4 h-4 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-bold">{prov.name}</span>
                    <span className="text-[10px] opacity-70 font-mono normal-case">
                      {prov.sdkName}
                    </span>
                  </div>
                </div>
                {selectedProv.id === prov.id && (
                  <span className="text-[10px] uppercase font-bold shrink-0">[SELECTED]</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export interface ProductProfileData {
  name: string;
  tagline: string;
  category: string;
  makerName: string;
  makerHandle: string;
  websiteUrl: string;
  videoUrl: string;
  githubUrl: string;
  revenue: string;
  overviewPitch: string;
  feature1: string;
  feature2: string;
  feature3: string;
  targetAudience: string;
  freePlan: string;
  proPlan: string;
  enterprisePlan: string;
  techStack: string;
  infraHosting: string;
  apiUrl: string;
  securityStandards: string;
  originStory: string;
  makerThesis: string;
  latestVersion: string;
  latestChangelog: string;
  roadmapQ3: string;
  roadmapQ4: string;
  pricingPartner: string;
  apiKey: string;
  revenueVerified: boolean;
  faq1Q: string;
  faq1A: string;
  faq2Q: string;
  faq2A: string;
  supportEmail: string;
}

const EMPTY_PROFILE: ProductProfileData = {
  name: "",
  tagline: "",
  category: "",
  makerName: "",
  makerHandle: "",
  websiteUrl: "",
  videoUrl: "",
  githubUrl: "",
  revenue: "",
  overviewPitch: "",
  feature1: "",
  feature2: "",
  feature3: "",
  targetAudience: "",
  freePlan: "",
  proPlan: "",
  enterprisePlan: "",
  techStack: "",
  infraHosting: "",
  apiUrl: "",
  securityStandards: "",
  originStory: "",
  makerThesis: "",
  latestVersion: "",
  latestChangelog: "",
  roadmapQ3: "",
  roadmapQ4: "",
  pricingPartner: "",
  apiKey: "",
  revenueVerified: false,
  faq1Q: "",
  faq1A: "",
  faq2Q: "",
  faq2A: "",
  supportEmail: "",
};

export default function SubmitClientView({
  initialProductData,
  onSaveProduct,
  isEmbeddedMode = false,
}: {
  initialProductData?: any;
  onSaveProduct?: (updatedProduct: any) => void;
  isEmbeddedMode?: boolean;
} = {}) {
  const [autofillUrl, setAutofillUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExecutingSdk, setIsExecutingSdk] = useState(false);
  const [sdkLog, setSdkLog] = useState("");
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");
  const [submitted, setSubmitted] = useState(false);
  const [queuedSubmission, setQueuedSubmission] = useState<QueuedSubmission | null>(null);
  const [updatedProductSlug, setUpdatedProductSlug] = useState<string | null>(null);

  // 360-Degree Product Details Form State — starts empty or with initialProductData.
  const [formData, setFormData] = useState(EMPTY_PROFILE);

  // /submit?edit=<sub:id | prod:id> or ?auto_submit=1 support
  const searchParams = useSearchParams();
  const editParam = searchParams?.get("edit") || null;
  const autoSubmitParam = searchParams?.get("auto_submit") || null;
  const [editTarget, setEditTarget] = useState<EditablePayload | null>(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const autoSubmittedRef = React.useRef(false);
  const isSubmittingRef = React.useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = Boolean(onSaveProduct || editTarget || editParam);

  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([{ q: "", a: "" }]);

  const [pricingTiers, setPricingTiers] = useState<{ name: string; price: string; specs: string }[]>([
    { name: "Free", price: "", specs: "" },
    { name: "Pro", price: "", specs: "" },
    { name: "Enterprise", price: "", specs: "" },
  ]);

  const [features, setFeatures] = useState<string[]>(["", "", ""]);

  // Launch tier selection ($0 / $5 / $10) — $0 Free Launch selected by default
  const [launchTier, setLaunchTier] = useState<0 | 5 | 10>(0);

  // Ownership & Authorization Confirmation State
  const [isAuthorizedConfirmed, setIsAuthorizedConfirmed] = useState(false);

  // Product Thumbnail AVIF State
  const [thumbnailAvif, setThumbnailAvif] = useState<string>("");
  const [avifMeta, setAvifMeta] = useState<{ sizeKb: number; format: string } | null>(null);
  const [isConvertingAvif, setIsConvertingAvif] = useState(false);

  // Optional Revenue SDK Toggle State
  const [enableRevenueSdk, setEnableRevenueSdk] = useState(false);

  // Gallery Screenshots AVIF State
  const [galleryAvif, setGalleryAvif] = useState<string[]>([]);
  const [isConvertingGallery, setIsConvertingGallery] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

  // 1. Initial Load & Draft Restoration (preserved when not logged in or on refresh)
  useEffect(() => {
    if (initialProductData || editParam || isEmbeddedMode || draftLoaded) return;

    try {
      const raw = localStorage.getItem("tlf_pending_submission") || localStorage.getItem("tlf_submit_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.formData && parsed.formData.name) {
          setFormData(parsed.formData);
          if (parsed.thumbnailAvif) setThumbnailAvif(parsed.thumbnailAvif);
          if (Array.isArray(parsed.galleryAvif) && parsed.galleryAvif.length > 0) {
            setGalleryAvif(parsed.galleryAvif);
          }
          if (Array.isArray(parsed.features) && parsed.features.length > 0) {
            setFeatures(parsed.features);
          }
          if (Array.isArray(parsed.pricingTiers) && parsed.pricingTiers.length > 0) {
            setPricingTiers(parsed.pricingTiers);
          }
          if (Array.isArray(parsed.faqs) && parsed.faqs.length > 0) {
            setFaqs(parsed.faqs);
          }
          if (parsed.autofillUrl) setAutofillUrl(parsed.autofillUrl);
          if (parsed.isAuthorizedConfirmed !== undefined) {
            setIsAuthorizedConfirmed(Boolean(parsed.isAuthorizedConfirmed));
          }
          if (parsed.launchTier !== undefined) {
            setLaunchTier(parsed.launchTier);
          }
        }
      }
    } catch {}
    setDraftLoaded(true);
  }, [initialProductData, editParam, isEmbeddedMode, draftLoaded]);

  // Handle Dodo checkout return verification for paid submissions
  useEffect(() => {
    const checkoutParam = searchParams?.get("checkout");
    const subIdParam = searchParams?.get("submissionId");
    const purchaseIdParam = searchParams?.get("purchaseId");
    const paymentIdParam = searchParams?.get("payment_id");
    const tierParam = (Number(searchParams?.get("tier")) || 0) as 0 | 5 | 10;

    if (checkoutParam === "success" && subIdParam) {
      fetch("/api/checkout/dodo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: subIdParam,
          purchaseId: purchaseIdParam,
          paymentId: paymentIdParam,
          tier: tierParam || 5,
          returnTo: "submit",
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.submission) {
            setQueuedSubmission({
              id: subIdParam,
              scheduledFor: data.submission.scheduledFor,
              launchTier: tierParam || 5,
              productName: data.submission.name,
              isPaid: true,
            });
            if (data.submission.name) {
              setFormData((prev) => ({ ...prev, name: data.submission.name }));
            }
            setSubmitted(true);
            try {
              localStorage.removeItem("tlf_pending_submission");
              localStorage.removeItem("tlf_submit_draft");
            } catch {}
          }
        })
        .catch((err) => {
          console.error("[Submit] Failed to verify submission checkout:", err);
        });
    }
  }, [searchParams]);

  // 2. Continuous Auto-Save Draft to LocalStorage
  useEffect(() => {
    if (isEmbeddedMode || editParam || submitted) return;

    const hasAnyContent =
      formData.name.trim().length > 0 ||
      formData.websiteUrl.trim().length > 0 ||
      formData.tagline.trim().length > 0 ||
      formData.overviewPitch.trim().length > 0 ||
      Boolean(thumbnailAvif);

    if (hasAnyContent) {
      try {
        const draft = {
          formData,
          thumbnailAvif,
          galleryAvif,
          faqs,
          pricingTiers,
          features,
          autofillUrl,
          launchTier,
          isAuthorizedConfirmed,
        };
        localStorage.setItem("tlf_submit_draft", JSON.stringify(draft));
      } catch {}
    }
  }, [formData, thumbnailAvif, galleryAvif, faqs, pricingTiers, features, autofillUrl, launchTier, isAuthorizedConfirmed, isEmbeddedMode, editParam, submitted]);

  // 3. Post-Auth Auto-Submission Execution (?auto_submit=1)
  useEffect(() => {
    if (autoSubmitParam !== "1" || isEmbeddedMode || editParam || submitted || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;

    let cancelled = false;
    (async () => {
      setIsAutoSubmitting(true);
      try {
        // Read draft
        let draft: any = null;
        try {
          const raw = localStorage.getItem("tlf_pending_submission") || localStorage.getItem("tlf_submit_draft");
          if (raw) draft = JSON.parse(raw);
          localStorage.removeItem("tlf_pending_submission");
        } catch {}

        const activeForm = draft?.formData || formData;
        if (!activeForm || !activeForm.name) {
          setIsAutoSubmitting(false);
          return;
        }

        // Hydrate and confirm user session
        let sess = getStoredSession();
        if (!sess) {
          const meRes = await fetch("/api/me", { cache: "no-store" });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData?.session) {
              sess = meData.session;
              saveSession(meData.session);
            }
          }
        }

        if (!sess || cancelled) {
          setIsAutoSubmitting(false);
          return;
        }

        const categorySlug = (activeForm.category || "").trim() || undefined;

        const activeFeatures = draft?.features || features;
        const activeTiers = draft?.pricingTiers || pricingTiers;
        const activeFaqs = draft?.faqs || faqs;
        const activeThumbnail = draft?.thumbnailAvif || thumbnailAvif;
        const activeGallery = draft?.galleryAvif || galleryAvif;

        const details = {
          overviewPitch: activeForm.overviewPitch,
          features: activeFeatures.filter((f: string) => f.trim().length > 0),
          pricingTiers: activeTiers.filter((t: any) => t.name?.trim() || t.price?.trim() || t.specs?.trim()),
          freePlan: activeForm.freePlan,
          proPlan: activeForm.proPlan,
          enterprisePlan: activeForm.enterprisePlan,
          techStack: activeForm.techStack,
          infraHosting: activeForm.infraHosting,
          apiUrl: activeForm.apiUrl,
          securityStandards: activeForm.securityStandards,
          targetAudience: activeForm.targetAudience,
          originStory: activeForm.originStory,
          makerThesis: activeForm.makerThesis,
          latestVersion: activeForm.latestVersion,
          latestChangelog: activeForm.latestChangelog,
          roadmapQ3: activeForm.roadmapQ3,
          roadmapQ4: activeForm.roadmapQ4,
          pricingPartner: activeForm.pricingPartner,
          revenue: activeForm.revenue,
          apiKey: activeForm.apiKey,
          faqs: activeFaqs.filter((f: any) => f.q?.trim() || f.a?.trim()),
          supportEmail: activeForm.supportEmail,
          githubUrl: activeForm.githubUrl,
        };

        const sub = await createSubmission({
          name: activeForm.name || "Untitled product",
          tagline: activeForm.tagline || "",
          websiteUrl: activeForm.websiteUrl || "",
          videoUrl: activeForm.videoUrl || undefined,
          description: activeForm.overviewPitch,
          categorySlug,
          makerName: activeForm.makerName || sess.name || "Unknown maker",
          makerHandle: activeForm.makerHandle || sess.handle || `@user`,
          logoUrl: activeThumbnail || undefined,
          screenshots: activeGallery.filter(Boolean),
          details,
        });

        if (activeForm.apiKey) {
          try {
            await savePaymentApiKey({
              provider: activeForm.pricingPartner || "stripe",
              apiKey: activeForm.apiKey,
            });
          } catch {}
        }

        try {
          localStorage.removeItem("tlf_pending_submission");
          localStorage.removeItem("tlf_submit_draft");
        } catch {}

        if (!cancelled) {
          window.history.replaceState({}, "", "/submit");
          setQueuedSubmission({ id: sub.id, scheduledFor: sub.scheduledFor.toString() });
          setSubmitted(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        console.error("[auto_submit] execution error:", err);
      } finally {
        if (!cancelled) setIsAutoSubmitting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitParam, isEmbeddedMode, editParam, submitted]);

  React.useEffect(() => {
    if (initialProductData) {
      const pName = initialProductData.name || "Sample Product";
      const pCat = initialProductData.category || "devtools";
      const pSlug = slugify(pName);

      const f1 = initialProductData.feature1 || `Sub-second ${pCat} workflow automation & instant preview branching`;
      const f2 = initialProductData.feature2 || "Native SIMD-accelerated HNSW vector indexing for AI models";
      const f3 = initialProductData.feature3 || "Automated point-in-time recovery with continuous Write-Ahead-Logging";

      const free = initialProductData.freePlan || "$0/mo · 5GB Storage, 1M Vector Queries, Community Support";
      const pro = initialProductData.proPlan || "$29/mo · 100GB Storage, Unlimited Vectors, Priority Edge Routing";
      const ent = initialProductData.enterprisePlan || "$199/mo · Dedicated Compute Cluster, 99.99% SLA, SOC2";

      const q1 = initialProductData.faq1Q || "How does branching differ from standard database read replicas?";
      const a1 = initialProductData.faq1A || "Branches copy metadata instantly using copy-on-write storage, isolated from main branch production data.";
      const q2 = initialProductData.faq2Q || "Can I migrate existing cloud infrastructure without downtime?";
      const a2 = initialProductData.faq2A || "Yes, our continuous CDC proxy replicates write transactions transparently with 0ms downtime.";

      const filledForm = {
        name: pName,
        tagline: initialProductData.tagline || `Autonomous ${pCat} platform built for high-throughput engineering teams`,
        category: pCat,
        makerName: initialProductData.makerName || "Menajul Hoque",
        makerHandle: initialProductData.maker || initialProductData.makerHandle || "@menajulm",
        websiteUrl: initialProductData.websiteUrl || initialProductData.website || `https://${pSlug}.com`,
        videoUrl: initialProductData.videoUrl || "",
        githubUrl: initialProductData.githubUrl || `https://github.com/menajulm/${pSlug}`,
        revenue: initialProductData.revenue || "$14.2K / mo",
        overviewPitch:
          initialProductData.overviewPitch ||
          initialProductData.description ||
          `${pName} is an advanced ${pCat} platform engineered for real-time vector search, multi-region instant deployment, and auto-scaling compute workloads.`,
        feature1: f1,
        feature2: f2,
        feature3: f3,
        targetAudience:
          initialProductData.targetAudience ||
          "Indie hackers, AI SaaS founders, Next.js developers, and high-throughput engineering teams.",
        freePlan: free,
        proPlan: pro,
        enterprisePlan: ent,
        techStack: initialProductData.techStack || "Rust, Next.js 16, Neon Postgres, Tailwind CSS v4, Vercel Edge",
        infraHosting: initialProductData.infraHosting || "Distributed AWS & Vercel Edge Mesh (35 Global Points of Presence)",
        apiUrl: initialProductData.apiUrl || `https://api.${pSlug}.com/v1/graphql`,
        securityStandards: initialProductData.securityStandards || "SOC2 Type II, Passkey Authentication, End-to-End Encryption",
        originStory:
          initialProductData.originStory ||
          `Built out of sheer frustration with traditional ${pCat} tooling. We wanted instant staging environments per git branch without burning $500/month.`,
        makerThesis:
          initialProductData.makerThesis ||
          "Developer tooling should be instantaneous, invisible, and deterministic. If a deployment takes longer than a git checkout, the tool has failed.",
        latestVersion: initialProductData.latestVersion || "v2.4.0 — High-Performance Edge Engine",
        latestChangelog:
          initialProductData.latestChangelog ||
          "Reduced query response latency from 14ms to 1.8ms using Rust AVX-512 routines and global edge caching.",
        roadmapQ3: initialProductData.roadmapQ3 || "Global Read-Replicas in Tokyo, Frankfurt, and São Paulo",
        roadmapQ4: initialProductData.roadmapQ4 || "Native LLM Function Calling & Automatic Embeddings Pipeline",
        pricingPartner: initialProductData.pricingPartner || "stripe",
        apiKey: initialProductData.apiKey || "",
        revenueVerified: Boolean(initialProductData.revenueVerified || initialProductData.revenue),
        faq1Q: q1,
        faq1A: a1,
        faq2Q: q2,
        faq2A: a2,
        supportEmail: initialProductData.supportEmail || `support@${pSlug}.com`,
      };

      setFormData(filledForm);
      setFeatures([f1, f2, f3]);
      setPricingTiers([
        { name: "Free", price: "$0/mo", specs: free },
        { name: "Pro", price: "$29/mo", specs: pro },
        { name: "Enterprise", price: "$199/mo", specs: ent },
      ]);
      setFaqs([
        { q: q1, a: a1 },
        { q: q2, a: a2 },
      ]);

      if (initialProductData.thumbnailAvif) {
        setThumbnailAvif(initialProductData.thumbnailAvif);
      }
    }
  }, [initialProductData]);

  // Load existing submission/product data when /submit?edit=<id> is present.
  useEffect(() => {
    if (!editParam || isEmbeddedMode) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await getEditablePayload(editParam);
        if (cancelled || !payload) return;
        setEditTarget(payload);
        const dt = (payload.details || {}) as Record<string, any>;
        setFormData((prev) => ({
          ...prev,
          name: payload.name,
          tagline: payload.tagline,
          websiteUrl: payload.websiteUrl,
          category: payload.categorySlug || prev.category,
          makerName: payload.makerName || prev.makerName,
          makerHandle: payload.makerHandle || prev.makerHandle,
          overviewPitch: dt.overviewPitch || payload.description || prev.overviewPitch,
          freePlan: dt.freePlan || prev.freePlan,
          proPlan: dt.proPlan || prev.proPlan,
          enterprisePlan: dt.enterprisePlan || prev.enterprisePlan,
          techStack: dt.techStack || prev.techStack,
          infraHosting: dt.infraHosting || prev.infraHosting,
          apiUrl: dt.apiUrl || prev.apiUrl,
          securityStandards: dt.securityStandards || prev.securityStandards,
          targetAudience: dt.targetAudience || prev.targetAudience,
          originStory: dt.originStory || prev.originStory,
          makerThesis: dt.makerThesis || prev.makerThesis,
          latestVersion: dt.latestVersion || prev.latestVersion,
          latestChangelog: dt.latestChangelog || prev.latestChangelog,
          roadmapQ3: dt.roadmapQ3 || prev.roadmapQ3,
          roadmapQ4: dt.roadmapQ4 || prev.roadmapQ4,
          pricingPartner: dt.pricingPartner || prev.pricingPartner,
          revenue: dt.revenue || prev.revenue,
          apiKey: dt.apiKey || prev.apiKey,
          supportEmail: dt.supportEmail || prev.supportEmail,
          githubUrl: dt.githubUrl || prev.githubUrl,
        }));
        if (payload.logoUrl) setThumbnailAvif(payload.logoUrl);
        if (payload.screenshots && payload.screenshots.length > 0) {
          setGalleryAvif(payload.screenshots);
        }
        if (Array.isArray(dt.features) && dt.features.length > 0) {
          setFeatures(dt.features);
        }
        if (Array.isArray(dt.pricingTiers) && dt.pricingTiers.length > 0) {
          setPricingTiers(dt.pricingTiers);
        }
        if (Array.isArray(dt.faqs) && dt.faqs.length > 0) {
          setFaqs(dt.faqs);
        }
      } catch (err) {
        console.error("[submit:edit] load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editParam, isEmbeddedMode]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConvertingAvif(true);
    try {
      const res = await convertImageFileToAvifDataUrl(file);
      setThumbnailAvif(res.dataUrl);
      setAvifMeta({ sizeKb: res.sizeKb, format: res.format });
    } catch (err) {
      console.error("AVIF conversion error:", err);
    } finally {
      setIsConvertingAvif(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsConvertingGallery(true);
    try {
      const newAvifs: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (galleryAvif.length + newAvifs.length >= 4) break;
        const res = await convertImageFileToAvifDataUrl(files[i], 1200, 0.88);
        newAvifs.push(res.dataUrl);
      }
      setGalleryAvif((prev) => [...prev, ...newAvifs]);
    } catch (err) {
      console.error("Gallery AVIF error:", err);
    } finally {
      setIsConvertingGallery(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryAvif((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptureScreenshot = async () => {
    const url = formData.websiteUrl?.trim();
    if (!url) return;
    if (galleryAvif.length >= 4) return;

    setIsCapturingScreenshot(true);
    try {
      const res = await fetch(`/api/screenshot?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Capture failed" }));
        alert(err.error || "Failed to capture screenshot");
        return;
      }

      const blob = await res.blob();
      const conv = await convertImageFileToAvifDataUrl(blob as File, 1200, 0.88);
      setGalleryAvif((prev) => [...prev, conv.dataUrl]);
    } catch (err) {
      console.error("Screenshot capture error:", err);
      alert("Failed to capture homepage screenshot. Please try again or upload manually.");
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Vertical Step Progress Calculator
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

  const getStepStatus = (step: number): boolean => {
    if (skippedSteps.has(step)) return true;
    if (step === 1) {
      return (
        !!formData.name &&
        !!formData.tagline &&
        !!formData.category &&
        !!formData.makerName &&
        thumbnailAvif.length > 0 &&
        galleryAvif.length > 0
      );
    }
    if (step === 2) {
      const hasFeature = features.some((f) => !!f && f.trim().length > 0);
      const hasTier = pricingTiers.some((t) => !!(t.price?.trim()) || !!(t.specs?.trim()));
      return !!formData.overviewPitch && hasFeature && !!formData.targetAudience && hasTier;
    }
    if (step === 3) return !!(formData.techStack && formData.infraHosting);
    if (step === 4) return !!(formData.originStory && formData.makerThesis);
    if (step === 5) return !!(formData.latestVersion || formData.latestChangelog);
    if (step === 6) {
      return (
        enableRevenueSdk ||
        !!(formData.pricingPartner && formData.pricingPartner.trim()) ||
        !!(formData.apiKey && formData.apiKey.trim()) ||
        !!(formData.revenue && formData.revenue.trim())
      );
    }
    if (step === 7) return faqs.length > 0 && !!(faqs[0].q && faqs[0].a);
    return false;
  };

  const isStepSkipped = (step: number) => skippedSteps.has(step);

  const handleSkipStep = (currentStep: number, nextSectionId: string) => {
    setSkippedSteps((prev) => new Set(prev).add(currentStep));
    const el = document.getElementById(nextSectionId);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const TOTAL_STEPS = 7;
  const completedSteps = [1, 2, 3, 4, 5, 6, 7].filter(getStepStatus).length;
  const progressPercent = Math.round((completedSteps / TOTAL_STEPS) * 100);

  // Per-section granular progress: what fraction of each step's fields are filled.
  const s = (v: string | undefined | null) => !!(v && v.trim().length > 0);
  const stepFieldProgress = (step: number): { filled: number; total: number } => {
    if (skippedSteps.has(step)) return { filled: 0, total: 0 };
    switch (step) {
      case 1: {
        const fields = [
          s(formData.name),
          s(formData.tagline),
          s(formData.category),
          s(formData.makerName),
          thumbnailAvif.length > 0,
          galleryAvif.length > 0,
        ];
        return { filled: fields.filter(Boolean).length, total: fields.length };
      }
      case 2: {
        const anyFeature = features.some((f) => s(f));
        const anyTier = pricingTiers.some((t) => s(t.price) || s(t.specs));
        const fields = [s(formData.overviewPitch), anyFeature, s(formData.targetAudience), anyTier];
        return { filled: fields.filter(Boolean).length, total: fields.length };
      }
      case 3: {
        const fields = [s(formData.techStack), s(formData.infraHosting), s(formData.apiUrl), s(formData.securityStandards)];
        return { filled: fields.filter(Boolean).length, total: fields.length };
      }
      case 4: {
        const fields = [s(formData.originStory), s(formData.makerThesis), s(formData.makerHandle), s(formData.websiteUrl)];
        return { filled: fields.filter(Boolean).length, total: fields.length };
      }
      case 5: {
        const fields = [s(formData.latestVersion), s(formData.latestChangelog), s(formData.roadmapQ3), s(formData.roadmapQ4)];
        return { filled: fields.filter(Boolean).length, total: fields.length };
      }
      case 6: {
        const isDone =
          enableRevenueSdk ||
          s(formData.pricingPartner) ||
          s(formData.apiKey) ||
          s(formData.revenue);
        return { filled: isDone ? 1 : 0, total: 1 };
      }
      case 7: {
        const anyFaq = faqs.some((f) => s(f.q) && s(f.a));
        const fields = [anyFaq, s(formData.supportEmail)];
        return { filled: fields.filter(Boolean).length, total: fields.length };
      }
      default:
        return { filled: 0, total: 0 };
    }
  };

  const [autofillError, setAutofillError] = useState<string>("");
  const [autofillMeta, setAutofillMeta] = useState<{ pagesCrawled: number; githubStars: number | null } | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const clearArmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClearForm = () => {
    if (!clearArmed) {
      setClearArmed(true);
      if (clearArmTimer.current) clearTimeout(clearArmTimer.current);
      clearArmTimer.current = setTimeout(() => setClearArmed(false), 3000);
      return;
    }
    if (clearArmTimer.current) clearTimeout(clearArmTimer.current);
    setClearArmed(false);
    setFormData(EMPTY_PROFILE);
    setFeatures(["", "", ""]);
    setPricingTiers([
      { name: "Free", price: "", specs: "" },
      { name: "Pro", price: "", specs: "" },
      { name: "Enterprise", price: "", specs: "" },
    ]);
    setFaqs([{ q: "", a: "" }]);
    setSkippedSteps(new Set());
    setAutofillUrl("");
    setAutofillError("");
    setAutofillMeta(null);
    setThumbnailAvif("");
    setAvifMeta(null);
    setGalleryAvif([]);
    setEnableRevenueSdk(false);
    setSdkLog("");
    setLaunchTier(5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // AI Autofill Handler — real crawler + GPT-4o-mini extraction
  const handleAiAutofill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autofillUrl.trim()) return;
    setAutofillError("");
    setAutofillMeta(null);
    setIsExtracting(true);

    try {
      const res = await fetch("/api/autofill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: autofillUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `Extraction failed (${res.status})`);
      }
      const d = json.data as {
        name: string; tagline: string; category: string; makerName: string; makerHandle: string;
        websiteUrl: string; githubUrl: string; revenue: string; overviewPitch: string;
        features: string[]; targetAudience: string;
        pricingTiers: { name: string; price: string; specs: string }[];
        techStack: string; infraHosting: string; apiUrl: string; securityStandards: string;
        originStory: string; makerThesis: string; latestVersion: string; latestChangelog: string;
        roadmapQ3: string; roadmapQ4: string; pricingPartner: string;
        faqs: { q: string; a: string }[]; supportEmail: string;
        logoCandidates?: string[];
      };

      const feat = [...d.features];
      while (feat.length < 3) feat.push("");

      const tiers = (d.pricingTiers.length
        ? d.pricingTiers
        : [
            { name: "Free", price: "", specs: "" },
            { name: "Pro", price: "", specs: "" },
          ]
      ).map((t) => ({
        name: t.name ?? "",
        price: t.price ?? "",
        specs: t.specs ?? "",
      }));

      const faqPairs = d.faqs.length ? d.faqs : [{ q: "", a: "" }];

      setFormData((prev) => ({
        ...prev,
        name: d.name || prev.name,
        tagline: d.tagline || prev.tagline,
        category: d.category || prev.category,
        makerName: d.makerName || prev.makerName,
        makerHandle: d.makerHandle || prev.makerHandle,
        websiteUrl: d.websiteUrl || autofillUrl,
        videoUrl: (d as any).videoUrl || (editTarget?.videoUrl as string) || prev.videoUrl || "",
        githubUrl: d.githubUrl || prev.githubUrl,
        revenue: d.revenue || prev.revenue,
        overviewPitch: d.overviewPitch || prev.overviewPitch,
        feature1: feat[0] ?? prev.feature1,
        feature2: feat[1] ?? prev.feature2,
        feature3: feat[2] ?? prev.feature3,
        targetAudience: d.targetAudience || prev.targetAudience,
        freePlan: tiers[0] ? [tiers[0].price, tiers[0].specs].filter(Boolean).join(" · ") : prev.freePlan,
        proPlan: tiers[1] ? [tiers[1].price, tiers[1].specs].filter(Boolean).join(" · ") : prev.proPlan,
        enterprisePlan: tiers[2] ? [tiers[2].price, tiers[2].specs].filter(Boolean).join(" · ") : prev.enterprisePlan,
        techStack: d.techStack || prev.techStack,
        infraHosting: d.infraHosting || prev.infraHosting,
        apiUrl: d.apiUrl || prev.apiUrl,
        securityStandards: d.securityStandards || prev.securityStandards,
        originStory: d.originStory || prev.originStory,
        makerThesis: d.makerThesis || prev.makerThesis,
        latestVersion: d.latestVersion || prev.latestVersion,
        latestChangelog: d.latestChangelog || prev.latestChangelog,
        roadmapQ3: d.roadmapQ3 || prev.roadmapQ3,
        roadmapQ4: d.roadmapQ4 || prev.roadmapQ4,
        pricingPartner: d.pricingPartner || prev.pricingPartner,
        faq1Q: faqPairs[0]?.q ?? prev.faq1Q,
        faq1A: faqPairs[0]?.a ?? prev.faq1A,
        faq2Q: faqPairs[1]?.q ?? prev.faq2Q,
        faq2A: faqPairs[1]?.a ?? prev.faq2A,
        supportEmail: d.supportEmail || prev.supportEmail,
      }));

      setFeatures(feat.filter(Boolean).length ? feat.filter(Boolean) : feat);
      setPricingTiers(tiers);
      setFaqs(faqPairs);
      setAutofillMeta(json.meta ?? null);

      // Auto-fetch the logo/favicon and convert to AVIF for the thumbnail slot.
      if (d.logoCandidates && d.logoCandidates.length > 0) {
        setIsConvertingAvif(true);
        (async () => {
          for (const candidate of d.logoCandidates!) {
            try {
              const r = await fetch(`/api/autofill/image?url=${encodeURIComponent(candidate)}`);
              if (!r.ok) continue;
              const blob = await r.blob();
              if (!blob.size) continue;
              const conv = await convertImageFileToAvifDataUrl(blob, 800, 0.9);
              setThumbnailAvif(conv.dataUrl);
              setAvifMeta({ sizeKb: conv.sizeKb, format: conv.format });
              return;
            } catch {
              // try next candidate
            }
          }
        })().finally(() => setIsConvertingAvif(false));
      }
    } catch (err) {
      setAutofillError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleInputChange = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (onSaveProduct) {
      const updatedProductData = {
        ...formData,
        thumbnailAvif,
        galleryAvif,
        faqs,
        pricingTiers,
        features,
        description: formData.overviewPitch,
      };
      onSaveProduct(updatedProductData);
      setSubmitted(true);
      return;
    }

    let sess = getStoredSession();
    if (!sess) {
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.session) {
            sess = meData.session;
            saveSession(meData.session);
          }
        }
      } catch {}
    }

    // IF NOT LOGGED IN: Preserve all details and navigate immediately to sign-in
    if (!sess) {
      const pendingSubmission = {
        formData,
        thumbnailAvif,
        galleryAvif,
        faqs,
        pricingTiers,
        features,
        autofillUrl,
        launchTier,
        isAuthorizedConfirmed,
      };
      try {
        localStorage.setItem("tlf_pending_submission", JSON.stringify(pendingSubmission));
        localStorage.setItem("tlf_submit_draft", JSON.stringify(pendingSubmission));
      } catch {}
      window.location.assign(`/handler/sign-in?after_auth_return_to=${encodeURIComponent("/submit?auto_submit=1")}`);
      return;
    }

    if (formData.name && formData.name.length > 120) {
      alert(`Product Name is too long (${formData.name.length} characters). It exceeds the limit by ${formData.name.length - 120} characters. Maximum allowed is 120.`);
      return;
    }

    if (formData.tagline && formData.tagline.length > 250) {
      alert(`Tagline is too long (${formData.tagline.length} characters). It exceeds the limit by ${formData.tagline.length - 250} characters. Maximum allowed is 250.`);
      return;
    }

    if (formData.makerName && formData.makerName.length > 80) {
      alert(`Maker Name is too long (${formData.makerName.length} characters). It exceeds the limit by ${formData.makerName.length - 80} characters. Maximum allowed is 80.`);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const categorySlug = (formData.category || "").trim() || undefined;

    try {
      const details = {
        overviewPitch: formData.overviewPitch,
        features: features.filter((f) => f.trim().length > 0),
        pricingTiers: pricingTiers.filter((t) => t.name.trim() || t.price.trim() || t.specs.trim()),
        freePlan: formData.freePlan,
        proPlan: formData.proPlan,
        enterprisePlan: formData.enterprisePlan,
        techStack: formData.techStack,
        infraHosting: formData.infraHosting,
        apiUrl: formData.apiUrl,
        securityStandards: formData.securityStandards,
        targetAudience: formData.targetAudience,
        originStory: formData.originStory,
        makerThesis: formData.makerThesis,
        latestVersion: formData.latestVersion,
        latestChangelog: formData.latestChangelog,
        roadmapQ3: formData.roadmapQ3,
        roadmapQ4: formData.roadmapQ4,
        pricingPartner: formData.pricingPartner,
        revenue: formData.revenue,
        apiKey: formData.apiKey,
        faqs: faqs.filter((f) => f.q.trim() || f.a.trim()),
        supportEmail: formData.supportEmail,
        githubUrl: formData.githubUrl,
      };

      // EDIT MODE — /submit?edit=sub:X or ?edit=prod:X
      if (editTarget) {
        const fields = {
          name: formData.name || "Untitled product",
          tagline: formData.tagline || "",
          description: formData.overviewPitch,
          websiteUrl: formData.websiteUrl || "",
          videoUrl: formData.videoUrl || "",
          categorySlug,
          logoUrl: thumbnailAvif || "",
          screenshots: galleryAvif.filter(Boolean),
          details,
        };
        if (editTarget.kind === "submission" && editTarget.submissionId) {
          const upd = await updateMySubmission(editTarget.submissionId, fields);
          setQueuedSubmission({ id: upd.id, scheduledFor: upd.scheduledFor.toString() });
        } else if (editTarget.kind === "product" && editTarget.productId) {
          const upd = await updateMyProduct(editTarget.productId, fields);
          setUpdatedProductSlug(upd.slug);
        }
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const sub = await createSubmission({
        name: formData.name || "Untitled product",
        tagline: formData.tagline || "",
        websiteUrl: formData.websiteUrl || "",
        videoUrl: formData.videoUrl || undefined,
        description: formData.overviewPitch,
        categorySlug,
        makerName: formData.makerName || sess.name || "Unknown maker",
        makerHandle: formData.makerHandle || sess.handle || `@user`,
        logoUrl: thumbnailAvif || undefined,
        screenshots: galleryAvif.filter(Boolean),
        details,
      });

      if (formData.apiKey) {
        try {
          await savePaymentApiKey({
            provider: formData.pricingPartner || "stripe",
            apiKey: formData.apiKey,
          });
        } catch {
          // Non-blocking if revenue key save hits an edge case
        }
      }

      try {
        localStorage.removeItem("tlf_pending_submission");
        localStorage.removeItem("tlf_submit_draft");
      } catch {}

      if (launchTier === 5 || launchTier === 10) {
        setIsSubmitting(true);
        try {
          const res = await fetch("/api/checkout/dodo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId: sub.id,
              tier: launchTier,
              returnTo: "submit",
            }),
          });
          const dodoData = await res.json();
          if (dodoData.checkoutUrl) {
            window.location.href = dodoData.checkoutUrl;
            return; // Redirect to checkout: DO NOT show submitted queue screen beforehand!
          }
        } catch (e) {
          console.warn("[Submit] Dodo checkout initialization failed:", e);
        }
      }

      setQueuedSubmission({ id: sub.id, scheduledFor: sub.scheduledFor.toString(), launchTier: 0 });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("[submit] failed", err);
      if (err instanceof Error && err.message === "UNAUTHENTICATED") {
        const pendingSubmission = {
          formData,
          thumbnailAvif,
          galleryAvif,
          faqs,
          pricingTiers,
          features,
          autofillUrl,
          launchTier,
          isAuthorizedConfirmed,
        };
        try {
          localStorage.setItem("tlf_pending_submission", JSON.stringify(pendingSubmission));
          localStorage.setItem("tlf_submit_draft", JSON.stringify(pendingSubmission));
        } catch {}
        window.location.assign(`/handler/sign-in?after_auth_return_to=${encodeURIComponent("/submit?auto_submit=1")}`);
        return;
      }
      alert(err instanceof Error && err.message ? err.message : "Submission failed — please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Step definitions for progress sidebar
  const STEP_DEFINITIONS = [
    { id: "section-01", step: 1, title: "01. Core Identity", sub: "Name, category, logo", optional: false },
    { id: "section-02", step: 2, title: "02. Pitch & Tiers", sub: "Summary, features, pricing", optional: false },
    { id: "section-03", step: 3, title: "03. Architecture", sub: "Tech stack, infra, API", optional: true, next: "section-04" },
    { id: "section-04", step: 4, title: "04. Founder Story", sub: "Origin, thesis, handles", optional: true, next: "section-05" },
    { id: "section-05", step: 5, title: "05. Changelog", sub: "Release notes, milestones", optional: true, next: "section-06" },
    { id: "section-06", step: 6, title: "06. Revenue SDK", sub: "Automated SDK integration", optional: true, next: "section-07" },
    { id: "section-07", step: 7, title: "07. FAQ & Support", sub: "FAQ pairs, support info", optional: false },
  ];

  const progressSidebar = (
    <>
      {/* Breadcrumb — in edit mode we route back to the profile so the
          user doesn't lose their place; otherwise back to the feed. */}
      <div className="h-10 flex items-end pb-2.5 border-b border-hairline shrink-0">
        <Link
          href={editTarget ? "/profile" : "/"}
          className="text-xs font-mono text-ink-dim hover:text-ink flex items-center gap-1.5 transition-colors"
        >
          ← {editTarget ? "Back to Profile" : "Back to Launch Feed"}
        </Link>
      </div>


      {/* Progress Meter — High-Tech Segmented Block Meter */}
      <div className="py-3.5 border-b border-hairline shrink-0 space-y-2.5 font-mono">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
            Shipment Meter
          </span>
          <span className="text-[11px] font-bold text-signal font-mono">
            {progressPercent}%
          </span>
        </div>

        {/* 10-Segment Pixel-Block Meter */}
        <div className="flex items-center gap-1 w-full">
          {Array.from({ length: 10 }).map((_, i) => {
            const isFilled = i < Math.round((progressPercent / 100) * 10);
            return (
              <div
                key={i}
                className={`h-2 flex-1 transition-all duration-300 ${
                  isFilled
                    ? "bg-signal"
                    : "bg-surface/80 border border-hairline"
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-ink-dim">
          <span>
            {completedSteps === TOTAL_STEPS
              ? "✓ READY TO SHIP"
              : `${TOTAL_STEPS - completedSteps} STEPS REMAINING`}
          </span>
          <span className="text-ink-faint font-bold">
            {completedSteps}/{TOTAL_STEPS}
          </span>
        </div>
      </div>

      {/* Step Timeline — scrollable when it overflows the sidebar height */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-hairline">
        {STEP_DEFINITIONS.map((step) => {
          const isDone = getStepStatus(step.step);
          const skipped = isStepSkipped(step.step);
          const { filled, total } = stepFieldProgress(step.step);
          const pct = total > 0 ? Math.round((filled / total) * 100) : skipped ? 100 : 0;
          const barColor = skipped
            ? "bg-ink-faint"
            : pct === 100
              ? "bg-emerald-500"
              : pct > 0
                ? "bg-signal"
                : "bg-hairline";
          return (
            <div key={step.step} className="py-2.5">
              <button
                type="button"
                onClick={() => {
                  if (activeTab !== "builder") setActiveTab("builder");
                  setTimeout(() => {
                    const el = document.getElementById(step.id);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }, 50);
                }}
                className="flex items-start gap-2 group cursor-pointer w-full"
              >
                <span
                  className={`w-2 h-2 rounded-xs shrink-0 mt-1 transition-all ${
                    isDone
                      ? skipped
                        ? "bg-ink-faint"
                        : "bg-emerald-500"
                      : pct > 0
                        ? "bg-signal"
                        : "bg-surface border border-hairline group-hover:border-signal"
                  }`}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[11px] font-bold uppercase truncate transition-colors leading-tight ${
                      isDone
                        ? skipped ? 'text-ink-faint line-through' : 'text-emerald-500'
                        : 'text-ink group-hover:text-signal'
                    }`}>
                      {step.title}
                    </div>
                    <span className={`text-[9px] font-mono font-bold shrink-0 ${
                      skipped ? "text-ink-faint" : pct === 100 ? "text-emerald-500" : pct > 0 ? "text-signal" : "text-ink-faint"
                    }`}>
                      {skipped ? "SKIP" : `${pct}%`}
                    </span>
                  </div>
                  {/* Per-section pixel-block micro meter */}
                  {total > 0 && (
                    <div className="flex items-center gap-[2px] w-full">
                      {Array.from({ length: total }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 transition-all ${i < filled ? barColor : "bg-surface/80 border border-hairline"}`}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] text-ink-faint truncate">
                      {skipped
                        ? "Skipped"
                        : total > 0
                          ? `${filled}/${total} filled · ${step.sub}`
                          : step.sub}
                    </div>
                    {step.optional && !isDone && step.next && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkipStep(step.step, step.next!);
                        }}
                        className="text-[8px] font-bold uppercase px-1 py-0.5 border border-hairline text-ink-faint hover:text-signal hover:border-signal transition-colors shrink-0 cursor-pointer"
                      >
                        skip
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );

  const formContent = (
    <div className="space-y-6 pb-16 font-mono text-ink">
        {/* Tab Toggle Bar — hidden when editing in embedded mode */}
        {!isEmbeddedMode && (
          <div className="sticky -top-4 z-30 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
            <div className="h-10 flex items-end justify-center gap-1.5 sm:gap-2 pb-2.5">
              <button
                type="button"
                onClick={() => setActiveTab("builder")}
                className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                  activeTab === "builder"
                    ? "bg-ink text-void"
                    : "text-ink-dim hover:text-ink border border-hairline bg-surface/50"
                }`}
              >
                [ FORM BUILDER ]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                  activeTab === "preview"
                    ? "bg-signal text-void"
                    : "text-ink-dim hover:text-ink border border-hairline bg-surface/50"
                }`}
              >
                [ LIVE 360° PREVIEW ]
              </button>
            </div>
          </div>
        )}

        {/* MOBILE PROGRESS STRIP — visible only when the sidebar is hidden (<xl) */}
        <div className="xl:hidden border border-hairline bg-surface/40 p-3 space-y-2.5">
          <div className="flex items-center justify-between font-mono">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
              Shipment Meter
            </span>
            <span className="text-[10px] font-bold text-signal font-mono">
              {progressPercent}% · {completedSteps}/{TOTAL_STEPS}
            </span>
          </div>
          <div className="flex items-center gap-[3px] w-full">
            {Array.from({ length: 10 }).map((_, i) => {
              const isFilled = i < Math.round((progressPercent / 100) * 10);
              return (
                <div
                  key={i}
                  className={`h-1.5 flex-1 transition-all duration-300 ${isFilled ? "bg-signal" : "bg-surface/80 border border-hairline"}`}
                />
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
            {STEP_DEFINITIONS.map((step) => {
              const isDone = getStepStatus(step.step);
              const skipped = isStepSkipped(step.step);
              const { filled, total } = stepFieldProgress(step.step);
              const pct = total > 0 ? Math.round((filled / total) * 100) : skipped ? 100 : 0;
              return (
                <button
                  key={step.step}
                  type="button"
                  onClick={() => {
                    if (activeTab !== "builder") setActiveTab("builder");
                    setTimeout(() => {
                      const el = document.getElementById(step.id);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                  className={`shrink-0 px-2 py-1 border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isDone && !skipped
                      ? "border-emerald-500/60 text-emerald-500 bg-surface"
                      : skipped
                        ? "border-hairline text-ink-faint bg-surface line-through"
                        : pct > 0
                          ? "border-signal/60 text-signal bg-surface"
                          : "border-hairline text-ink-dim bg-void"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-xs ${
                      isDone && !skipped ? "bg-emerald-500" : pct > 0 ? "bg-signal" : "bg-hairline"
                    }`}
                  />
                  <span>{step.title.split(".")[0]}</span>
                  <span className="opacity-70">{skipped ? "SKIP" : `${pct}%`}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Page Header — hidden when editing in embedded mode */}
        {!isEmbeddedMode && (
          <div className="border border-hairline bg-surface/40 p-4 sm:p-8 space-y-4">
            <div className="border-b border-hairline pb-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                <h1 className="font-mono text-xl sm:text-3xl font-bold uppercase tracking-wider text-ink">
                  {isEditMode ? "Update Product Details" : "Submit Your Product"}
                </h1>
                <span className="text-[10px] font-mono px-2.5 py-1 border border-signal/60 bg-signal/10 text-signal uppercase font-bold flex items-center gap-1.5 self-start sm:shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                  {isEditMode ? "EDITING LIVE PRODUCT" : "NEXT RELEASE: 00:30 UTC · 6:00 AM IST"}
                </span>
              </div>
              <p className="text-xs text-ink-dim leading-relaxed">
                Launch your software tool on the daily leaderboard with full 360-degree product intelligence, architecture specs, founder story, and revenue transparency. Submissions are queued for the upcoming 6:00 AM IST (00:30 UTC) daily release.
              </p>
            </div>

            {/* 1-Click AI Autofill Bar */}
            <form
              onSubmit={handleAiAutofill}
              className="p-4 border border-signal/40 bg-surface/60 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-signal uppercase tracking-wider flex items-center gap-1.5">
                  1-CLICK AI AUTOFILL FROM WEBSITE / GITHUB
                </span>
                <span className="text-[10px] text-ink-faint">
                  NEURAL EXTRACTION ENGINE v2.4
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                <input
                  type="url"
                  value={autofillUrl}
                  onChange={(e) => setAutofillUrl(e.target.value)}
                  placeholder="Paste product website or GitHub repo URL"
                  className="flex-1 min-w-0 px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink placeholder:text-ink-faint focus:outline-none focus:border-signal"
                />
                <button
                  type="submit"
                  disabled={isExtracting}
                  className="px-5 py-2 bg-signal text-void text-xs font-bold uppercase hover:bg-signal/90 transition-colors shrink-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isExtracting ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-void animate-ping" />
                      <span>Extracting 360° Specs...</span>
                    </>
                  ) : (
                    <span>Auto-Extract 360° Specs</span>
                  )}
                </button>
                {(() => {
                  const hasContent =
                    Object.entries(formData).some(([k, v]) =>
                      k === "revenueVerified" ? v === true : typeof v === "string" && v.trim().length > 0,
                    ) ||
                    features.some((f) => f.trim().length > 0) ||
                    pricingTiers.some((t) => t.specs.trim().length > 0 || t.price.trim().length > 0) ||
                    faqs.some((f) => f.q.trim().length > 0 || f.a.trim().length > 0) ||
                    thumbnailAvif.length > 0 ||
                    galleryAvif.length > 0 ||
                    autofillUrl.trim().length > 0;
                  return (
                    <button
                      type="button"
                      onClick={handleClearForm}
                      disabled={!hasContent}
                      title={hasContent ? "Click twice to wipe every field" : "Form is already empty"}
                      className={`px-3 py-2 border text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0 flex items-center justify-center gap-1.5 ${
                        !hasContent
                          ? "border-hairline/40 bg-void/40 text-ink-faint cursor-not-allowed opacity-50"
                          : clearArmed
                          ? "border-signal bg-signal/10 text-signal cursor-pointer"
                          : "border-hairline bg-void text-ink-dim hover:text-signal hover:border-signal cursor-pointer"
                      }`}
                    >
                      <span>⨯</span>
                      <span>{clearArmed && hasContent ? "Click Again to Confirm" : "Clear Form"}</span>
                    </button>
                  );
                })()}
              </div>
              {autofillError && (
                <div className="text-[11px] font-mono text-signal border border-signal/40 bg-void px-3 py-2 uppercase tracking-wider">
                  ⚠ {autofillError}
                </div>
              )}
              {autofillMeta && !autofillError && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-ink-dim uppercase tracking-wider">
                    ✓ Extracted from {autofillMeta.pagesCrawled} page{autofillMeta.pagesCrawled === 1 ? "" : "s"}
                    {autofillMeta.githubStars !== null ? ` · ${autofillMeta.githubStars.toLocaleString()} ★ github` : ""}
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2.5 border border-hairline bg-void text-[10px] font-mono text-ink-dim leading-relaxed">
                    <span className="text-signal font-bold shrink-0 mt-px">TIP →</span>
                    <span>
                      <span className="text-ink font-bold uppercase tracking-wider">Fields left empty were not found on your site.</span>{" "}
                      The extractor only fills what it can verify &mdash; fill the blanks yourself. Unique, human-written taglines, features, pricing, and FAQs drive{" "}
                      <span className="text-ink">organic reach</span>, backlinks, and referrals over the weeks after launch. Treat this as a draft, not a final.
                    </span>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {isAutoSubmitting && (
          <div className="border border-signal bg-surface p-8 text-center space-y-4 font-mono">
            <div className="w-12 h-12 border border-signal bg-void mx-auto flex items-center justify-center font-display font-black text-xl text-signal animate-spin">
              ⟳
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold uppercase tracking-wider text-ink">
                Finalizing Launch Shipment...
              </h3>
              <p className="text-xs text-ink-dim max-w-md mx-auto">
                Authentication verified. Registering <strong className="text-ink">{formData.name || "your product"}</strong> into the daily launch queue.
              </p>
            </div>
          </div>
        )}

        {submitted && (
          editTarget?.kind === "product" ? (
            <div className="border border-signal bg-surface p-8 text-center space-y-6">
              <div className="w-16 h-16 border border-signal bg-void mx-auto flex items-center justify-center font-display font-black text-2xl text-signal">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-ink">
                  Product Updated Successfully!
                </h2>
                <p className="text-xs text-ink-dim max-w-lg mx-auto">
                  <strong className="text-ink">{formData.name}</strong> has been updated. Your changes are live on the product page immediately and were not re-queued.
                </p>
              </div>

              <div className="p-4 border border-hairline bg-void text-left max-w-md mx-auto space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-hairline pb-1">
                  <span className="text-ink-faint">Product:</span>
                  <span className="text-ink font-bold">{formData.name}</span>
                </div>
                <div className="flex justify-between border-b border-hairline pb-1">
                  <span className="text-ink-faint">Status:</span>
                  <span className="text-signal font-bold">LIVE (Updated)</span>
                </div>
                {formData.websiteUrl && (
                  <div className="flex justify-between">
                    <span className="text-ink-faint">Website:</span>
                    <span className="text-ink truncate max-w-[220px]">{formData.websiteUrl}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-center gap-4 flex-wrap">
                <Link
                  href={`/product/${updatedProductSlug || slugify(formData.name)}`}
                  className="px-6 py-2.5 bg-signal text-void text-xs font-bold hover:bg-signal/90 transition-colors"
                >
                  View Live Product Page ↗
                </Link>
                <Link
                  href="/profile"
                  className="px-6 py-2.5 border border-hairline bg-surface text-ink text-xs font-bold hover:bg-raised transition-colors"
                >
                  Return to Founder Dashboard →
                </Link>
              </div>
            </div>
          ) : (
            <div className="border border-signal bg-surface p-8 text-center space-y-6">
              <div className="w-16 h-16 border border-signal bg-void mx-auto flex items-center justify-center font-display font-black text-2xl text-signal">
                01
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold uppercase tracking-wider text-ink">
                  Shipment Successfully Queued!
                </h2>
                <p className="text-xs text-ink-dim max-w-lg mx-auto">
                  <strong className="text-ink">{formData.name}</strong> has been registered in the daily launch queue. You&#39;ll receive an email the moment your product goes live.
                </p>
              </div>

              {queuedSubmission && (
                <div className="max-w-md mx-auto">
                  <SubmissionTimer target={queuedSubmission.scheduledFor} label="GOES LIVE IN" />
                </div>
              )}

              {/* Launch Tier Confirmation Badge */}
              {queuedSubmission?.launchTier === 5 ? (
                <div className="p-3.5 border border-signal/40 bg-signal/10 text-signal text-xs font-mono font-bold uppercase flex items-center justify-center gap-2 max-w-md mx-auto">
                  <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
                  <span>$5 Featured Launch Confirmed · Header Floating Placement Active for 30 Days Upon Launch</span>
                </div>
              ) : queuedSubmission?.launchTier === 10 ? (
                <div className="p-3.5 border border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#38BDF8] text-xs font-mono font-bold uppercase flex items-center justify-center gap-2 max-w-md mx-auto">
                  <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
                  <span>$10 Spotlight Placement Confirmed · Alternating 15s Spotlight Active for 30 Days Upon Launch</span>
                </div>
              ) : (
                <div className="p-3 border border-hairline bg-void text-ink-dim text-xs font-mono uppercase flex items-center justify-center gap-2 max-w-md mx-auto">
                  <span>✓</span>
                  <span>Free Launch Placement Confirmed · 100% Free Forever</span>
                </div>
              )}

              <div className="p-4 border border-hairline bg-void text-left max-w-md mx-auto space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-hairline pb-1">
                  <span className="text-ink-faint">Product:</span>
                  <span className="text-ink font-bold">{formData.name}</span>
                </div>
                <div className="flex justify-between border-b border-hairline pb-1">
                  <span className="text-ink-faint">Launch Tier:</span>
                  <span className={`font-bold ${
                    queuedSubmission?.launchTier === 5
                      ? "text-signal"
                      : queuedSubmission?.launchTier === 10
                        ? "text-[#38BDF8]"
                        : "text-ink"
                  }`}>
                    {queuedSubmission?.launchTier === 5
                      ? "$5 · FEATURED LAUNCH (30D)"
                      : queuedSubmission?.launchTier === 10
                        ? "$10 · PREMIUM SPOTLIGHT (30D)"
                        : "$0 · FREE LAUNCH"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-hairline pb-1">
                  <span className="text-ink-faint">Founder:</span>
                  <span className="text-ink">{formData.makerName} ({formData.makerHandle})</span>
                </div>
                <div className="flex justify-between border-b border-hairline pb-1">
                  <span className="text-ink-faint">Verified Revenue:</span>
                  <span className="text-ink">{formData.revenue || "None"}</span>
                </div>
                <div className="flex justify-between flex-wrap gap-1">
                  <span className="text-ink-faint">Scheduled Release:</span>
                  <span className="text-signal font-bold">
                    {queuedSubmission?.scheduledFor
                      ? formatReleaseUtcWithIst(queuedSubmission.scheduledFor)
                      : "00:30 UTC · 6:00 AM IST"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-hairline/60 pt-1 text-[11px]">
                  <span className="text-ink-faint">Auto-Publish Time:</span>
                  <span className="text-ink font-bold">00:30 UTC · 6:00 AM IST</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-4 flex-wrap">
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 border border-hairline bg-surface text-ink text-xs font-bold hover:bg-raised transition-colors cursor-pointer"
                >
                  Edit Details
                </button>
                <Link
                  href="/profile"
                  className="px-6 py-2.5 bg-signal text-void text-xs font-bold hover:bg-signal/90 transition-colors"
                >
                  Go to My Profile →
                </Link>
              </div>
            </div>
          )
        )}

        {!submitted && activeTab === "builder" && (
          /* Form Builder Sections */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 01: Core Hero Metadata */}
            <div id="section-01" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                  01. Core Identity & Hero Media
                </h2>
                <span className="text-xs text-ink-faint">REQUIRED *</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">
                      Product Name *
                    </label>
                    <span className={`text-[10px] font-mono ${
                      formData.name.length > 120 ? "text-signal font-bold animate-pulse" : "text-ink-faint"
                    }`}>
                      {formData.name.length > 120
                        ? `⚠ Exceeded by ${formData.name.length - 120} chars (${formData.name.length}/120)`
                        : `${formData.name.length}/120`}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g. Synthwave AI"
                    className={`w-full px-3 py-2 border bg-void text-xs font-mono text-ink focus:outline-none transition-colors ${
                      formData.name.length > 120 ? "border-signal bg-signal/[0.03]" : "border-hairline focus:border-ink"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Category *
                  </label>
                  <BrutalistCategorySelect
                    value={formData.category}
                    onChange={(val) => handleInputChange("category", val)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">
                      Tagline (One sentence hook) *
                    </label>
                    <span className={`text-[10px] font-mono ${
                      formData.tagline.length > 180 ? "text-signal font-bold animate-pulse" : "text-ink-faint"
                    }`}>
                      {formData.tagline.length > 180
                        ? `⚠ Exceeded by ${formData.tagline.length - 180} chars (${formData.tagline.length}/180)`
                        : `${formData.tagline.length}/180`}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.tagline}
                    onChange={(e) => handleInputChange("tagline", e.target.value)}
                    placeholder="e.g. AI code review engine that understands your entire repository graph"
                    className={`w-full px-3 py-2 border bg-void text-xs font-mono text-ink focus:outline-none transition-colors ${
                      formData.tagline.length > 180 ? "border-signal bg-signal/[0.03]" : "border-hairline focus:border-ink"
                    }`}
                  />
                  {formData.tagline.length > 180 && (
                    <p className="text-[10px] font-mono text-signal font-bold">
                      ⚠ Tagline is too long. Please reduce it by {formData.tagline.length - 180} characters so it fits neatly across leaderboard cards and social embeds.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">
                      Maker Name *
                    </label>
                    <span className={`text-[10px] font-mono ${
                      formData.makerName.length > 80 ? "text-signal font-bold" : "text-ink-faint"
                    }`}>
                      {formData.makerName.length > 80
                        ? `⚠ Exceeded by ${formData.makerName.length - 80} chars`
                        : `${formData.makerName.length}/80`}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.makerName}
                    onChange={(e) => handleInputChange("makerName", e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className={`w-full px-3 py-2 border bg-void text-xs font-mono text-ink focus:outline-none transition-colors ${
                      formData.makerName.length > 80 ? "border-signal bg-signal/[0.03]" : "border-hairline focus:border-ink"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">
                      Maker Handle (X / GitHub)
                    </label>
                    <span className="text-[10px] text-ink-faint font-mono">
                      {formData.makerHandle ? `${formData.makerHandle.length}/40` : "OPTIONAL"}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formData.makerHandle}
                    onChange={(e) => handleInputChange("makerHandle", e.target.value)}
                    placeholder="e.g. @alexrivera"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* Product Thumbnail / Image Upload (Auto-Converted to AVIF) */}
                <div className="space-y-2 sm:col-span-2 border border-hairline bg-surface/30 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                    <label className="text-xs font-bold text-ink uppercase flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>Product Thumbnail & Logo Upload</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 border border-signal text-signal uppercase font-bold shrink-0">
                        AUTO-CONVERTED TO .AVIF
                      </span>
                    </label>
                    <span className="text-[10px] text-ink-faint font-mono shrink-0">
                      SUPPORTS PNG, JPG, WEBP, GIF, SVG
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pt-1">
                    <div className="w-16 h-16 bg-surface border border-hairline shrink-0 flex items-center justify-center relative overflow-hidden">
                      {thumbnailAvif ? (
                        <>
                          <img
                            src={thumbnailAvif}
                            alt="AVIF Converted Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setThumbnailAvif("");
                              setAvifMeta(null);
                            }}
                            className="absolute top-0.5 right-0.5 px-1 py-0.2 bg-black/80 text-white text-[9px] font-bold hover:bg-signal transition-colors cursor-pointer z-10"
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="font-mono text-xl font-bold text-ink">
                          {formData.name.substring(0, 2).toUpperCase() || "TL"}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5 w-full min-w-0 max-w-full overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full max-w-full text-xs font-mono text-ink-dim file:mr-2 sm:file:mr-3 file:py-1.5 file:px-2.5 sm:file:px-3 file:border file:border-hairline file:bg-ink file:text-void file:text-[11px] sm:file:text-xs file:font-mono file:font-bold hover:file:bg-ink-dim file:cursor-pointer cursor-pointer overflow-hidden text-ellipsis"
                      />
                      <div className="flex items-center justify-between text-[10px] text-ink-faint">
                        <span className="break-words max-w-full">
                          {isConvertingAvif ? (
                            <span className="text-signal font-bold animate-pulse">
                              Processing & converting image to .AVIF format...
                            </span>
                          ) : avifMeta ? (
                            <span className="text-emerald-500 font-bold">
                              ✓ Successfully converted image to {avifMeta.format} ({avifMeta.sizeKb} KB)
                            </span>
                          ) : (
                            "Upload any image file to convert it automatically into ultra-compressed .AVIF format."
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Website URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.websiteUrl}
                    onChange={(e) => handleInputChange("websiteUrl", e.target.value)}
                    placeholder="https://synthwave.ai"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* Product Screenshots & Demo Gallery Upload (Auto-Converted to AVIF) */}
                <div className="space-y-3 sm:col-span-2 border border-hairline bg-surface/30 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                    <label className="text-xs font-bold text-ink uppercase flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>Product Screenshots & UI Gallery *</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 border border-signal text-signal uppercase font-bold shrink-0">
                        AUTO-CONVERTED TO .AVIF
                      </span>
                    </label>
                    <span className="text-[10px] text-ink-faint font-mono shrink-0">
                      REQUIRED · AT LEAST 1 · UP TO 4
                    </span>
                  </div>

                  {/* Uploaded Gallery Grid */}
                  {galleryAvif.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1">
                      {galleryAvif.map((imgUrl, idx) => (
                        <div key={idx} className="relative group border border-hairline bg-surface h-24 overflow-hidden">
                          <img src={imgUrl} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(idx)}
                            className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-bold hover:bg-signal transition-colors cursor-pointer z-10"
                          >
                            ✕
                          </button>
                          <span className="absolute bottom-1 left-1 px-1 py-0.2 bg-black/70 text-[9px] text-emerald-400 font-mono">
                            .AVIF
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {galleryAvif.length < 4 && (
                    <div className="pt-1 min-w-0 max-w-full overflow-hidden space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleGalleryUpload}
                          className="flex-1 min-w-0 text-xs font-mono text-ink-dim file:mr-2 sm:file:mr-3 file:py-1.5 file:px-2.5 sm:file:px-3 file:border file:border-hairline file:bg-ink file:text-void file:text-[11px] sm:file:text-xs file:font-mono file:font-bold hover:file:bg-ink-dim file:cursor-pointer cursor-pointer overflow-hidden text-ellipsis"
                        />
                        {formData.websiteUrl && (
                          <button
                            type="button"
                            onClick={handleCaptureScreenshot}
                            disabled={isCapturingScreenshot || !formData.websiteUrl.trim()}
                            className="shrink-0 px-3 py-1.5 border border-hairline bg-surface text-[11px] font-mono font-bold uppercase hover:bg-raised hover:border-ink/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            {isCapturingScreenshot ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-ink-dim border-t-transparent rounded-full animate-spin" />
                                Capturing…
                              </>
                            ) : (
                              <>📸 Capture Homepage</>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-faint font-mono break-words">
                        {isCapturingScreenshot
                          ? "Capturing 1200×630 homepage snapshot and converting to .AVIF…"
                          : isConvertingGallery
                          ? "Converting uploaded screenshots to high-density .AVIF format..."
                          : `Upload up to ${4 - galleryAvif.length} product screenshot images (PNG, JPG, WebP) to display UI previews.`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Product Demo Video Walkthrough URL */}
                <div className="space-y-1.5 sm:col-span-2 border border-hairline bg-surface/30 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                    <label className="text-xs font-bold text-ink uppercase flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>Product Demo Video Walkthrough URL</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 border border-signal text-signal uppercase font-bold shrink-0">
                        FULL-WIDTH PLAYER EMBED
                      </span>
                    </label>
                    <span className="text-[10px] text-ink-faint font-mono shrink-0">
                      OPTIONAL · YOUTUBE / LOOM / VIMEO / MP4
                    </span>
                  </div>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => handleInputChange("videoUrl", e.target.value)}
                    placeholder="e.g. https://www.youtube.com/watch?v=... or https://www.loom.com/share/..."
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                  <p className="text-[10px] text-ink-faint font-mono pt-1 break-words">
                    Provide a YouTube, Loom, Vimeo, or direct video link. It will automatically render in an interactive, responsive full-width video player on your product page.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 02: 360° Overview & Pitch Details */}
            <div id="section-02" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                  02. 360° Overview & Pitch Details
                </h2>
                <span className="text-xs text-ink-faint">TAB 1 SPECS</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">
                      Executive Pitch Summary *
                    </label>
                    <span className={`text-[10px] font-mono tabular-nums ${
                      formData.overviewPitch.length >= 1500
                        ? "text-[#00D97E]"
                        : formData.overviewPitch.length >= 800
                        ? "text-amber-400"
                        : "text-ink-faint"
                    }`}>
                      {formData.overviewPitch.length} / 1500 MIN
                    </span>
                  </div>
                  <textarea
                    rows={10}
                    required
                    value={formData.overviewPitch}
                    onChange={(e) => handleInputChange("overviewPitch", e.target.value)}
                    placeholder="Provide a comprehensive summary of what your product solves and why it matters. Include the core problem, your solution approach, key differentiators, and the impact it delivers. The more detail you provide here, the better your listing will rank and convert. Aim for 1500–2000 characters."
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink leading-relaxed resize-y"
                  />
                  {formData.overviewPitch.length < 1500 && formData.overviewPitch.length > 0 && (
                    <p className="text-[10px] font-mono text-ink-faint">
                      {1500 - formData.overviewPitch.length} more characters needed to meet the minimum.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">Core Features *</label>
                    <span className="text-[10px] font-mono text-ink-faint">{features.length}/20</span>
                  </div>
                  <div className="space-y-2">
                    {features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-ink-faint font-mono shrink-0 w-5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <input
                          type="text"
                          value={feat}
                          onChange={(e) =>
                            setFeatures((prev) =>
                              prev.map((f, idx) => (idx === i ? e.target.value : f))
                            )
                          }
                          placeholder="e.g. Instant sub-second database branching"
                          className="flex-1 px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                        {features.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFeatures((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-[10px] font-mono text-ink-faint hover:text-signal uppercase transition-colors cursor-pointer shrink-0"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {features.length < 20 && (
                    <button
                      type="button"
                      onClick={() => setFeatures((prev) => [...prev, ""])}
                      className="w-full py-2 border border-dashed border-hairline text-[10px] font-mono text-ink-dim uppercase hover:border-ink hover:text-ink transition-colors cursor-pointer"
                    >
                      + Add Feature ({features.length}/20)
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">
                      Target Audience & Ideal Customer Profile
                    </label>
                    <span className={`text-[10px] font-mono tabular-nums ${
                      formData.targetAudience.length >= 300
                        ? "text-signal"
                        : formData.targetAudience.length >= 150
                        ? "text-amber-400"
                        : "text-ink-faint"
                    }`}>
                      {formData.targetAudience.length} / 300
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={formData.targetAudience}
                    onChange={(e) => {
                      if (e.target.value.length <= 300) handleInputChange("targetAudience", e.target.value);
                    }}
                    placeholder="e.g. Indie hackers, AI SaaS founders, and high-throughput dev teams building real-time applications that need sub-10ms latency and zero-downtime deployments."
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink leading-relaxed resize-none"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink-dim uppercase">Pricing Tiers</label>
                    <span className="text-[10px] font-mono text-ink-faint">{pricingTiers.length}/6</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pricingTiers.map((tier, i) => (
                      <div key={i} className="border border-hairline bg-void p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-ink-dim uppercase tracking-wider">
                            Tier {String(i + 1).padStart(2, "0")}
                          </span>
                          {pricingTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPricingTiers((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-[10px] font-mono text-ink-faint hover:text-signal uppercase transition-colors cursor-pointer"
                            >
                              — Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-ink-dim uppercase">Tier Name</label>
                            <input
                              type="text"
                              value={tier.name}
                              onChange={(e) =>
                                setPricingTiers((prev) =>
                                  prev.map((t, idx) => (idx === i ? { ...t, name: e.target.value } : t))
                                )
                              }
                              placeholder="e.g. Free, Pro, Enterprise"
                              className="w-full px-3 py-2 border border-hairline bg-surface text-xs font-mono text-ink focus:outline-none focus:border-ink"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-ink-dim uppercase">Price</label>
                            <input
                              type="text"
                              value={tier.price}
                              onChange={(e) =>
                                setPricingTiers((prev) =>
                                  prev.map((t, idx) => (idx === i ? { ...t, price: e.target.value } : t))
                                )
                              }
                              placeholder="e.g. $29/mo"
                              className="w-full px-3 py-2 border border-hairline bg-surface text-xs font-mono text-ink focus:outline-none focus:border-ink"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-ink-dim uppercase">What&apos;s Included</label>
                          <textarea
                            value={tier.specs}
                            onChange={(e) =>
                              setPricingTiers((prev) =>
                                prev.map((t, idx) => (idx === i ? { ...t, specs: e.target.value } : t))
                              )
                            }
                            placeholder="e.g. 5GB Storage, Community Support, 1M API calls"
                            rows={2}
                            className="w-full px-3 py-2 border border-hairline bg-surface text-xs font-mono text-ink focus:outline-none focus:border-ink resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {pricingTiers.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setPricingTiers((prev) => [...prev, { name: "", price: "", specs: "" }])}
                      className="w-full py-2.5 border border-dashed border-hairline text-[10px] font-mono text-ink-dim uppercase hover:border-ink hover:text-ink transition-colors cursor-pointer"
                    >
                      + Add Pricing Tier ({pricingTiers.length}/6)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section 03: 360° Architecture & Technical Specs */}
            <div id="section-03" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                  03. 360° Architecture & Technical Specs
                </h2>
                <span className="text-xs text-ink-faint">TAB 2 SPECS</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Primary Tech Stack Tags (Comma separated) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.techStack}
                    onChange={(e) => handleInputChange("techStack", e.target.value)}
                    placeholder="Next.js 16, React 19, TypeScript, Rust Engine, Neon Postgres, Tailwind CSS v4"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Infrastructure & Hosting Setup
                  </label>
                  <input
                    type="text"
                    value={formData.infraHosting}
                    onChange={(e) => handleInputChange("infraHosting", e.target.value)}
                    placeholder="Distributed AWS & Vercel Edge Mesh"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Open API / GraphQL Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => handleInputChange("apiUrl", e.target.value)}
                    placeholder="https://api.yourproduct.com/v1/graphql"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Security & Compliance Standards
                  </label>
                  <input
                    type="text"
                    value={formData.securityStandards}
                    onChange={(e) => handleInputChange("securityStandards", e.target.value)}
                    placeholder="SOC2 Type II, Passkey Authentication, End-to-End Encryption"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              </div>
            </div>

            {/* Section 04: 360° Founder Story & Manifesto */}
            <div id="section-04" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                  04. 360° Founder Story & Manifesto
                </h2>
                <span className="text-xs text-ink-faint">TAB 3 SPECS</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Origin Story (Why did you build this?) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.originStory}
                    onChange={(e) => handleInputChange("originStory", e.target.value)}
                    placeholder="Explain the background problem and what motivated you to launch this product."
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Maker Thesis & Product Philosophy *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.makerThesis}
                    onChange={(e) => handleInputChange("makerThesis", e.target.value)}
                    placeholder="Your core engineering or design conviction."
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Section 05: 360° Changelog & Milestones */}
            <div id="section-05" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                  05. 360° Changelog & Milestones
                </h2>
                <span className="text-xs text-ink-faint">TAB 4 SPECS</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Latest Release Version & Title
                  </label>
                  <input
                    type="text"
                    value={formData.latestVersion}
                    onChange={(e) => handleInputChange("latestVersion", e.target.value)}
                    placeholder="v1.2.0 — Production Optimization Update"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Latest Changelog Summary
                  </label>
                  <input
                    type="text"
                    value={formData.latestChangelog}
                    onChange={(e) => handleInputChange("latestChangelog", e.target.value)}
                    placeholder="Reduced vector query latency to 1.8ms"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Q3 2026 Milestone
                  </label>
                  <input
                    type="text"
                    value={formData.roadmapQ3}
                    onChange={(e) => handleInputChange("roadmapQ3", e.target.value)}
                    placeholder="Global Read-Replicas in Tokyo and Frankfurt"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Q4 2026 Milestone
                  </label>
                  <input
                    type="text"
                    value={formData.roadmapQ4}
                    onChange={(e) => handleInputChange("roadmapQ4", e.target.value)}
                    placeholder="Native LLM Function Calling"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              </div>
            </div>

            {/* Section 06: Automated Revenue Provider SDK Integration (OPTIONAL) */}
            <div id="section-06" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                  <span>06. Automated Revenue Provider SDK Integration</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline text-signal uppercase font-bold bg-void">
                    OPTIONAL SECTION
                  </span>
                </h2>
                <span className="text-xs text-ink-faint">TAB 5 SPECS</span>
              </div>

              <div className="space-y-4">
                {/* Toggle Checkbox */}
                <label className="flex items-start gap-3 p-3.5 border border-hairline bg-surface cursor-pointer hover:border-ink transition-colors">
                  <input
                    type="checkbox"
                    checked={enableRevenueSdk}
                    onChange={(e) => {
                      setEnableRevenueSdk(e.target.checked);
                      if (!e.target.checked) {
                        handleInputChange("revenue", "$0 / mo (Pre-Revenue)");
                      }
                    }}
                    className="w-4 h-4 accent-signal cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-ink uppercase">
                      Enable Live Revenue Verification SDK (Optional)
                    </span>
                    <p className="text-[10px] text-ink-dim leading-relaxed">
                      Check this box if your product is generating revenue and you want to connect Stripe, Razorpay, Dodo, Paddle, etc. for verified badge telemetry and live revenue growth charts.
                    </p>
                  </div>
                </label>

                {!enableRevenueSdk ? (
                  <div className="p-3.5 border border-hairline bg-void/50 text-[11px] font-mono text-ink-dim flex items-center justify-between flex-wrap gap-2">
                    <span>Telemetry Status: <strong className="text-ink">$0 / mo (Pre-Revenue Launch)</strong></span>
                    <span className="text-[10px] border border-hairline px-2 py-0.5 text-ink-faint">PRE-REVENUE / UNVERIFIED</span>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {/* Provider Selection & SDK Key Input */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-ink-dim uppercase">
                          Select Payment / Revenue Provider *
                        </label>
                        <BrutalistProviderSelect
                          value={formData.pricingPartner || "stripe"}
                          onChange={(val) => {
                            const selectedProv = REVENUE_PROVIDERS.find(
                              (p) => p.id === val || p.name === val
                            );
                            setFormData((prev) => ({
                              ...prev,
                              pricingPartner: val,
                            }));
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-ink-dim uppercase">
                            Read-Only API Key / Access Token *
                          </label>
                          {(() => {
                            const currProv =
                              REVENUE_PROVIDERS.find(
                                (p) =>
                                  p.id === formData.pricingPartner ||
                                  p.name === formData.pricingPartner
                              ) || REVENUE_PROVIDERS[0];
                            return (
                              <a
                                href={currProv.docUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-ink-faint hover:text-ink underline"
                              >
                                Get {currProv.name} Key ↗
                              </a>
                            );
                          })()}
                        </div>
                        <input
                          type="text"
                          value={formData.apiKey || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              apiKey: e.target.value,
                            }))
                          }
                          placeholder={
                            (
                              REVENUE_PROVIDERS.find(
                                (p) =>
                                  p.id === formData.pricingPartner ||
                                  p.name === formData.pricingPartner
                              ) || REVENUE_PROVIDERS[0]
                            ).placeholder
                          }
                          className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink font-mono"
                        />
                      </div>
                    </div>

                    {/* Provider SDK Specs */}
                    {(() => {
                      const activeProv =
                        REVENUE_PROVIDERS.find(
                          (p) =>
                            p.id === formData.pricingPartner ||
                            p.name === formData.pricingPartner
                        ) || REVENUE_PROVIDERS[0];
                      return (
                        <div className="p-3 border border-hairline bg-void/60 space-y-1 text-[11px] font-mono">
                          <div className="flex items-center justify-between text-ink font-bold">
                            <span className="flex items-center gap-2">
                              <PaymentProviderLogo id={activeProv.id} className="w-4 h-4 shrink-0" />
                              <span>SDK Engine: {activeProv.sdkName}</span>
                            </span>
                            <span className="text-ink-faint">Currency: {activeProv.currency}</span>
                          </div>
                          <p className="text-ink-dim text-[10px]">
                            {activeProv.description}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Execute SDK Handshake Button */}
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-hairline/60">
                      <button
                        type="button"
                        disabled={isExecutingSdk}
                        onClick={async () => {
                          setIsExecutingSdk(true);
                          const activeProvId =
                            formData.pricingPartner?.toLowerCase().includes("razor")
                              ? "razorpay"
                              : formData.pricingPartner?.toLowerCase().includes("dodo")
                              ? "dodopayments"
                              : formData.pricingPartner?.toLowerCase().includes("paddle")
                              ? "paddle"
                              : formData.pricingPartner?.toLowerCase().includes("lemon")
                              ? "lemonsqueezy"
                              : "stripe";

                          try {
                            if (formData.apiKey) {
                              const res = await savePaymentApiKey({
                                provider: activeProvId,
                                apiKey: formData.apiKey,
                              });
                              setFormData((prev) => ({
                                ...prev,
                                revenue: res.mrrFormatted,
                                revenueVerified: true,
                                apiKey: res.apiKey,
                              }));
                              setSdkLog(
                                `${res.telemetryLog}\n\n[ENCRYPTION CONFIRMED] Stored at rest as AES-256-GCM encrypted payload in RevenueConnection DB.`
                              );
                            } else {
                              const res = await fetchLiveRevenueFromSDK(
                                activeProvId,
                                ""
                              );
                              setFormData((prev) => ({
                                ...prev,
                                revenue: res.mrrFormatted,
                                revenueVerified: true,
                              }));
                              setSdkLog(res.sdkHandshakeLog);
                            }
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : "SDK Handshake failed";
                            setSdkLog(`[ERROR] ${msg}`);
                          } finally {
                            setIsExecutingSdk(false);
                          }
                        }}
                        className="px-4 py-2 bg-ink text-void text-xs font-bold uppercase hover:bg-ink-dim transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isExecutingSdk ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-[#00D97E] animate-pulse" />
                            <span>Executing SDK Handshake...</span>
                          </>
                        ) : (
                          <span>
                            Fetch & Verify Live MRR via{" "}
                            {(
                              REVENUE_PROVIDERS.find(
                                (p) =>
                                  p.id === formData.pricingPartner ||
                                  p.name === formData.pricingPartner
                              ) || REVENUE_PROVIDERS[0]
                            ).name}{" "}
                            SDK
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-2 px-3 py-1.5 border border-hairline bg-void text-xs font-mono">
                        <span className="w-2 h-2 rounded-full bg-[#00D97E] animate-pulse shrink-0" />
                        <span className="text-ink-faint">MRR Status:</span>
                        <span className="text-ink font-bold">
                          {formData.revenue
                            ? `VERIFIED (${formData.revenue})`
                            : "READY FOR SDK HANDSHAKE"}
                        </span>
                      </div>
                    </div>

                    {sdkLog && (
                      <div className="p-3 border border-hairline bg-void text-[10px] font-mono text-[#00D97E] whitespace-pre-wrap leading-relaxed">
                        {sdkLog}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 07: 360° FAQ & Support */}
            <div id="section-07" className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                  07. 360° FAQ & Support
                </h2>
                <span className="text-xs text-ink-faint">TAB 6 SPECS</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-hairline bg-void p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-ink-dim uppercase tracking-wider">
                          Q{String(i + 1).padStart(2, "0")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-[10px] font-mono text-ink-faint hover:text-signal uppercase transition-colors cursor-pointer"
                        >
                          — Remove
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-ink-dim uppercase">Question</label>
                        <input
                          type="text"
                          value={faq.q}
                          onChange={(e) =>
                            setFaqs((prev) =>
                              prev.map((f, idx) => (idx === i ? { ...f, q: e.target.value } : f))
                            )
                          }
                          placeholder="e.g. How does pricing work?"
                          className="w-full px-3 py-2 border border-hairline bg-surface text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-ink-dim uppercase">Answer</label>
                        <textarea
                          value={faq.a}
                          onChange={(e) =>
                            setFaqs((prev) =>
                              prev.map((f, idx) => (idx === i ? { ...f, a: e.target.value } : f))
                            )
                          }
                          placeholder="e.g. We charge per seat, starting at $0 for solo builders..."
                          rows={2}
                          className="w-full px-3 py-2 border border-hairline bg-surface text-xs font-mono text-ink focus:outline-none focus:border-ink resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {faqs.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setFaqs((prev) => [...prev, { q: "", a: "" }])}
                    className="w-full py-2.5 border border-dashed border-hairline text-[10px] font-mono text-ink-dim uppercase hover:border-ink hover:text-ink transition-colors cursor-pointer"
                  >
                    + Add Question ({faqs.length}/10)
                  </button>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ink-dim uppercase">
                    Support Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.supportEmail}
                    onChange={(e) => handleInputChange("supportEmail", e.target.value)}
                    placeholder="support@yourproduct.com"
                    className="w-full px-3 py-2 border border-hairline bg-void text-xs font-mono text-ink focus:outline-none focus:border-ink"
                  />
                </div>
              </div>
            </div>

            {/* Launch Pricing Tier Selection — hidden when editing an existing product */}
            {!isEmbeddedMode && (
              <div className="border border-hairline bg-surface/30 p-4 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                  <h2 className="font-mono text-sm sm:text-base font-bold text-ink uppercase tracking-wider">
                    Launch Pricing
                  </h2>
                  <span className="text-xs text-ink-faint">SELECT A TIER</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* $0 Tier */}
                  <button
                    type="button"
                    onClick={() => setLaunchTier(0)}
                    className={`p-5 border text-left space-y-3 transition-colors cursor-pointer ${
                      launchTier === 0
                        ? "border-signal/40 bg-signal/5"
                        : "border-hairline bg-void hover:border-ink/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-ink">$0</span>
                      {launchTier === 0 && (
                        <span className="text-[10px] font-bold text-signal uppercase px-2 py-0.5 border border-signal/30 bg-signal/10 font-mono">SELECTED</span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-dim space-y-2">
                      <p className="font-bold text-signal uppercase text-[10px]">Free Launch · 100% Free Forever</p>
                      <ul className="space-y-1 text-ink-dim">
                        <li className="text-ink font-bold flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>Auto-Broadcast to 𝕏, Telegram &amp; WhatsApp</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>2 permanent indexable pages (360° Specs &amp; Profile)</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>Permanent high-authority dofollow backlink</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>Queued for next 6:00 AM IST (00:30 UTC) drop</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>Community upvotes, reviews &amp; revenue charts</span>
                        </li>
                      </ul>
                    </div>
                  </button>

                  {/* $5 Tier - Featured Launch */}
                  <button
                    type="button"
                    onClick={() => setLaunchTier(5)}
                    className={`p-5 border text-left space-y-3 transition-colors cursor-pointer relative ${
                      launchTier === 5
                        ? "border-signal bg-signal/5"
                        : "border-hairline bg-void hover:border-signal/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-signal">$5</span>
                        <span className="text-[9px] font-mono font-bold text-signal px-1.5 py-0.5 border border-signal/30 bg-signal/10 uppercase">
                          DODO CHECKOUT
                        </span>
                      </div>
                      {launchTier === 5 && (
                        <span className="text-[10px] font-bold text-signal uppercase px-2 py-0.5 border border-signal/30 bg-signal/10 font-mono">SELECTED</span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-dim space-y-1.5">
                      <p className="font-bold text-signal uppercase text-[10px]">Featured Launch (30 Days)</p>
                      <ul className="space-y-1">
                        <li className="flex items-center gap-1.5 text-ink">
                          <span className="text-signal">✓</span>
                          <span>Everything in Free (Permanent pages &amp; link)</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-ink">
                          <span className="text-signal">✓</span>
                          <span className="text-signal font-bold">Header floating section placement</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>Instant activation for 30 continuous days</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-signal">✓</span>
                          <span>Track time &amp; analytics in personal profile</span>
                        </li>
                      </ul>
                    </div>
                  </button>

                  {/* $10 Tier - Premium Spotlight */}
                  <button
                    type="button"
                    onClick={() => setLaunchTier(10)}
                    className={`p-5 border text-left space-y-3 transition-colors cursor-pointer relative ${
                      launchTier === 10
                        ? "border-accent bg-accent/5"
                        : "border-hairline bg-void hover:border-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-ink">$10</span>
                        <span className="text-[9px] font-mono font-bold text-[#38BDF8] px-1.5 py-0.5 border border-[#38BDF8]/30 bg-[#38BDF8]/10 uppercase">
                          DODO CHECKOUT
                        </span>
                      </div>
                      {launchTier === 10 && (
                        <span className="text-[10px] font-bold text-[#38BDF8] uppercase px-2 py-0.5 border border-[#38BDF8]/30 bg-[#38BDF8]/10 font-mono">SELECTED</span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-dim space-y-1.5">
                      <p className="font-bold text-ink uppercase text-[10px]">Premium Spotlight (30 Days)</p>
                      <ul className="space-y-1">
                        <li className="flex items-center gap-1.5 text-ink">
                          <span className="text-[#38BDF8]">✓</span>
                          <span>Everything in Free (Permanent pages &amp; link)</span>
                        </li>
                        <li className="flex items-center gap-1.5 text-ink">
                          <span className="text-[#38BDF8]">✓</span>
                          <span className="text-[#38BDF8] font-bold">Alternating 15s spotlight next to search/submit</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-[#38BDF8]">✓</span>
                          <span>Instant activation for 30 continuous days</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-[#38BDF8]">✓</span>
                          <span>Track time &amp; analytics in personal profile</span>
                        </li>
                      </ul>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Submit Action Bar */}
            <div id="submit-action" className="space-y-4 p-4 sm:p-6 border border-hairline bg-surface/50 max-w-full overflow-hidden box-border">
              <div className="text-xs text-ink-dim w-full space-y-3">
                <p>
                  {isEditMode
                    ? "Update and save your live product details instantly."
                    : "By submitting, your product will be reviewed and scheduled for the daily release queue."}
                </p>
                
                {/* Authorization & Ownership Confirmation Checkbox — Only required for NEW product submissions */}
                {!isEmbeddedMode && (
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink text-left select-none pt-2.5 border-t border-hairline">
                    <input
                      type="checkbox"
                      checked={isAuthorizedConfirmed}
                      onChange={(e) => setIsAuthorizedConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-signal bg-void border border-hairline rounded-none shrink-0 cursor-pointer"
                      required
                    />
                    <span className="leading-relaxed">
                      I confirm that I am authorized to submit this product and that I am the owner or official representative of <strong className="text-ink font-bold">{formData.name || "this product"}</strong>.
                    </span>
                  </label>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full pt-1">
                {!isEmbeddedMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("preview");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 border border-hairline bg-surface hover:bg-raised text-ink text-xs font-bold uppercase transition-colors cursor-pointer text-center justify-center flex items-center shrink-0"
                  >
                    Inspect Live 360° Preview ↗
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || (!isEmbeddedMode && !isAuthorizedConfirmed)}
                  className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.99] ${
                    isSubmitting
                      ? "bg-signal text-void opacity-95 cursor-wait"
                      : isEmbeddedMode || isAuthorizedConfirmed
                      ? "bg-signal text-void hover:bg-signal/90 cursor-pointer shadow-sm"
                      : "bg-surface text-ink-faint border border-hairline cursor-not-allowed opacity-60"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-void shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>{isEditMode ? "Saving Updates..." : "Dispatching Shipment..."}</span>
                    </>
                  ) : (
                    <>
                      <PixelatedShipmentBox className="w-4 h-4 text-current shrink-0" />
                      <span>{isEditMode ? "Save Product Updates →" : "Submit Product Shipment"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {!submitted && activeTab === "preview" && (
          /* Live 360° Product Page Preview */
          <div className="space-y-6 border border-signal/40 p-4 sm:p-8 bg-surface/20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
              <div className="text-xs font-bold text-signal uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
                <span>LIVE 360° PRODUCT PAGE PREVIEW</span>
              </div>
              <button
                onClick={() => {
                  setActiveTab("builder");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-xs text-ink-dim hover:text-ink underline cursor-pointer"
              >
                ← Return to Form Builder
              </button>
            </div>

            {/* Simulated Live Product Hero */}
            <div className="border border-hairline bg-surface/40 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="w-16 h-16 bg-surface border border-hairline flex items-center justify-center font-mono text-xl font-bold text-ink shrink-0 overflow-hidden relative">
                  {thumbnailAvif ? (
                    <img
                      src={thumbnailAvif}
                      alt="Product AVIF Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    formData.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="space-y-1 w-full min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-ink break-words">{formData.name || "Product Name"}</h1>
                  <p className="text-xs text-ink-dim max-w-xl break-words">{formData.tagline || "Tagline will appear here"}</p>
                  <div className="text-[11px] text-ink-faint flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <span>Category: {formData.category}</span>
                    <span>·</span>
                    <span>Maker: {formData.makerName} ({formData.makerHandle})</span>
                    <span>·</span>
                    <span className="text-signal font-bold">{formData.revenue}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview Full-Width Video Demo */}
            {formData.videoUrl && (
              <div className="border border-hairline bg-surface/30 p-4 sm:p-6 space-y-3">
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <h2 className="font-mono text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                    <span>Product Video Demo &amp; Walkthrough</span>
                  </h2>
                  <span className="text-[10px] font-mono text-signal">FULL-WIDTH EMBED ↗</span>
                </div>
                <div className="overflow-hidden rounded-xs border border-hairline bg-black">
                  {(() => {
                    const url = formData.videoUrl;
                    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                    if (ytMatch) {
                      return (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${ytMatch[1]}`}
                          title="Product Video Demo"
                          className="w-full aspect-video rounded-xs border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    }
                    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
                    if (loomMatch) {
                      return (
                        <iframe
                          src={`https://www.loom.com/embed/${loomMatch[1]}`}
                          title="Product Video Walkthrough"
                          className="w-full aspect-video rounded-xs border-0"
                          allowFullScreen
                        />
                      );
                    }
                    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
                    if (vimeoMatch) {
                      return (
                        <iframe
                          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                          title="Product Video Demo"
                          className="w-full aspect-video rounded-xs border-0"
                          allowFullScreen
                        />
                      );
                    }
                    return (
                      <video
                        src={url}
                        controls
                        className="w-full aspect-video rounded-xs object-contain bg-black"
                      />
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 360° Intelligence Suite Vertical Continuous Preview */}
            <div className="space-y-6">
              {/* SECTION 01: OVERVIEW & PITCH */}
              <div className="border border-hairline bg-surface/30 p-6 space-y-4 font-mono text-xs">
                <div className="border-b border-hairline pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                    01. Overview & Pitch Details
                  </h2>
                  <span className="text-[10px] text-ink-faint">SECTION 01 / 05</span>
                </div>

                <div className="space-y-4 leading-relaxed">
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-ink uppercase">Executive Pitch Summary</h3>
                    <div className="space-y-3 text-ink-dim leading-relaxed font-mono text-xs whitespace-pre-line">
                      {formData.overviewPitch ? (
                        formData.overviewPitch.split(/\n\s*\n/).map((para, idx) => (
                          <p key={idx} className="leading-relaxed">
                            {para.trim()}
                          </p>
                        ))
                      ) : (
                        <p className="italic text-ink-faint">No Executive Pitch Summary provided.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-hairline">
                    <h3 className="font-bold text-ink uppercase">Core Value Propositions</h3>
                    <ul className="space-y-1 text-ink-dim">
                      {features.filter(Boolean).map((f, i) => (
                        <li key={i}>· {f}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Uploaded Product Screenshots Gallery */}
                  {galleryAvif.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-hairline">
                      <h3 className="font-bold text-ink uppercase flex items-center justify-between">
                        <span>Product Screenshots & UI Previews</span>
                        <span className="text-[10px] text-emerald-500 font-mono font-normal font-bold">
                          {galleryAvif.length} IMAGE(S) · AUTO-CONVERTED TO .AVIF
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {galleryAvif.map((imgUrl, idx) => (
                          <div key={idx} className="border border-hairline bg-surface h-32 overflow-hidden relative">
                            <img src={imgUrl} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-[9px] font-mono">
                              .AVIF
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.targetAudience && (
                    <div className="space-y-1.5 pt-2 border-t border-hairline">
                      <h3 className="font-bold text-ink uppercase">Target Audience & ICP</h3>
                      <div className="space-y-2 text-ink-dim leading-relaxed whitespace-pre-line">
                        {formData.targetAudience.split(/\n\s*\n/).map((para, idx) => (
                          <p key={idx} className="leading-relaxed">
                            {para.trim()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {pricingTiers.filter((t) => t.name || t.price || t.specs).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-hairline">
                      {pricingTiers.filter((t) => t.name || t.price || t.specs).map((tier, i) => (
                        <div
                          key={i}
                          className={`p-3 space-y-1 ${i === 1 ? "border border-ink bg-surface/50" : "border border-hairline bg-surface/20"}`}
                        >
                          <h4 className={`font-bold uppercase text-[10px] ${i === 1 ? "text-signal" : "text-ink"}`}>
                            {tier.name || `Tier ${i + 1}`}
                          </h4>
                          {tier.price && (
                            <p className={`font-bold text-sm ${i === 1 ? "text-signal" : "text-ink"}`}>{tier.price}</p>
                          )}
                          <p className="text-ink-dim text-[11px]">{tier.specs}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!isStepSkipped(3) && (
              <div className="border border-hairline bg-surface/30 p-6 space-y-4 font-mono text-xs">
                <div className="border-b border-hairline pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                    02. Architecture & Specs
                  </h2>
                  <span className="text-[10px] text-ink-faint">SECTION 02 / 05</span>
                </div>

                <div className="space-y-4 leading-relaxed">
                  <div className="space-y-2">
                    <h3 className="font-bold text-ink uppercase">Primary Tech Stack</h3>
                    <div className="flex gap-2 flex-wrap">
                      {formData.techStack.split(",").map((tech, i) => (
                        <span key={i} className="px-2 py-0.5 border border-hairline bg-surface text-ink font-bold">
                          {tech.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-hairline">
                    <div>
                      <h4 className="font-bold text-ink uppercase text-[11px]">Infrastructure & Mesh</h4>
                      <p className="text-ink-dim mt-0.5">{formData.infraHosting || "Distributed Cloud Multi-Region"}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-ink uppercase text-[11px]">Security & Compliance</h4>
                      <p className="text-ink-dim mt-0.5">{formData.securityStandards || "SOC2 Type II & Passkey Auth"}</p>
                    </div>
                  </div>

                  {formData.apiUrl && (
                    <div className="pt-2 border-t border-hairline">
                      <h4 className="font-bold text-ink uppercase text-[11px]">Open API Endpoint</h4>
                      <p className="text-signal font-mono text-[11px] mt-0.5">{formData.apiUrl}</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {!isStepSkipped(4) && (
              <div className="border border-hairline bg-surface/30 p-6 space-y-4 font-mono text-xs">
                <div className="border-b border-hairline pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                    03. Founder Story & Manifesto
                  </h2>
                  <span className="text-[10px] text-ink-faint">SECTION 03 / 05</span>
                </div>

                <div className="space-y-4 leading-relaxed">
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-ink uppercase">Origin Story</h3>
                    <div className="space-y-2 text-ink-dim leading-relaxed whitespace-pre-line">
                      {formData.originStory ? (
                        formData.originStory.split(/\n\s*\n/).map((para, idx) => (
                          <p key={idx} className="leading-relaxed">
                            {para.trim()}
                          </p>
                        ))
                      ) : (
                        <p className="italic text-ink-faint">No Origin Story provided.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-hairline">
                    <h3 className="font-bold text-ink uppercase">Maker Thesis</h3>
                    <div className="space-y-2 text-ink-dim leading-relaxed italic whitespace-pre-line">
                      {formData.makerThesis ? (
                        formData.makerThesis.split(/\n\s*\n/).map((para, idx) => (
                          <p key={idx} className="leading-relaxed">
                            &ldquo;{para.trim()}&rdquo;
                          </p>
                        ))
                      ) : (
                        <p className="italic text-ink-faint">No Maker Thesis provided.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-hairline text-ink-faint">
                    <span>Maker Attribution: </span>
                    <strong className="text-ink">{formData.makerName}</strong> ({formData.makerHandle})
                  </div>
                </div>
              </div>
              )}

              {!isStepSkipped(5) && (
              <div className="border border-hairline bg-surface/30 p-6 space-y-4 font-mono text-xs">
                <div className="border-b border-hairline pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                    04. Changelog & Roadmap
                  </h2>
                  <span className="text-[10px] text-ink-faint">SECTION 04 / 05</span>
                </div>

                <div className="space-y-4 leading-relaxed">
                  <div className="p-3 border border-hairline bg-surface/50 space-y-1">
                    <div className="flex items-center justify-between text-ink font-bold">
                      <h4 className="font-bold text-signal uppercase text-[11px]">{formData.latestVersion || "v1.0.0 Initial Release"}</h4>
                      <span className="text-[10px] text-signal uppercase font-bold">LATEST DEPLOYMENT</span>
                    </div>
                    <p className="text-ink-dim">{formData.latestChangelog}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-hairline">
                    <div className="p-3 border border-hairline bg-void/50 space-y-1">
                      <h4 className="font-bold text-ink uppercase text-[11px]">Q3 2026 Milestone</h4>
                      <p className="text-ink-dim">{formData.roadmapQ3 || "Global Read Replicas"}</p>
                    </div>
                    <div className="p-3 border border-hairline bg-void/50 space-y-1">
                      <h4 className="font-bold text-ink uppercase text-[11px]">Q4 2026 Milestone</h4>
                      <p className="text-ink-dim">{formData.roadmapQ4 || "Autonomous Agent Swarms"}</p>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {!isStepSkipped(6) && (
              <div className="border border-hairline bg-surface/30 p-6 space-y-4 font-mono text-xs">
                <div className="border-b border-hairline pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                    05. FAQ & Support
                  </h2>
                  <span className="text-[10px] text-ink-faint">SECTION 05 / 05</span>
                </div>

                <div className="space-y-4 leading-relaxed">
                  <div className="space-y-3">
                    {faqs.filter((f) => f.q || f.a).map((faq, i) => (
                      <div key={i} className={`space-y-1 ${i > 0 ? "pt-2 border-t border-hairline" : ""}`}>
                        <h4 className="font-bold text-ink uppercase">Q: {faq.q || <span className="text-ink-faint italic normal-case font-normal">No question set</span>}</h4>
                        <p className="text-ink-dim pl-3 border-l-2 border-hairline">{faq.a || <span className="text-ink-faint italic">No answer set</span>}</p>
                      </div>
                    ))}
                    {faqs.filter((f) => f.q || f.a).length === 0 && (
                      <p className="text-ink-faint text-xs italic">No FAQ entries added yet.</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-hairline text-ink-faint">
                    <span>Support Contact: </span>
                    <a href={`mailto:${formData.supportEmail}`} className="text-signal underline font-bold">
                      {formData.supportEmail}
                    </a>
                  </div>
                </div>
              </div>
              )}
            </div>

            <div className="pt-4 flex justify-end w-full">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.99] ${
                  isSubmitting
                    ? "bg-signal text-void opacity-95 cursor-wait"
                    : "bg-signal text-void hover:bg-signal/90 cursor-pointer"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-void shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>{isEditMode ? "Saving Updates..." : "Dispatching Shipment..."}</span>
                  </>
                ) : (
                  <>
                    <PixelatedShipmentBox className="w-4 h-4 text-void shrink-0" />
                    <span>{isEditMode ? "Save Product Updates →" : "Confirm & Submit Launch"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── LIVE SHIPMENT SUBMISSION ANIMATION OVERLAY ─── */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-mono animate-in fade-in duration-200">
            <div className="bg-void border-2 border-signal max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-signal animate-ping" />
                  <span className="text-xs font-bold text-signal uppercase tracking-wider">
                    {isEditMode ? "SYNCING PRODUCT UPDATES" : "DISPATCHING PRODUCT SHIPMENT"}
                  </span>
                </div>
                <span className="text-[10px] text-ink-dim font-mono animate-pulse">
                  BROADCASTING...
                </span>
              </div>

              {/* Visual Icon / Radar Pulse */}
              <div className="py-4 flex flex-col items-center justify-center space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border border-signal/30 animate-ping absolute" />
                  <div className="w-16 h-16 bg-surface border border-signal flex items-center justify-center relative shadow-lg">
                    <LaunchFeedLogo size={32} />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                    {formData.name || "Product"}
                  </h3>
                  <p className="text-xs text-ink-dim">
                    {isEditMode ? "Applying updates to live database..." : "Publishing to The Launch Feed queue..."}
                  </p>
                </div>
              </div>

              {/* Stepped Progress Checklist */}
              <div className="space-y-2.5 border border-hairline bg-surface/40 p-3.5 text-xs text-ink-dim">
                <div className="flex items-center gap-2 text-ink font-bold">
                  <span className="text-signal font-bold">✔</span>
                  <span>Optimizing metadata & AVIF media pipeline</span>
                </div>
                <div className="flex items-center gap-2 text-ink font-bold">
                  <span className="text-signal font-bold">✔</span>
                  <span>Generating tamper-proof slug & category links</span>
                </div>
                <div className="flex items-center gap-2 text-signal font-bold animate-pulse">
                  <span>●</span>
                  <span>Transacting with Neon Postgres & Inngest queues...</span>
                </div>
              </div>

              {/* High-Tech Segmented Loading Bar */}
              <div className="space-y-1.5">
                <div className="h-1.5 w-full bg-surface border border-hairline overflow-hidden">
                  <div className="h-full bg-signal w-full animate-pulse transition-all" />
                </div>
                <div className="flex justify-between text-[10px] text-ink-dim">
                  <span>STAGE: INGESTION</span>
                  <span>SUB-SECOND TELEMETRY</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (isEmbeddedMode) {
    return formContent;
  }

  return (
    <MainLayoutShell leftSidebar={progressSidebar}>
      {formContent}
    </MainLayoutShell>
  );
}
