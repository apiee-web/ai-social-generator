/**
 * api/checkout.js — POST /api/checkout
 * ---------------------------------------------------------------------------
 * The pricing modal calls this when someone picks a plan. With no
 * STRIPE_SECRET_KEY it runs in demo mode: credits are granted, no money moves.
 * ---------------------------------------------------------------------------
 */

const PLANS = {
  starter: { credits: 50 },
  pro: { credits: 250 },
  agency: { credits: 1000 },
};

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
  } catch {
    return {};
  }
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Use POST for this endpoint." });
  }

  const body = await readBody(req);
  const plan = PLANS[String(body.planId || "")];

  if (!plan) {
    return send(res, 400, { error: "Unknown plan." });
  }

  /* ---------------------------------------------------------------------- */
  /*  DEMO MODE (default): credit the account, take no money.               */
  /* ---------------------------------------------------------------------- */
  if (!process.env.STRIPE_SECRET_KEY) {
    return send(res, 200, {
      demo: true,
      credits: plan.credits,
      message: "Demo checkout — no payment was taken.",
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  REAL PAYMENTS: uncomment after `npm i stripe`.                        */
  /*                                                                        */
  /*  const Stripe = require("stripe");                                     */
  /*  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);                 */
  /*                                                                        */
  /*  const session = await stripe.checkout.sessions.create({               */
  /*    mode: "payment",                                                    */
  /*    line_items: [{                                                      */
  /*      quantity: 1,                                                      */
  /*      price_data: {                                                     */
  /*        currency: "usd",                                                */
  /*        unit_amount: 1900,                     // $19.00                */
  /*        product_data: { name: "Pro — 250 credits" },                    */
  /*      },                                                                */
  /*    }],                                                                 */
  /*    success_url: `${process.env.APP_URL}/?paid=1`,                      */
  /*    cancel_url: `${process.env.APP_URL}/?paid=0`,                       */
  /*    metadata: { planId, credits: String(plan.credits) },                */
  /*  });                                                                   */
  /*  return send(res, 200, { url: session.url });                          */
  /*                                                                        */
  /*  Then credit the account from a Stripe webhook once payment succeeds.  */
  /* ---------------------------------------------------------------------- */

  return send(res, 501, {
    error:
      "Stripe is configured but the checkout route isn't implemented yet. Open api/checkout.js and follow the commented block.",
  });
}

export default handler;
