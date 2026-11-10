/**
 * api/_lib/stripe.js
 * ---------------------------------------------------------------------------
 * Stripe is only imported when a key exists, so the app boots fine without it.
 * ---------------------------------------------------------------------------
 */

let factory = null;

export function stripeKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

export function hasStripe() {
  return Boolean(stripeKey());
}

export function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
}

/** Test seam: replace the client with a fake in unit tests. */
export function setStripeFactory(fn) {
  factory = fn;
}

export async function getStripe() {
  const key = stripeKey();
  if (!key) return null;
  if (factory) return factory(key);

  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 20000 });
}
