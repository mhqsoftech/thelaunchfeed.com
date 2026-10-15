/**
 * Pings /api/cron once a minute. The app does all the work and guarantees
 * each scheduled slot runs once, so retries / overlaps here are harmless.
 */
async function ping(env) {
  const res = await fetch(env.TARGET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "x-cron-source": "cloudflare",
    },
  });
  if (!res.ok) {
    console.error(`heartbeat failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.status;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(ping(env));
  },
};
