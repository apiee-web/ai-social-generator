/**
 * api/_lib/plans.js
 * ---------------------------------------------------------------------------
 * Prices live here, on the server. The browser only ever sends a plan id, so
 * nobody can buy 1,000 credits for a penny by editing the page.
 *
 * Keep the ids and credit counts in sync with PLANS in src/App.jsx (the labels
 * and prices shown there are just the display copy).
 * ---------------------------------------------------------------------------
 */

export const FREE_CREDITS = 3;

export const PLANS = {
  starter: { id: "starter", name: "Starter", cents: 900, credits: 50 },
  pro: { id: "pro", name: "Pro", cents: 1900, credits: 250 },
  agency: { id: "agency", name: "Agency", cents: 4900, credits: 1000 },
};

export function getPlan(planId) {
  return PLANS[String(planId || "").trim().toLowerCase()] || null;
}

export function planSummary(plan) {
  return `${plan.name} — ${plan.credits.toLocaleString("en-US")} credits`;
}
