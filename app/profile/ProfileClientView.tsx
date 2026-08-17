"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MainLayoutShell from "@/app/MainLayoutShell";
import {
  getStoredSession,
  logoutSession,
  saveSession,
  UserSession,
  slugify,
} from "@/app/data";
import { authClient } from "@/lib/auth-client";
import { updateProfile, listMyProducts, type MyProduct } from "@/app/actions/profile";
import { savePaymentApiKey, getPaymentApiKeys } from "@/app/actions/revenue";
import { resubmitSubmission } from "@/app/actions/submissions";
import { listCategories } from "@/app/actions/categories";
import {
  batchHydrateSavedAndUpvoted,
  toggleBookmark,
  type InteractionProduct,
} from "@/app/actions/interactions";
import { FounderProfileContent } from "@/app/founder/[slug]/FounderClientView";
import { formatReleaseUtcWithIst } from "@/lib/schedule";
import {
  REVENUE_PROVIDERS,
  PaymentProviderLogo,
} from "@/app/lib/revenueTelemetrySDK";
import EmbeddableAwardWidget from "@/app/components/EmbeddableAwardWidget";
import SubmitClientView from "@/app/submit/SubmitClientView";

/* ─────────────────────────────────────────────────
   ProfileClientView — Founder Dashboard & Profile
   ───────────────────────────────────────────────── */
