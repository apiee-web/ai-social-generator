/**
 * api/_lib/plans.js
 * ---------------------------------------------------------------------------
 * Prices live here, on the server. The browser only ever sends a plan id, so
 * nobody can buy the Agency plan for a penny by editing the page.
 *
 * Two recurring plans, both monthly, both unlimited generations:
 *   creator — €19/month, 1 Brand Vault profile
 *   agency  — €49/month, up to 5 Brand Vault profiles
 *
 * Free accounts get FREE_CREDITS generations and one vault, so the product is
 * usable (and worth upgrading) before anyone pays. The credits only unlock
 * once the address is verified — see api/_lib/verify.js.
 * ---------------------------------------------------------------------------
 */

export const FREE_CREDITS = 5;
export const FREE_VAULTS = 1;

export const PLANS = {
  creator: {
    id: "creator",
    name: "Creator",
    cents: 1900,
    currency: "eur",
    interval: "month",
    vaults: 1,
    tagline: "One brand, every channel",
  },
  agency: {
    id: "agency",
    name: "Agency",
    cents: 4900,
    currency: "eur",
    interval: "month",
    vaults: 5,
    tagline: "Several brands or clients",
  },
};

export function getPlan(planId) {
  return PLANS[String(planId || "").trim().toLowerCase()] || null;
}

export function planSummary(plan) {
  const vaults = `${plan.vaults} brand vault${plan.vaults === 1 ? "" : "s"}`;
  return `${plan.name} — monthly subscription, ${vaults}, unlimited generations`;
}

/** A subscription only counts while Stripe says it is alive. */
export function isSubscribed(planId, status) {
  if (!PLANS[String(planId || "")]) return false;
  const state = String(status || "");
  return state === "active" || state === "trialing";
}

/** How many Brand Vault profiles this account may keep. */
export function vaultLimit(planId, status) {
  if (!isSubscribed(planId, status)) return FREE_VAULTS;
  return PLANS[planId].vaults;
}
