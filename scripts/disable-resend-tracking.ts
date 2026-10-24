import { Resend } from "resend";

/**
 * Script to disable click tracking (and open tracking) across domains in Resend.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxxx npm run email:disable-tracking
 *   or:
 *   npx tsx scripts/disable-resend-tracking.ts
 */
async function main() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.error("\n❌ Error: RESEND_API_KEY is missing.");
    console.error("Please run with your Resend API key:");
    console.error("  RESEND_API_KEY=re_your_key_here npm run email:disable-tracking\n");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  console.log("\nConnecting to Resend and retrieving configured domains...");

  const listResponse = await resend.domains.list();
  if (listResponse.error || !listResponse.data) {
    console.error("❌ Failed to list domains from Resend:", listResponse.error);
    process.exit(1);
  }

  const domains = listResponse.data.data;
  if (!domains || domains.length === 0) {
    console.log("No domains found in this Resend account.");
    return;
  }

  console.log(`Found ${domains.length} domain(s):\n`);

  for (const domain of domains) {
    console.log(`──────────────────────────────────────────`);
    console.log(`Domain: ${domain.name} (id: ${domain.id})`);
    console.log(`Status: ${domain.status}`);
    console.log(`Click Tracking currently: ${domain.click_tracking ? "ENABLED (links rewritten)" : "DISABLED (exact links)"}`);
    console.log(`Open Tracking currently:  ${domain.open_tracking ? "ENABLED" : "DISABLED"}`);

    if (domain.click_tracking || domain.open_tracking) {
      console.log(`Updating ${domain.name} to disable click tracking...`);
      const updateRes = await resend.domains.update({
        id: domain.id,
        clickTracking: false,
        openTracking: false,
      });

      if (updateRes.error) {
        console.error(`❌ Failed to disable tracking for ${domain.name}:`, updateRes.error);
      } else {
        console.log(`✓ Click tracking successfully DISABLED for ${domain.name}!`);
      }
    } else {
      console.log(`✓ Click tracking is already disabled for ${domain.name}.`);
    }
  }

  console.log(`──────────────────────────────────────────`);
  console.log("\n✓ All done! All emails sent via Resend will now contain exact, unmodified links.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