export default function ProfileClientView({
  initialProducts = [],
  initialSavedProducts = [],
  initialUpvotedProducts = [],
  isAdmin: initialIsAdmin = false,
}: {
  initialProducts?: MyProduct[];
  initialSavedProducts?: InteractionProduct[];
  initialUpvotedProducts?: InteractionProduct[];
  isAdmin?: boolean;
}) {
  const [session, setSession] = useState<UserSession | null>(null);
  const isAdmin = initialIsAdmin || session?.role === "admin";
  const [activeTab, setActiveTab] = useState<
    "products" | "subscriptions" | "saved" | "settings"
  >("products");
  const [isPreviewing, setIsPreviewing] = useState(false);

  /* Form states — kept separate so unsaved edits survive preview toggle */
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [revenue, setRevenue] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [github, setGithub] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [image, setImage] = useState<string>("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Rejected-product resubmission form state (keyed by submissionId)
  const [resubmitOpenFor, setResubmitOpenFor] = useState<string | null>(null);
  const [resubmitForm, setResubmitForm] = useState({
    name: "",
    tagline: "",
    description: "",
    websiteUrl: "",
    categorySlug: "",
  });
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ slug: string; name: string }>>([]);
  useEffect(() => {
    listCategories()
      .then((cs) =>
        setCategoryOptions(cs.map((c: { slug: string; name: string }) => ({ slug: c.slug, name: c.name }))),
      )
      .catch(() => setCategoryOptions([]));
  }, []);

  const openResubmit = (p: MyProduct) => {
    if (!p.submissionId) return;
    setResubmitError(null);
    setResubmitForm({
      name: p.name,
      tagline: p.tagline,
      description: "",
      websiteUrl: "",
      categorySlug: p.category !== "uncategorized" ? p.category : "",
    });
    setResubmitOpenFor(p.submissionId);
  };

  const submitResubmit = async (submissionId: string) => {
    if (resubmitting) return;
    setResubmitError(null);
    if (!resubmitForm.name.trim() || !resubmitForm.tagline.trim()) {
      setResubmitError("Name and tagline are required.");
      return;
    }
    setResubmitting(true);
    try {
      await resubmitSubmission({
        submissionId,
        name: resubmitForm.name.trim(),
        tagline: resubmitForm.tagline.trim(),
        description: resubmitForm.description.trim() || undefined,
        websiteUrl: resubmitForm.websiteUrl.trim(),
        categorySlug: resubmitForm.categorySlug || undefined,
      });
      setResubmitOpenFor(null);
      // Re-fetch the list so the row flips back to SCHEDULED
      try {
        const rows = await listMyProducts();
        setProductsList(rows);
      } catch {
        /* leave stale until next visit */
      }
    } catch (err) {
      setResubmitError(err instanceof Error ? err.message : "Could not resubmit");
    } finally {
      setResubmitting(false);
    }
  };
  const [paymentProvider, setPaymentProvider] = useState<string>("stripe");
  const [stripeApiKey, setStripeApiKey] = useState(
    REVENUE_PROVIDERS[0].sampleKey
  );
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [paymentsSuccess, setPaymentsSuccess] = useState(false);
  const [telemetryLog, setTelemetryLog] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeEmbedProductId, setActiveEmbedProductId] = useState<number | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [confirmedReadOnly, setConfirmedReadOnly] = useState(false);

  /* Product Detail Editing States */
  const [productsList, setProductsList] = useState<any[]>(() => initialProducts);
  const [loadingProducts, setLoadingProducts] = useState(initialProducts.length === 0);
  const [savedProductsState, setSavedProductsState] = useState<InteractionProduct[]>(() => initialSavedProducts);
  const [upvotedProductsState, setUpvotedProductsState] = useState<InteractionProduct[]>(() => initialUpvotedProducts);
  const [loadingSaved, setLoadingSaved] = useState(initialSavedProducts.length === 0);
  const [loadingUpvoted, setLoadingUpvoted] = useState(initialUpvotedProducts.length === 0);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productSaveSuccess, setProductSaveSuccess] = useState(false);

  /* Dodo Subscriptions & Placements State */
  const [activeSlots, setActiveSlots] = useState<any[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [isUpgradingProduct, setIsUpgradingProduct] = useState<string>("");
  const [checkoutSuccessNotice, setCheckoutSuccessNotice] = useState(false);

  const fetchSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const res = await fetch("/api/user/subscriptions");
      const data = await res.json();
      if (data.slots) {
        setActiveSlots(data.slots);
      }
    } catch (e) {
      console.error("Failed to load subscriptions:", e);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const triggerDodoCheckout = async (productId: string, tier: 5 | 10) => {
    try {
      setIsUpgradingProduct(`${productId}-${tier}`);
      const res = await fetch("/api/checkout/dodo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, tier }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        alert(data.message || "Could not initialize Dodo Payments checkout.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to start Dodo checkout session.");
    } finally {
      setIsUpgradingProduct("");
    }
  };



  // Track which session ids we've already used to seed the form so that
  // background /api/me refetches (SessionBridge on window focus, etc.)
  // don't clobber in-progress edits — a freshly uploaded profile picture
  // was disappearing on window focus because populateForm reset `image`
  // back to the DB's old value.
  const initializedForSessionId = useRef<string | null>(null);

  // Parse URL tab & checkout status
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam === "subscriptions" || tabParam === "saved" || tabParam === "settings" || tabParam === "products") {
        setActiveTab(tabParam as any);
      }
      if (urlParams.get("checkout") === "success") {
        setCheckoutSuccessNotice(true);
        setActiveTab("subscriptions");
        const purchaseId = urlParams.get("purchaseId");
        const paymentId = urlParams.get("payment_id");
        const productId = urlParams.get("productId");
        const tier = urlParams.get("tier");
        if (productId && tier) {
          fetch("/api/checkout/dodo/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purchaseId, paymentId, productId, tier }),
          })
            .then(() => fetchSubscriptions())
            .catch(() => {});
        }
      }
    }
  }, []);

  // Fetch subscriptions whenever the subscriptions tab is opened
  useEffect(() => {
    if (activeTab === "subscriptions") {
      fetchSubscriptions();
    }
  }, [activeTab]);
  const populateForm = (s?: UserSession | null) => {
    if (!s) return;
    setName(s.name || "");
    setTitle(s.title || "");
    setBio(s.bio || "");
    // Revenue is NOT populated from session — it must be synced via payment API
    setRevenue(s.revenue && s.revenue !== "$0" ? s.revenue : "");
    setWebsite(s.website || "");
    setTwitter(s.twitter || "");
    setGithub(s.github || "");
    setApiKey(s.apiKey || "");
    setImage(s.image || "");
  };

  const seedFormOnce = (s: UserSession) => {
    if (initializedForSessionId.current === s.id) return;
    initializedForSessionId.current = s.id;
    populateForm(s);
  };

  useEffect(() => {
    const current = getStoredSession();
    if (current) {
      setSession(current);
      seedFormOnce(current);
    }
    // Always fetch /api/me on mount to refresh fresh saved/upvoted IDs from server
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.session) {
          saveSession(data.session);
          setSession(data.session);
          seedFormOnce(data.session);
        }
      })
      .catch(() => {});

    const handleAuthChange = (e: Event) => {
      const customEv = e as CustomEvent<UserSession | null>;
      const s = customEv.detail !== undefined ? customEv.detail : getStoredSession();
      if (s) {
        setSession(s);
        seedFormOnce(s); // only seeds first time; ignored on every refresh after
      } else {
        setSession(null);
        initializedForSessionId.current = null;
      }
    };
    window.addEventListener("authChanged", handleAuthChange);
    return () => window.removeEventListener("authChanged", handleAuthChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadSavedPaymentKeys() {
      try {
        const keys = await getPaymentApiKeys();
        if (keys && keys.length > 0) {
          const latest = keys[0];
          setPaymentProvider(latest.provider.toLowerCase());
          if (latest.apiKey) {
            setStripeApiKey(latest.apiKey);
          }
          if (latest.revenues && latest.revenues.length > 0) {
            setRevenue(latest.revenues[0].mrrFormatted);
          }
        }
      } catch {
        // user might not be logged in or has no saved keys yet
      }
    }
    loadSavedPaymentKeys();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyProducts();
        if (cancelled) return;
        setProductsList(rows);
        try {
          sessionStorage.setItem("tlf-my-products", JSON.stringify(rows));
        } catch {}
      } catch {
        // preserve current list if error
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.id]);

  const lastSavedIdsKey = useRef<string>(
    initialSavedProducts.map((p) => p.id).sort().join(",")
  );
  const lastUpvotedIdsKey = useRef<string>(
    initialUpvotedProducts.map((p) => p.id).sort().join(",")
  );

  const savedIdsJoined = (session?.savedProductIds || []).slice().sort().join(",");
  const upvotedIdsJoined = (session?.upvotedProductIds || []).slice().sort().join(",");

  // Hydrate the Saved and Upvoted tabs with single batched query & instant deduplication
  useEffect(() => {
    if (!session) {
      if (initialSavedProducts.length === 0) setSavedProductsState([]);
      if (initialUpvotedProducts.length === 0) setUpvotedProductsState([]);
      setLoadingSaved(false);
      setLoadingUpvoted(false);
      return;
    }

    const savedIds = session.savedProductIds || [];
    const upvotedIds = session.upvotedProductIds || [];

    const needsSaved =
      savedIdsJoined !== lastSavedIdsKey.current ||
      (savedProductsState.length === 0 && savedIds.length > 0);
    const needsUpvoted =
      upvotedIdsJoined !== lastUpvotedIdsKey.current ||
      (upvotedProductsState.length === 0 && upvotedIds.length > 0);

    if (!needsSaved && !needsUpvoted) {
      setLoadingSaved(false);
      setLoadingUpvoted(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (needsSaved) setLoadingSaved(true);
        if (needsUpvoted) setLoadingUpvoted(true);

        const { saved, upvoted } = await batchHydrateSavedAndUpvoted(
          savedIds,
          upvotedIds
        );

        if (cancelled) return;

        if (needsSaved) {
          lastSavedIdsKey.current = savedIdsJoined;
          setSavedProductsState(saved);
          try {
            sessionStorage.setItem("tlf-saved-products", JSON.stringify(saved));
          } catch {}
        }

        if (needsUpvoted) {
          lastUpvotedIdsKey.current = upvotedIdsJoined;
          setUpvotedProductsState(upvoted);
          try {
            sessionStorage.setItem("tlf-upvoted-products", JSON.stringify(upvoted));
          } catch {}
        }
      } catch {
        /* leave existing state */
      } finally {
        if (!cancelled) {
          setLoadingSaved(false);
          setLoadingUpvoted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIdsJoined, upvotedIdsJoined, session?.id]);

  const handleSaveFromSubmitForm = (productId: any, updatedFields: any) => {
    setProductsList((prev) =>
      prev.map((item) =>
        String(item.id) === String(productId) ? { ...item, ...updatedFields } : item
      )
    );

    setProductSaveSuccess(true);
    setTimeout(() => {
      setProductSaveSuccess(false);
      setEditingProduct(null);
    }, 1200);
  };

  useEffect(() => {
    const displayName = name || session?.name || "Alex";
    document.title = `${displayName}'s Profile & Dashboard — The Launch Feed`;
  }, [name, session]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" });
    } catch {}
    try {
      await authClient.signOut();
    } catch {}
    logoutSession();
    window.location.assign("/");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || savingProfile) return;
    setSaveError(null);
    setSavingProfile(true);
    try {
      const persisted = await updateProfile({
        name: name.trim(),
        title,
        bio,
        websiteUrl: website,
        twitterHandle: twitter,
        githubHandle: github,
        image,
      });

      // Re-fetch canonical session shape so avatar/initials stay in sync
      // with the DB write (and any hooks that touched the row).
      let next: UserSession = {
        ...session,
        name: persisted.name || session.name,
        title: persisted.title || "",
        bio: persisted.bio || "",
        website: persisted.websiteUrl || "",
        twitter: persisted.twitterHandle || "",
        github: persisted.githubHandle || "",
        image: persisted.image ?? null,
        revenue,
        apiKey,
      };
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        if (meRes.ok) {
          const meData = (await meRes.json()) as { session: UserSession | null };
          if (meData?.session) next = { ...meData.session, title: persisted.title || title, revenue, apiKey };
        }
      } catch {
        /* ignore — local fallback already prepared */
      }

      saveSession(next);
      setSession(next);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile";
      setSaveError(message.length > 400 ? message.slice(0, 400) + "…" : message);
    } finally {
      setSavingProfile(false);
    }
  };

  const onPickImage = (file: File | null) => {
    setImageError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file (jpg, png, webp, gif, svg).");
      return;
    }
    if (file.size > 400_000) {
      setImageError("Image is too large — pick one under 400 KB, or paste a URL.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) setImage(result);
    };
    reader.onerror = () => setImageError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  if (!session) {
    return (
      <MainLayoutShell>
        <div className="w-full py-16 flex flex-col items-center justify-center font-mono text-ink">
          <div className="w-full border border-hairline bg-surface p-8 sm:p-12 text-center space-y-5">
            <div className="text-xs uppercase font-bold text-signal tracking-wider flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-signal" />
              AUTHENTICATION GATEWAY · SIGN IN REQUIRED
            </div>
            <p className="text-xs text-ink-dim leading-relaxed max-w-md mx-auto">
              You are currently not signed in. Access your founder dashboard to manage your launched products, view revenue telemetry, and update your profile settings.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/handler/sign-in?after_auth_return_to=/profile"
                className="px-6 py-3 bg-ink text-surface text-xs font-bold uppercase border border-ink hover:bg-ink-dim transition-colors inline-block"
              >
                Sign In to Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </MainLayoutShell>
    );
  }

  // Hydrated later by the effect below. Empty on first render, then fills in.
  const savedProducts: InteractionProduct[] = savedProductsState;
  const upvotedProducts: InteractionProduct[] = upvotedProductsState;

  const previewRevenue = revenue || session.revenue;
  const isRevenueVerified = Boolean(
    previewRevenue &&
      previewRevenue !== "$0" &&
      previewRevenue !== "$0 / mo" &&
      previewRevenue.trim() !== ""
  );

  return (
    <MainLayoutShell>
      <div className="space-y-5 sm:space-y-6 pb-16 font-mono text-ink">
        {/* ── Sticky Tab Header & Attached Preview Sub-Strip ── */}
        <div className="sticky -top-4 z-30 bg-void -mt-4 pt-4 border-b border-hairline shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pb-2.5">
            {/* Left cluster: back-nav + tab buttons */}
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
              <Link
                href="/"
                className="text-xs font-mono text-ink-dim hover:text-ink flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
              >
                ← Back to Launch Feed
              </Link>
              <span className="h-4 w-px bg-hairline shrink-0" aria-hidden />
              <div className="flex items-center gap-1">
              {(
                [
                  { id: "products", label: "MY PRODUCTS" },
                  { id: "subscriptions", label: "SUBSCRIPTIONS" },
                  { id: "saved", label: "SAVED" },
                  { id: "settings", label: "SETTINGS" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsPreviewing(false);
                  }}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                    !isPreviewing && activeTab === tab.id
                      ? tab.id === "subscriptions"
                        ? "bg-signal text-void"
                        : "bg-ink text-void"
                      : "text-ink-dim hover:text-ink border border-hairline"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setIsPreviewing(!isPreviewing)}
                className={`px-3 py-1 text-[11px] font-mono font-bold border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isPreviewing
                    ? "border-signal bg-signal text-void"
                    : "border-ink bg-ink text-void hover:bg-ink-dim"
                }`}
              >
                {isPreviewing
                  ? "← Back to Dashboard"
                  : "Preview Public Profile"}
              </button>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="px-3 py-1 text-[11px] font-mono font-bold border border-hairline bg-surface text-ink hover:border-signal hover:text-signal transition-colors shrink-0 flex items-center gap-1.5 whitespace-nowrap"
                  title="Admin Dashboard"
                >
                  <svg
                    className="w-3.5 h-3.5 text-signal shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" />
                    <circle cx="12" cy="11" r="2" />
                    <path d="M12 16v1" />
                  </svg>
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/submit"
                  className="px-3 py-1 text-[11px] font-mono font-bold bg-signal text-void hover:bg-signal/80 transition-colors shrink-0 flex items-center gap-1 whitespace-nowrap"
                >
                  + Launch New
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1 text-[11px] font-mono font-bold border border-hairline text-ink-dim hover:text-signal hover:border-signal/50 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Attached Minimal Preview Sub-Strip */}
          {isPreviewing && (
            <div className="py-1.5 border-t border-hairline/60 flex items-center justify-between gap-2 font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-signal truncate">
                  Preview Mode · Live Profile
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewing(false)}
                className="text-[10px] uppercase font-bold text-ink-dim hover:text-signal transition-colors cursor-pointer shrink-0"
              >
                Exit ✕
              </button>
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════
            PREVIEW MODE — In-Place Public Profile (FULL VIEW)
            ═════════════════════════════════════════ */}
        {isPreviewing ? (
          <FounderProfileContent
            founder={{
              id: session.id,
              username: session.handle.replace(/^@/, ""),
              name: name || session.name || session.handle.replace(/^@/, ""),
              handle: session.handle,
              title: title || session.title || "",
              bio: bio || session.bio || "",
              image: image || session.image || null,
              website: website || session.website || "",
              twitter: twitter || session.twitter || "",
              github: github || session.github || "",
              revenue: revenue || session.revenue || "",
              totalVotes: productsList
                .filter((p) => p.status === "LIVE" || p.status === "PUBLISHED")
                .reduce((sum, p) => sum + (p.votes || p.voteCount || 0), 0),
              productsCount: productsList.filter(
                (p) => p.status === "LIVE" || p.status === "PUBLISHED"
              ).length,
              joinedAt: new Date().toISOString().slice(0, 10),
              products: productsList
                .filter((p) => p.status === "LIVE" || p.status === "PUBLISHED")
                .map((p) => ({
                  id: p.id,
                  slug: p.slug,
                  name: p.name,
                  tagline: p.tagline,
                  votes: p.votes || p.voteCount || 0,
                  launchedAt: p.launchedAt || new Date().toISOString().slice(0, 10),
                  category: p.category,
                  revenue: p.revenue,
                  awards: p.awards || [],
                })),
            }}
            onExitPreview={() => setIsPreviewing(false)}
          />
        ) : (
          /* ═══════════════════════════
             DASHBOARD MODE — Edit View
             ═══════════════════════════ */
          <div className="space-y-5 sm:space-y-6">
            {/* Profile Hero Card */}
            <div className="border border-hairline bg-surface/40 p-4 sm:p-6 md:p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-ink text-void border border-hairline shrink-0 rounded-xs flex items-center justify-center font-mono font-bold text-lg sm:text-2xl overflow-hidden">
                    {image || session.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image || session.image || ""}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      session.avatar
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-mono text-lg sm:text-2xl font-bold text-ink truncate">
                        {session.name}
                      </h1>
                      <span className="text-xs font-mono text-ink-dim shrink-0">
                        {session.handle}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-signal">
                      {session.title}
                    </p>
                    <p className="text-xs text-ink-dim max-w-lg leading-relaxed break-words hidden sm:block">
                      {session.bio}
                    </p>
                  </div>
                </div>

                {isRevenueVerified && (
                  <div className="text-left sm:text-right shrink-0 space-y-1">
                    <div className="text-xs font-mono text-ink-faint uppercase">
                      VERIFIED REVENUE
                    </div>
                    <div className="text-lg font-mono font-bold text-ink">
                      {session.revenue}
                    </div>
                    <div className="text-[10px] font-mono px-2 py-0.5 border border-verified/50 text-verified bg-void uppercase inline-block">
                      ✓ Stripe Verified
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pt-1">
                <div className="flex items-center gap-3 text-xs font-mono text-ink-dim flex-wrap">
                  {session.website && (
                    <a
                      href={session.website}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-ink flex items-center gap-1.5 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path
                          strokeLinecap="square"
                          d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                        />
                      </svg>
                      <span>Website ↗</span>
                    </a>
                  )}
                  {session.twitter && (
                    <a
                      href={session.twitter}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-ink flex items-center gap-1.5 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>Twitter ↗</span>
                    </a>
                  )}
                  {session.github && (
                    <a
                      href={session.github}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-ink flex items-center gap-1.5 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        />
                      </svg>
                      <span>GitHub ↗</span>
                    </a>
                  )}
                </div>
                <div className="text-[11px] font-mono text-ink-faint">
                  Account ID:{" "}
                  <span className="text-ink">{session.id}</span>
                </div>
              </div>
            </div>

            {/* ─── TAB 1: MY LAUNCHED PRODUCTS ─── */}
            {activeTab === "products" && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-2 gap-1">
                  <h2 className="font-mono text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                    <span>My Launched Products</span>
                    <span className="text-[10px] text-ink-faint font-normal">
                      ({productsList.length} Total)
                    </span>
                  </h2>
                  <Link
                    href="/submit"
                    className="text-xs font-mono text-signal hover:underline font-bold shrink-0"
                  >
                    + Submit New Product ↗
                  </Link>
                </div>
                <div className="space-y-4">
                  {productsList.length === 0 && loadingProducts && (
                    <div className="space-y-3">
                      {[1, 2].map((n) => (
                        <div key={n} className="p-4 sm:p-5 border border-hairline bg-surface/20 space-y-3 animate-pulse">
                          <div className="flex items-center justify-between">
                            <div className="h-4 bg-surface w-40 rounded-xs" />
                            <div className="h-3 bg-surface w-16 rounded-xs" />
                          </div>
                          <div className="h-3 bg-surface/60 w-3/4 rounded-xs" />
                          <div className="flex gap-2 pt-2 border-t border-hairline/40">
                            <div className="h-3 bg-surface/40 w-24 rounded-xs" />
                            <div className="h-3 bg-surface/40 w-20 rounded-xs" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {productsList.length === 0 && !loadingProducts && (
                    <div className="border border-hairline bg-surface/30 p-6 sm:p-8 text-center space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-ink-dim">
                        No products launched yet
                      </div>
                      <p className="text-[11px] text-ink-faint max-w-md mx-auto leading-relaxed">
                        Once you submit and publish a product, it will appear here with
                        its vote count, badges, and edit controls.
                      </p>
                      <Link
                        href="/submit"
                        className="inline-block px-4 py-2 bg-ink text-void font-mono text-[11px] font-bold uppercase hover:bg-ink-dim transition-colors"
                      >
                        Submit your first product →
                      </Link>
                    </div>
                  )}
                  {productsList.map((p) => {
                    const isEmbedOpen = activeEmbedProductId === p.id;
                    const isEditing = editingProduct?.id === p.id;
                    const status = (p as MyProduct).status;
                    const isPending = status === "SCHEDULED";
                    const isRejected = status === "REJECTED";
                    const isNotLive = isPending || isRejected;
                    const scheduledForLabel = (p as MyProduct).scheduledFor
                      ? formatReleaseUtcWithIst((p as MyProduct).scheduledFor as string)
                      : "";
                    const rejectionReason = (p as MyProduct).rejectionReason;
                    return (
                      <div key={p.id} className="space-y-3">
                        <div className={`p-4 sm:p-5 border bg-surface/30 space-y-3 transition-colors ${
                          isRejected
                            ? "border-signal/40 opacity-80"
                            : isPending
                              ? "border-signal/40"
                              : "border-hairline hover:border-ink"
                        }`}>
                          <div className="flex items-start gap-3 sm:gap-3.5">
                            {/* Minimal Product Logo */}
                            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-surface border border-hairline shrink-0 flex items-center justify-center font-mono font-bold text-xs sm:text-sm text-ink overflow-hidden relative">
                              {p.logoUrl ? (
                                <img
                                  src={p.logoUrl}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{p.name.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                {isNotLive ? (
                                  <span className="font-mono text-sm sm:text-base font-bold text-ink truncate">
                                    {p.name}
                                  </span>
                                ) : (
                                  <Link
                                    href={`/product/${p.slug || slugify(p.name)}`}
                                    className="font-mono text-sm sm:text-base font-bold text-ink hover:text-signal transition-colors truncate"
                                  >
                                    {p.name}
                                  </Link>
                                )}
                                {isRejected ? (
                                  <span className="font-mono text-[10px] font-bold text-signal border border-signal px-2 py-0.5 uppercase tracking-wider shrink-0">
                                    Rejected
                                  </span>
                                ) : isPending ? (
                                  <span className="font-mono text-[10px] font-bold text-signal border border-signal/50 px-2 py-0.5 uppercase tracking-wider shrink-0">
                                    In queue
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs font-bold text-ink shrink-0">
                                    {p.votes} ▲
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink-dim line-clamp-2">{p.tagline}</p>
                            </div>
                          </div>
                          {isRejected && rejectionReason && (
                            <div className="border border-signal/40 bg-void p-3 text-[11px] font-mono text-ink-dim leading-relaxed">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-signal mb-1">
                                Rejection reason
                              </div>
                              {rejectionReason}
                            </div>
                          )}

                          {/* Award Badges, Edit Details & Embed Trigger */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-hairline/60">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isPending ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 border font-bold border-signal/50 text-signal bg-void uppercase tracking-wider">
                                  Launches {scheduledForLabel}
                                </span>
                              ) : isRejected ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 border font-bold border-signal text-signal bg-void uppercase tracking-wider">
                                  Not published
                                </span>
                              ) : (() => {
                                  const rawAwards = (p as MyProduct).awards || [];
                                  const specialAwards = rawAwards.filter((a) => a !== "launch");

                                  if (specialAwards.length === 0) {
                                    return (
                                      <span className="text-[10px] font-mono px-2 py-0.5 border border-hairline text-ink-dim bg-surface/50 uppercase tracking-wider">
                                        Official Launch
                                      </span>
                                    );
                                  }

                                  const getBadgeConfig = (a: string) => {
                                    if (a === "pod" || a === "daily_1") return { label: "🥇 #1 Daily Leader", tone: "border-signal text-signal bg-void" };
                                    if (a === "daily_2") return { label: "🥈 #2 Daily", tone: "border-ink-dim text-ink-dim bg-surface" };
                                    if (a === "daily_3") return { label: "🥉 #3 Daily", tone: "border-ink-faint text-ink-faint bg-surface" };
                                    if (a === "weekly_1") return { label: "⚡ #1 Weekly Leader", tone: "border-signal text-signal bg-void" };
                                    if (a === "weekly_2") return { label: "⚡ #2 Weekly", tone: "border-ink-dim text-ink-dim bg-surface" };
                                    if (a === "weekly_3") return { label: "⚡ #3 Weekly", tone: "border-ink-faint text-ink-faint bg-surface" };
                                    if (a === "monthly_1") return { label: "★ #1 Monthly Winner", tone: "border-signal text-signal bg-void" };
                                    if (a === "monthly_2") return { label: "★ #2 Monthly", tone: "border-ink-dim text-ink-dim bg-surface" };
                                    if (a === "monthly_3") return { label: "★ #3 Monthly", tone: "border-ink-faint text-ink-faint bg-surface" };
                                    if (a === "champion" || a === "yearly_1") return { label: "👑 2026 Champion", tone: "border-ink text-ink bg-surface" };
                                    if (a === "yearly_2") return { label: "👑 2026 Finalist #2", tone: "border-ink-dim text-ink-dim bg-surface" };
                                    if (a === "yearly_3") return { label: "👑 2026 Finalist #3", tone: "border-ink-faint text-ink-faint bg-surface" };
                                    if (a === "alltime_1") return { label: "🏆 All-Time #1 GOAT", tone: "border-signal text-signal bg-void" };
                                    if (a === "alltime_2") return { label: "🛡️ All-Time #2", tone: "border-ink text-ink bg-surface" };
                                    if (a === "alltime_3") return { label: "🌿 All-Time #3", tone: "border-ink-dim text-ink-dim bg-surface" };
                                    if (a === "revenue") return { label: "✓ Verified MRR", tone: "border-verified/50 text-verified bg-void" };
                                    if (a === "upvote") return { label: "▲ Top Upvoted", tone: "border-signal/40 text-signal bg-void" };
                                    return null;
                                  };

                                  return specialAwards.map((a) => {
                                    const cfg = getBadgeConfig(a);
                                    if (!cfg) return null;
                                    return (
                                      <span
                                        key={a}
                                        className={`text-[10px] font-mono px-2 py-0.5 border font-bold uppercase tracking-wider ${cfg.tone}`}
                                      >
                                        {cfg.label}
                                      </span>
                                    );
                                  });
                                })()}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                              {isRejected ? (
                                <Link
                                  href={`/submit?edit=sub:${(p as MyProduct).submissionId}`}
                                  className="px-3 py-1 text-[11px] font-mono font-bold border border-signal text-signal hover:bg-signal hover:text-void transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                                >
                                  <span>✎ Edit &amp; Resubmit</span>
                                </Link>
                              ) : isPending ? (
                                <Link
                                  href={`/submit?edit=sub:${(p as MyProduct).submissionId}`}
                                  className="px-3 py-1 text-[11px] font-mono font-bold border border-hairline bg-surface hover:bg-raised text-ink transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                                >
                                  <span>✎ Edit submission</span>
                                </Link>
                              ) : (
                                <>
                                  <Link
                                    href={`/submit?edit=prod:${p.id}`}
                                    className="px-3 py-1 text-[11px] font-mono font-bold border border-hairline bg-surface hover:bg-raised text-ink transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                                  >
                                    <span>✎ Edit product</span>
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveEmbedProductId(isEmbedOpen ? null : p.id)
                                    }
                                    className={`px-3 py-1 text-[11px] font-mono font-bold border transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                      isEmbedOpen
                                        ? "border-signal bg-signal text-void"
                                        : "border-hairline bg-surface hover:bg-raised text-ink"
                                    }`}
                                  >
                                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                                      <path d="M12 2a2 2 0 0 0-2 2v2H5a3 3 0 0 0-3 3v2a4 4 0 0 0 4 4h.47A6 6 0 0 0 11 18.9V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.1A6 6 0 0 0 17.53 15H18a4 4 0 0 0 4-4V9a3 3 0 0 0-3-3h-5V4a2 2 0 0 0-2-2zm-6 9a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1h1v3a4 4 0 0 1-.07 1zm14-2a2 2 0 0 1-2 2h-.07a4 4 0 0 1 .07-1V8h1a1 1 0 0 1 1 1z"/>
                                    </svg>
                                    <span>
                                      {isEmbedOpen
                                        ? "Close Badge Generator"
                                        : "Get Embeddable Award Code"}
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rejected → Edit & Resubmit drawer */}
                        {isRejected && resubmitOpenFor === (p as MyProduct).submissionId && (
                          <div className="border border-signal bg-void p-4 sm:p-5 space-y-3 animate-fadeIn font-mono text-ink">
                            <div className="flex items-center justify-between border-b border-hairline pb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-signal shrink-0" />
                                <h4 className="text-[11px] font-bold uppercase tracking-wider">
                                  Edit &amp; Resubmit — {p.name}
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => setResubmitOpenFor(null)}
                                className="text-[10px] uppercase text-ink-dim hover:text-ink underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>

                            {resubmitError && (
                              <div className="border border-signal bg-void p-2.5 text-[11px] text-signal font-mono">
                                {resubmitError}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-ink-dim">Name</label>
                                <input
                                  type="text"
                                  value={resubmitForm.name}
                                  onChange={(e) => setResubmitForm((f) => ({ ...f, name: e.target.value }))}
                                  className="w-full border border-hairline bg-surface px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-ink-dim">Tagline</label>
                                <input
                                  type="text"
                                  value={resubmitForm.tagline}
                                  onChange={(e) => setResubmitForm((f) => ({ ...f, tagline: e.target.value }))}
                                  maxLength={120}
                                  className="w-full border border-hairline bg-surface px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-ink-dim">Website URL</label>
                                <input
                                  type="url"
                                  value={resubmitForm.websiteUrl}
                                  onChange={(e) =>
                                    setResubmitForm((f) => ({ ...f, websiteUrl: e.target.value }))
                                  }
                                  placeholder="https://…"
                                  className="w-full border border-hairline bg-surface px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink placeholder:text-ink-faint"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-ink-dim">Category</label>
                                <select
                                  value={resubmitForm.categorySlug}
                                  onChange={(e) =>
                                    setResubmitForm((f) => ({ ...f, categorySlug: e.target.value }))
                                  }
                                  className="w-full border border-hairline bg-surface px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                                >
                                  <option value="">— Uncategorized —</option>
                                  {categoryOptions.map((c) => (
                                    <option key={c.slug} value={c.slug}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-ink-dim">
                                Description (optional)
                              </label>
                              <textarea
                                value={resubmitForm.description}
                                onChange={(e) =>
                                  setResubmitForm((f) => ({ ...f, description: e.target.value }))
                                }
                                rows={3}
                                className="w-full border border-hairline bg-surface p-3 text-xs font-mono text-ink focus:outline-none focus:border-ink resize-y"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                disabled={resubmitting || !p.submissionId}
                                onClick={() => p.submissionId && submitResubmit(p.submissionId)}
                                className="px-4 py-2 text-[11px] uppercase font-bold border border-signal bg-signal text-void hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {resubmitting ? "Resubmitting…" : "Resubmit for review →"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Product Details Editor Drawer (Exact Submit Section Form Builder Format) */}
                        {isEditing && (
                          <div className="border border-signal bg-void p-4 sm:p-6 space-y-4 animate-fadeIn font-mono text-ink">
                            <div className="flex items-center justify-between border-b border-hairline pb-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-signal animate-pulse" />
                                <h3 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider">
                                  Editing Product Specs — {p.name}
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingProduct(null)}
                                className="text-[11px] font-mono text-ink-dim hover:text-ink border border-hairline px-2.5 py-1 cursor-pointer uppercase font-bold"
                              >
                                ✕ Close Editor
                              </button>
                            </div>

                            {productSaveSuccess && (
                              <div className="p-3 border border-emerald-500/50 bg-emerald-500/10 text-emerald-500 text-xs font-bold flex items-center gap-2">
                                ✓ Product details &amp; specifications updated successfully!
                              </div>
                            )}

                            <SubmitClientView
                              initialProductData={p}
                              isEmbeddedMode={true}
                              onSaveProduct={(updatedData) => handleSaveFromSubmitForm(p.id, updatedData)}
                            />
                          </div>
                        )}

                        {/* Embeddable Code Generator Widget — only offers
                            the tiers this product has actually earned. */}
                        {isEmbedOpen && (
                          <EmbeddableAwardWidget
                            productName={p.name}
                            votes={p.votes}
                            revenue={session.revenue}
                            eligibleAwards={(p as MyProduct).awards ?? []}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── TAB 2: SUBSCRIPTIONS & 30-DAY LAUNCH PLACEMENTS ─── */}
            {activeTab === "subscriptions" && (
              <div className="space-y-6 font-mono text-ink">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-3 gap-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-signal" />
                      <span>30-Day Launch Placements &amp; Subscriptions</span>
                    </h2>
                    <p className="text-xs text-ink-dim font-sans mt-0.5">
                      Track your active Dodo Payments placement slots ($5 Header Floating &amp; $10 Spotlight).
                    </p>
                  </div>
                  <button
                    onClick={fetchSubscriptions}
                    disabled={loadingSubscriptions}
                    className="px-2.5 py-1 text-[11px] border border-hairline bg-surface hover:bg-raised text-ink font-bold transition-colors cursor-pointer flex items-center gap-1 self-start sm:self-auto rounded-xs"
                  >
                    <span>↻</span>
                    <span>{loadingSubscriptions ? "Syncing..." : "Refresh Status"}</span>
                  </button>
                </div>

                {/* Checkout Success Notice Banner */}
                {checkoutSuccessNotice && (
                  <div className="p-4 border border-signal bg-signal/10 space-y-1.5 rounded-xs animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-signal font-bold text-xs uppercase">
                      <span className="px-1.5 py-0.2 bg-signal text-void font-mono">CONFIRMED</span>
                      <span>Your 30-Day Placement is Activated &amp; Live on The Launch Feed!</span>
                    </div>
                    <p className="text-xs text-ink-dim font-sans">
                      Thank you for your purchase via Dodo Payments. Your product is now placed in real-time and tracked below.
                    </p>
                  </div>
                )}

                {/* Active Placements Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                      <span>Active Placements</span>
                      <span className="text-[10px] text-ink-faint font-normal">
                        ({activeSlots.filter((s) => s.isActive).length} Active)
                      </span>
                    </h3>
                  </div>

                  {loadingSubscriptions && activeSlots.length === 0 ? (
                    <div className="p-6 border border-hairline bg-surface/20 text-center text-xs text-ink-dim">
                      Loading placement telemetry...
                    </div>
                  ) : activeSlots.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3.5">
                      {activeSlots.map((slot) => {
                        const isHeaderFloating = slot.position === "FEATURED";
                        const tierColor = isHeaderFloating ? "text-signal border-signal/40 bg-signal/10" : "text-[#38BDF8] border-[#38BDF8]/40 bg-[#38BDF8]/10";
                        const barColor = isHeaderFloating ? "bg-signal" : "bg-[#38BDF8]";

                        return (
                          <div
                            key={slot.id}
                            className={`p-4 sm:p-5 border bg-surface/30 space-y-4 rounded-xs ${
                              slot.isActive ? "border-hairline hover:border-ink/40" : "border-hairline/60 opacity-60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-surface border border-hairline shrink-0 flex items-center justify-center font-mono font-bold text-xs text-ink overflow-hidden relative rounded-xs">
                                  {slot.product?.logoUrl ? (
                                    <img
                                      src={slot.product.logoUrl}
                                      alt={slot.product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span>{slot.product?.name?.substring(0, 2).toUpperCase() || "TL"}</span>
                                  )}
                                </div>
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-sm font-bold text-ink break-words">
                                      {slot.product?.name || "Product"}
                                    </span>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 border font-bold uppercase ${tierColor} rounded-xs`}>
                                      {slot.headline}
                                    </span>
                                  </div>
                                  <p className="font-mono text-xs text-ink-dim break-words">
                                    {slot.product?.tagline || "Product launch placement"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] font-mono px-2.5 py-1 border font-bold uppercase rounded-xs ${
                                    slot.isActive
                                      ? "border-signal text-signal bg-void"
                                      : "border-hairline text-ink-dim"
                                  }`}
                                >
                                  {slot.isActive ? `ACTIVE · ${slot.daysRemaining}D REMAINING` : "EXPIRED"}
                                </span>
                              </div>
                            </div>

                            {/* Countdown Progress Bar & Dates */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-ink-dim">
                                <span>
                                  {slot.isActive ? (
                                    <strong className="text-ink">{slot.daysRemaining} days remaining</strong>
                                  ) : (
                                    <span>Placement Period Ended</span>
                                  )}
                                  <span className="text-ink-faint"> (30-day duration)</span>
                                </span>
                                <span className="font-bold text-ink">
                                  {slot.priceFormatted} Paid Placement
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full h-1.5 bg-void border border-hairline overflow-hidden rounded-xs">
                                <div
                                  className={`h-full ${barColor} transition-all`}
                                  style={{ width: `${Math.min(100, Math.max(0, 100 - slot.percentElapsed))}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-ink-faint pt-0.5">
                                <span>Activated: {new Date(slot.startsAt).toLocaleDateString()}</span>
                                <span>Expires: {new Date(slot.endsAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* Action links & Renewal */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-hairline/60 text-xs">
                              <div className="flex items-center gap-3 text-[11px]">
                                <Link
                                  href="/"
                                  target="_blank"
                                  className="text-ink-dim hover:text-signal transition-colors flex items-center gap-1 font-bold"
                                >
                                  <span>View Live on Board</span>
                                  <span>↗</span>
                                </Link>
                                {slot.product?.slug && (
                                  <Link
                                    href={`/product/${slot.product.slug}`}
                                    target="_blank"
                                    className="text-ink-dim hover:text-ink transition-colors flex items-center gap-1"
                                  >
                                    <span>Product Page</span>
                                    <span>↗</span>
                                  </Link>
                                )}
                              </div>

                              <button
                                onClick={() => triggerDodoCheckout(slot.product?.id || "", slot.tier)}
                                disabled={isUpgradingProduct === `${slot.product?.id}-${slot.tier}`}
                                className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-signal text-signal hover:bg-signal hover:text-void transition-colors shrink-0 cursor-pointer rounded-xs"
                              >
                                {isUpgradingProduct === `${slot.product?.id}-${slot.tier}`
                                  ? "Loading Dodo..."
                                  : `Renew +30 Days (${slot.priceFormatted}) →`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6 text-center border border-hairline bg-surface/20 text-xs font-mono text-ink-dim space-y-3 rounded-xs">
                      <p>No active paid launch placements yet.</p>
                      <p className="text-[11px] text-ink-faint">
                        Upgrade any of your live products below with $5 or $10 placement to get instant 30-day top visibility.
                      </p>
                    </div>
                  )}
                </div>

                {/* 1-Click Feature Any Live Product Section */}
                {productsList.length > 0 && (
                  <div className="border border-hairline bg-surface/25 p-4 sm:p-6 space-y-4 rounded-xs">
                    <div className="border-b border-hairline pb-2.5">
                      <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                        <span>Feature One of Your Live Products (30 Days)</span>
                      </h3>
                      <p className="text-[11px] text-ink-dim font-sans mt-0.5">
                        Select a product and activate instant placement via Dodo Payments.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {productsList.map((p) => {
                        const hasFeatured = activeSlots.some((s) => s.product?.id === p.id && s.position === "FEATURED" && s.isActive);
                        const hasRotating = activeSlots.some((s) => s.product?.id === p.id && s.position === "ROTATING" && s.isActive);

                        return (
                          <div
                            key={p.id}
                            className="p-3.5 sm:p-4 border border-hairline bg-void/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 bg-surface border border-hairline shrink-0 flex items-center justify-center font-mono font-bold text-xs text-ink overflow-hidden rounded-xs">
                                {p.logoUrl ? (
                                  <img src={p.logoUrl} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{p.name.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-ink truncate">{p.name}</span>
                                  {hasFeatured && (
                                    <span className="text-[9px] px-1.5 py-0.2 border border-signal/40 text-signal bg-signal/10 uppercase font-bold">
                                      $5 ACTIVE
                                    </span>
                                  )}
                                  {hasRotating && (
                                    <span className="text-[9px] px-1.5 py-0.2 border border-[#38BDF8]/40 text-[#38BDF8] bg-[#38BDF8]/10 uppercase font-bold">
                                      $10 ACTIVE
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-ink-dim truncate font-sans">{p.tagline}</p>
                              </div>
                            </div>

                            {/* 1-Click Buy / Upgrade Buttons */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                              <button
                                onClick={() => triggerDodoCheckout(p.id, 5)}
                                disabled={isUpgradingProduct === `${p.id}-5`}
                                className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase border border-signal text-signal hover:bg-signal hover:text-void transition-colors cursor-pointer rounded-xs shrink-0"
                              >
                                {isUpgradingProduct === `${p.id}-5` ? "Loading..." : "Get $5 Header Floating →"}
                              </button>
                              <button
                                onClick={() => triggerDodoCheckout(p.id, 10)}
                                disabled={isUpgradingProduct === `${p.id}-10`}
                                className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase border border-[#38BDF8] text-[#38BDF8] hover:bg-[#38BDF8] hover:text-void transition-colors cursor-pointer rounded-xs shrink-0"
                              >
                                {isUpgradingProduct === `${p.id}-10` ? "Loading..." : "Get $10 Spotlight →"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Launch Placement Tiers Showcase */}
                <div className="border border-hairline bg-surface/20 p-4 sm:p-6 space-y-4 rounded-xs">
                  <div className="flex items-center justify-between border-b border-hairline pb-2">
                    <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                      Available Launch Placement Tiers
                    </h3>
                    <span className="text-[10px] text-signal font-mono uppercase font-bold">Dodo Payments Live</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Free Tier */}
                    <div className="p-4 border border-hairline bg-void flex flex-col justify-between space-y-4 rounded-xs">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">Free Launch</span>
                          <span className="text-lg font-bold text-ink">$0</span>
                        </div>
                        <div className="text-[10px] text-ink-dim uppercase font-bold">100% Free Forever</div>
                        <ul className="text-[11px] text-ink-dim space-y-1 pt-1 border-t border-hairline/60">
                          <li>· Auto-Broadcast to 𝕏, Telegram &amp; WhatsApp</li>
                          <li>· 2 permanent indexable pages</li>
                          <li>· Permanent dofollow backlink</li>
                          <li>· Daily 6 AM IST release queue</li>
                        </ul>
                      </div>
                      <Link
                        href="/submit"
                        className="w-full py-2 px-3 text-[10px] font-mono font-bold uppercase text-center block transition-colors bg-surface hover:bg-raised border border-hairline text-ink"
                      >
                        Submit Free ($0) →
                      </Link>
                    </div>

                    {/* $5 Tier */}
                    <div className="p-4 border border-signal/40 bg-signal/5 flex flex-col justify-between space-y-4 relative rounded-xs">
                      <div className="absolute -top-2.5 left-4 px-2 py-0.5 text-[9px] font-bold uppercase font-mono bg-signal text-void">
                        POPULAR
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">Featured Launch</span>
                          <span className="text-lg font-bold text-signal">$5</span>
                        </div>
                        <div className="text-[10px] text-signal uppercase font-bold">Header Floating Placement</div>
                        <ul className="text-[11px] text-ink-dim space-y-1 pt-1 border-t border-hairline/60">
                          <li>· Everything in Free ($0 tier)</li>
                          <li className="text-signal font-bold">· Top header floating section placement</li>
                          <li className="text-ink">· 30 continuous days active</li>
                          <li>· Real-time profile countdown tracking</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => {
                          if (productsList.length > 0) {
                            triggerDodoCheckout(productsList[0].id, 5);
                          } else {
                            window.location.assign("/submit");
                          }
                        }}
                        className="w-full py-2 px-3 text-[10px] font-mono font-bold uppercase text-center block transition-colors bg-signal text-void hover:opacity-90 cursor-pointer"
                      >
                        {productsList.length > 0 ? "Get $5 Placement (30D) →" : "Submit &amp; Upgrade ($5) →"}
                      </button>
                    </div>

                    {/* $10 Tier */}
                    <div className="p-4 border border-[#38BDF8]/40 bg-[#38BDF8]/5 flex flex-col justify-between space-y-4 relative rounded-xs">
                      <div className="absolute -top-2.5 left-4 px-2 py-0.5 text-[9px] font-bold uppercase font-mono bg-[#38BDF8] text-void font-bold">
                        SPOTLIGHT
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">Premium Spotlight</span>
                          <span className="text-lg font-bold text-[#38BDF8]">$10</span>
                        </div>
                        <div className="text-[10px] text-[#38BDF8] uppercase font-bold">Search/Submit Spotlight</div>
                        <ul className="text-[11px] text-ink-dim space-y-1 pt-1 border-t border-hairline/60">
                          <li>· Everything in Free ($0 tier)</li>
                          <li className="text-[#38BDF8] font-bold">· Alternating 15s spotlight next to search/submit</li>
                          <li className="text-ink">· 30 continuous days active</li>
                          <li>· Real-time profile countdown tracking</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => {
                          if (productsList.length > 0) {
                            triggerDodoCheckout(productsList[0].id, 10);
                          } else {
                            window.location.assign("/submit");
                          }
                        }}
                        className="w-full py-2 px-3 text-[10px] font-mono font-bold uppercase text-center block transition-colors bg-[#38BDF8] text-void hover:opacity-90 cursor-pointer font-bold"
                      >
                        {productsList.length > 0 ? "Get $10 Spotlight (30D) →" : "Submit &amp; Spotlight ($10) →"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 3: SAVED & UPVOTED ─── */}
            {activeTab === "saved" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-2 gap-1">
                  <h2 className="font-mono text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                    <span>Bookmarked &amp; Upvoted</span>
                    <span className="text-[10px] text-ink-faint font-normal">
                      ({savedProducts.length} Saved · {upvotedProducts.length}{" "}
                      Upvoted)
                    </span>
                  </h2>
                </div>

                {/* Bookmarked */}
                <div className="space-y-3">
                  <div className="text-xs font-mono font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-signal">
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M3 2H13V14L8 10.5L3 14V2Z" />
                      </svg>
                      Saved ({savedProducts.length})
                    </span>
                    <span className="h-px bg-hairline flex-1" />
                  </div>
                  {savedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedProducts.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 sm:p-4 border border-hairline bg-surface/30 space-y-2 hover:border-ink transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/product/${slugify(p.name)}`}
                              className="font-mono text-sm font-bold text-ink hover:text-signal transition-colors truncate"
                            >
                              {p.name}
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!session) return;
                                const currentList = session.savedProductIds || [];
                                const nextList = currentList.filter((id) => id !== p.id);
                                const updated = { ...session, savedProductIds: nextList };
                                saveSession(updated);
                                setSavedProductsState((prev) => prev.filter((item) => item.id !== p.id));
                                try {
                                  await toggleBookmark(p.id);
                                } catch {
                                  saveSession(session);
                                }
                              }}
                              className="text-signal hover:text-ink text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0"
                              title="Remove Bookmark"
                            >
                              <svg
                                className="w-3 h-3"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path d="M3 2H13V14L8 10.5L3 14V2Z" />
                              </svg>
                              <span className="hidden sm:inline">Saved</span>
                            </button>
                          </div>
                          <p className="text-xs text-ink-dim line-clamp-2">
                            {p.tagline}
                          </p>
                          <div className="flex items-center justify-between text-[11px] font-mono text-ink-faint border-t border-hairline pt-2">
                            <span>{p.maker}</span>
                            <span className="font-bold text-ink">
                              {p.votes} ▲
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : loadingSaved ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[1, 2].map((n) => (
                        <div key={n} className="p-3 sm:p-4 border border-hairline bg-surface/20 space-y-2 animate-pulse">
                          <div className="flex items-center justify-between">
                            <div className="h-4 bg-surface w-32 rounded-xs" />
                            <div className="h-3 bg-surface w-12 rounded-xs" />
                          </div>
                          <div className="h-3 bg-surface/60 w-3/4 rounded-xs" />
                          <div className="h-3 bg-surface/40 w-20 rounded-xs pt-1" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6 text-center border border-hairline bg-surface/20 text-xs text-ink-dim">
                      No saved bookmarks yet.
                    </div>
                  )}
                </div>

                {/* Upvoted */}
                <div className="space-y-3 pt-2 sm:pt-4">
                  <div className="text-xs font-mono font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                    <span>▲ Upvoted ({upvotedProducts.length})</span>
                    <span className="h-px bg-hairline flex-1" />
                  </div>
                  {upvotedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {upvotedProducts.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 sm:p-4 border border-hairline bg-surface/30 space-y-2 hover:border-ink transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/product/${slugify(p.name)}`}
                              className="font-mono text-sm font-bold text-ink hover:text-signal transition-colors truncate"
                            >
                              {p.name}
                            </Link>
                            <span className="text-[10px] font-mono px-2 py-0.5 border border-signal bg-signal text-void font-bold uppercase shrink-0">
                              ▲ Upvoted
                            </span>
                          </div>
                          <p className="text-xs text-ink-dim line-clamp-2">
                            {p.tagline}
                          </p>
                          <div className="flex items-center justify-between text-[11px] font-mono text-ink-faint border-t border-hairline pt-2">
                            <span>{p.maker}</span>
                            <span className="font-bold text-ink">
                              {p.votes} ▲
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : loadingUpvoted ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[1, 2].map((n) => (
                        <div key={n} className="p-3 sm:p-4 border border-hairline bg-surface/20 space-y-2 animate-pulse">
                          <div className="flex items-center justify-between">
                            <div className="h-4 bg-surface w-32 rounded-xs" />
                            <div className="h-3 bg-surface w-12 rounded-xs" />
                          </div>
                          <div className="h-3 bg-surface/60 w-3/4 rounded-xs" />
                          <div className="h-3 bg-surface/40 w-20 rounded-xs pt-1" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6 text-center border border-hairline bg-surface/20 text-xs text-ink-dim">
                      No upvoted products yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 4: SETTINGS ─── */}
            {activeTab === "settings" && (
              <div className="space-y-5 sm:space-y-6">
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <h2 className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
                    Account &amp; Developer API Settings
                  </h2>
                </div>

                {savedSuccess && (
                  <div className="p-3 border border-verified bg-verified/10 text-verified text-xs font-mono font-bold">
                    ✓ Account settings updated successfully!
                  </div>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-5 sm:space-y-6">
                  {/* Profile Details */}
                  <div className="border border-hairline bg-surface/30 p-4 sm:p-5 space-y-4">
                    <h3 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-hairline pb-2">
                      Profile Information
                    </h3>

                    {/* ── Profile Picture ── */}
                    <div className="flex items-start gap-4 border-b border-hairline pb-4">
                      <div className="w-16 h-16 rounded-xs bg-void border border-hairline overflow-hidden flex items-center justify-center shrink-0">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-ink">
                            {(session?.avatar || "?").slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <label className="text-xs font-bold text-ink uppercase block">
                          Profile Picture
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 border border-hairline bg-void px-3 py-1.5 text-[11px] font-mono text-ink hover:bg-surface cursor-pointer transition-colors">
                            <span className="uppercase font-bold">Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                          {image && (
                            <button
                              type="button"
                              onClick={() => {
                                setImage("");
                                setImageError(null);
                              }}
                              className="text-[10px] uppercase font-bold px-2 py-1 border border-hairline hover:bg-signal hover:text-surface hover:border-signal transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="url"
                          value={image.startsWith("data:") ? "" : image}
                          onChange={(e) => setImage(e.target.value)}
                          placeholder="…or paste an image URL"
                          className="w-full border border-hairline bg-void px-3 py-2 text-[11px] font-mono text-ink focus:outline-none focus:border-ink placeholder:text-ink-faint"
                        />
                        {imageError && (
                          <p className="text-[10px] text-signal font-mono">{imageError}</p>
                        )}
                        <p className="text-[10px] text-ink-faint font-mono">
                          Upload under 400 KB (stored inline) or paste any https URL.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink uppercase">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink uppercase">
                          Title / Role
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink uppercase">
                        Bio / Creator Statement
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        className="w-full border border-hairline bg-void p-3 text-xs font-mono text-ink focus:outline-none focus:border-ink resize-y"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink uppercase flex items-center gap-2">
                          <span>Verified Revenue (MRR)</span>
                          <span className="text-[9px] font-normal text-ink-faint uppercase tracking-wider">Auto-Synced Only</span>
                        </label>
                        <div className="w-full border border-hairline bg-surface/30 px-3 py-2 text-xs font-mono flex items-center justify-between">
                          <span className={revenue ? "text-signal font-bold" : "text-ink-faint"}>
                            {revenue || "— Sync via Payments API below"}
                          </span>
                          {revenue && (
                            <span className="text-[9px] text-ink-faint uppercase flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink uppercase">
                          Personal Website
                        </label>
                        <input
                          type="url"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          className="w-full border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink uppercase">
                          Twitter Handle URL
                        </label>
                        <input
                          type="text"
                          value={twitter}
                          onChange={(e) => setTwitter(e.target.value)}
                          className="w-full border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-ink uppercase">
                          GitHub Profile URL
                        </label>
                        <input
                          type="text"
                          value={github}
                          onChange={(e) => setGithub(e.target.value)}
                          className="w-full border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Verified Revenue & Payments API ── */}
                  <div className="border border-verified/50 bg-surface/30 p-4 sm:p-5 space-y-4 font-mono">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-2 gap-1">
                      <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-verified shrink-0" />
                        <span>Verified Revenue &amp; Payments API</span>
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 border border-verified/50 text-verified bg-void uppercase font-bold shrink-0">
                        ✓ Live SDK
                      </span>
                    </div>
                    <p className="text-xs text-ink-dim leading-relaxed">
                      Select your revenue gateway to execute a read-only
                      telemetry handshake via{" "}
                      <code className="text-ink font-bold bg-void px-1 py-0.5 border border-hairline">
                        revenueTelemetrySDK
                      </code>
                      .
                    </p>

                    {/* Provider Grid */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink uppercase">
                        Select Revenue Provider
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {REVENUE_PROVIDERS.slice(0, 8).map((prov) => {
                          const isSelected = paymentProvider === prov.id;
                          return (
                            <button
                              key={prov.id}
                              type="button"
                              onClick={() => {
                                setPaymentProvider(prov.id);
                                setStripeApiKey(prov.sampleKey);
                              }}
                              className={`p-2 border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                                isSelected
                                  ? "border-signal bg-void text-ink font-bold"
                                  : "border-hairline bg-surface/50 text-ink-dim hover:text-ink hover:bg-surface"
                              }`}
                            >
                              <PaymentProviderLogo
                                id={prov.id}
                                className="w-4 h-4 shrink-0"
                              />
                              <span className="text-[11px] truncate">
                                {prov.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {(() => {
                      const currentProv =
                        REVENUE_PROVIDERS.find(
                          (p) => p.id === paymentProvider
                        ) || REVENUE_PROVIDERS[0];
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold text-ink uppercase truncate">
                                {currentProv.name} API Key
                              </label>
                              <a
                                href={currentProv.docUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-ink-faint hover:text-ink underline shrink-0"
                              >
                                Docs ↗
                              </a>
                            </div>
                            <input
                              type="text"
                              value={stripeApiKey}
                              onChange={(e) => setStripeApiKey(e.target.value)}
                              placeholder={currentProv.placeholder}
                              className="w-full border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ink"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-ink uppercase">
                              SDK Engine
                            </label>
                            <div className="border border-hairline bg-void px-3 py-2 text-xs font-mono text-ink-dim truncate">
                              {currentProv.sdkName} ({currentProv.currency})
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-hairline gap-2">
                      <div className="text-[11px] font-mono text-ink-dim">
                        Current MRR:{" "}
                        <span className={`font-bold ${revenue ? "text-signal" : "text-ink-faint"}`}>
                          {revenue || "Not synced yet"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmedReadOnly(false);
                          setShowApiKeyModal(true);
                        }}
                        disabled={syncingPayments}
                        className="px-4 py-2 bg-ink text-void hover:bg-ink-dim text-xs font-mono font-bold uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0 self-start sm:self-auto"
                      >
                        <PaymentProviderLogo
                          id={paymentProvider}
                          className="w-3.5 h-3.5"
                        />
                        <span>
                          {syncingPayments
                            ? "Syncing..."
                            : "Sync Live Revenue →"}
                        </span>
                      </button>
                    </div>

                    {telemetryLog && (
                      <div className="p-3 border border-hairline bg-void text-[10px] font-mono text-signal leading-relaxed whitespace-pre-wrap overflow-x-auto">
                        {telemetryLog}
                      </div>
                    )}

                    {paymentsSuccess && (
                      <div className="p-2.5 border border-verified bg-verified/10 text-verified text-xs font-mono font-bold">
                        ✓ Verified MRR updated to {revenue} via{" "}
                        {paymentProvider.toUpperCase()} SDK!
                      </div>
                    )}
                  </div>



                  {saveError && (
                    <div className="p-3 border border-signal bg-void text-signal text-xs font-mono">
                      <div className="text-[10px] uppercase font-bold tracking-wider mb-1">
                        Save failed
                      </div>
                      {saveError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 sm:px-6 py-3 bg-ink text-void font-mono text-xs font-bold uppercase hover:bg-ink-dim transition-colors cursor-pointer w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingProfile ? "Saving…" : "Save Account Profile →"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Minimal Read-Only API Key Confirmation Popup Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-void/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-signal bg-void p-5 sm:p-6 space-y-4 font-mono text-ink">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-signal animate-ping" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Critical Security Audit
                </h3>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 border border-signal text-signal bg-signal/10 uppercase font-bold">
                Read-Only Only
              </span>
            </div>

            <div className="space-y-2 text-xs text-ink-dim leading-relaxed">
              <p className="font-bold text-ink uppercase text-[11px]">
                Confirm Read-Only API Key Access
              </p>
              <p>
                It is extremely important that you ONLY provide a{" "}
                <span className="text-signal font-bold">Read-Only API Key</span>{" "}
                (e.g., restricted key with read permissions).
              </p>
              <p className="text-[11px] text-ink-faint">
                Never submit secret API keys that have write permissions, full admin access, or payout capabilities to prevent security risks.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-3 border border-hairline bg-surface/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedReadOnly}
                onChange={(e) => setConfirmedReadOnly(e.target.checked)}
                className="mt-0.5 accent-signal cursor-pointer"
              />
              <span className="text-[11px] font-mono text-ink font-bold leading-tight">
                I confirm that I have submitted a 100% Read-Only API Key with zero write permissions.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 border border-hairline bg-surface text-ink-dim hover:text-ink text-xs font-mono font-bold uppercase transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmedReadOnly}
                onClick={async () => {
                  setShowApiKeyModal(false);
                  setSyncingPayments(true);
                  setTelemetryLog("");
                  try {
                    const res = await savePaymentApiKey({
                      provider: paymentProvider,
                      apiKey: stripeApiKey,
                    });
                    if (res.success) {
                      setRevenue(res.mrrFormatted);
                      setStripeApiKey(res.apiKey);
                      setTelemetryLog(
                        `${res.telemetryLog}\n\n[ENCRYPTION CONFIRMED] Stored at rest as AES-256-GCM encrypted payload in RevenueConnection DB.`
                      );
                      setPaymentsSuccess(true);
                      setTimeout(() => setPaymentsSuccess(false), 4000);
                    }
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Failed to sync payment key";
                    setTelemetryLog(`[ERROR] ${msg}`);
                  } finally {
                    setSyncingPayments(false);
                  }
                }}
                className="px-4 py-2 bg-signal text-void hover:bg-signal/90 text-xs font-mono font-bold uppercase transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span>Confirm &amp; Sync Revenue →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayoutShell>
  );
}
