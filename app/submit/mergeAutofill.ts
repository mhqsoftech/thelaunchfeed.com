/**
 * Merges an autofill result into the form without losing what the visitor typed.
 *
 * A value counts as typed when it's filled in and isn't what the last autofill
 * wrote (the baseline). Typed values always stay. Autofilled values are replaced
 * by a newer result, so re-running with a corrected link still refreshes them,
 * and a result that found nothing leaves the field as it is.
 */

export type AutofillTier = { name: string; price: string; specs: string };
export type AutofillFaq = { q: string; a: string };

export type AutofillBaseline = {
  fields: Record<string, string>;
  features: string[];
  tiers: (AutofillTier | undefined)[];
  faqs: AutofillFaq[];
};

export const emptyAutofillBaseline = (): AutofillBaseline => ({ fields: {}, features: [], tiers: [], faqs: [] });

const MAX_FEATURES = 20;
const MIN_FEATURE_ROWS = 3;
const MAX_TIERS = 6;
const DEFAULT_TIER_NAMES = ["", "Free", "Pro", "Enterprise"];

const filled = (value?: string) => Boolean(value && value.trim());
const faqKey = (faq: AutofillFaq) => `${faq.q}\n${faq.a}`;
const sameTier = (a: AutofillTier, b?: AutofillTier) =>
  Boolean(b) && a.name === b?.name && a.price === b?.price && a.specs === b?.specs;
const tierHasContent = (tier: AutofillTier) => filled(tier.price) || filled(tier.specs);

export function mergeAutofill(input: {
  current: {
    fields: Record<string, unknown>;
    features: string[];
    tiers: AutofillTier[];
    faqs: AutofillFaq[];
  };
  found: {
    fields: Record<string, string>;
    features: string[];
    tiers: AutofillTier[];
    faqs: AutofillFaq[];
  };
  baseline: AutofillBaseline;
}) {
  const { current, found, baseline } = input;
  let keptCount = 0;

  const fields: Record<string, string> = {};
  const baselineFields = { ...baseline.fields };
  for (const [key, foundValue] of Object.entries(found.fields)) {
    const raw = current.fields[key];
    const currentValue = typeof raw === "string" ? raw : "";
    if (filled(currentValue) && currentValue !== baseline.fields[key]) {
      fields[key] = currentValue;
      if (filled(foundValue) && foundValue !== currentValue) keptCount += 1;
    } else if (filled(foundValue)) {
      fields[key] = foundValue;
      baselineFields[key] = foundValue;
    } else {
      fields[key] = currentValue;
    }
  }

  let features = current.features;
  let baselineFeatures = baseline.features;
  const foundFeatures = found.features.filter(filled);
  if (foundFeatures.length > 0) {
    const typed = current.features.filter((f) => filled(f) && !baseline.features.includes(f));
    const added = foundFeatures.filter((f) => !typed.includes(f));
    features = [...typed, ...added].slice(0, MAX_FEATURES);
    while (features.length < MIN_FEATURE_ROWS) features.push("");
    baselineFeatures = added;
    keptCount += typed.length;
  }

  let tiers = current.tiers;
  const baselineTiers = [...baseline.tiers];
  if (found.tiers.length > 0) {
    tiers = [];
    const rows = Math.min(MAX_TIERS, Math.max(current.tiers.length, found.tiers.length));
    for (let i = 0; i < rows; i += 1) {
      const existing = current.tiers[i];
      const incoming = found.tiers[i];
      const typed =
        existing &&
        !sameTier(existing, baseline.tiers[i]) &&
        (tierHasContent(existing) || !DEFAULT_TIER_NAMES.includes(existing.name));
      if (typed) {
        tiers.push(existing);
        if (incoming) keptCount += 1;
      } else if (incoming) {
        tiers.push(incoming);
        baselineTiers[i] = incoming;
      } else {
        tiers.push(existing);
      }
    }
  }

  let faqs = current.faqs;
  let baselineFaqs = baseline.faqs;
  const foundFaqs = found.faqs.filter((f) => filled(f.q) || filled(f.a));
  if (foundFaqs.length > 0) {
    const baselineKeys = new Set(baseline.faqs.map(faqKey));
    const typed = current.faqs.filter((f) => (filled(f.q) || filled(f.a)) && !baselineKeys.has(faqKey(f)));
    const typedKeys = new Set(typed.map(faqKey));
    const added = foundFaqs.filter((f) => !typedKeys.has(faqKey(f)));
    faqs = [...typed, ...added];
    baselineFaqs = added;
    keptCount += typed.length;
  }

  return {
    fields,
    features,
    tiers,
    faqs,
    keptCount,
    baseline: { fields: baselineFields, features: baselineFeatures, tiers: baselineTiers, faqs: baselineFaqs },
  };
}
