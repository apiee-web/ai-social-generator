/**
 * PricingModal.jsx — the two monthly subscription plans.
 * ---------------------------------------------------------------------------
 * Creator €19/month and Agency €49/month. Both are unlimited; they differ in
 * how many Brand Vault profiles the account keeps.
 * ---------------------------------------------------------------------------
 */

import { useEffect } from "react";

import { BILLING_NOTE, PLANS } from "./studio-config.js";

export default function PricingModal({
  open,
  purchasing,
  billingBusy,
  error,
  cloud,
  signedIn,
  plan,
  onClose,
  onSelect,
  onManageBilling,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="aisg-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="aisg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aisg-pricing-title"
      >
        <button type="button" className="aisg-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 id="aisg-pricing-title">Upgrade your content engine</h2>
        <p className="aisg-modal-sub">
          Every plan writes LinkedIn, Instagram/Facebook and TikTok from one idea, in your brand's
          saved voice — with the anti-cliché guard on.
        </p>

        <div className="aisg-plans aisg-plans-two">
          {PLANS.map((option) => {
            const current = signedIn && plan === option.id;
            return (
              <div
                key={option.id}
                className={option.popular ? "aisg-plan aisg-plan-popular" : "aisg-plan"}
              >
                {option.popular && <span className="aisg-badge">Most popular</span>}
                <h3>{option.name}</h3>
                <p className="aisg-price">
                  <span>€{option.price}</span>/ {option.interval}
                </p>
                <p className="aisg-plan-tagline">{option.tagline}</p>
                <ul className="aisg-perks">
                  {option.perks.map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="aisg-btn aisg-btn-primary aisg-btn-full"
                  onClick={() => (current ? onManageBilling?.() : onSelect(option))}
                  disabled={Boolean(purchasing) || (current && Boolean(billingBusy))}
                >
                  {current
                    ? billingBusy
                      ? "Opening billing…"
                      : "Manage billing"
                    : purchasing === option.id
                      ? "Opening checkout…"
                      : cloud && !signedIn
                        ? "Sign in to subscribe"
                        : `Subscribe · €${option.price}/month`}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="aisg-error aisg-modal-error" role="alert">
            {error}
          </p>
        )}

        <p className="aisg-fineprint">
          {cloud && signedIn
            ? `Secure recurring payment by Stripe. ${BILLING_NOTE}`
            : cloud
              ? "Sign in first — your plan and Brand Vault follow your email to any device."
              : "Demo mode: no card is charged until accounts and Stripe are connected."}
        </p>
      </div>
    </div>
  );
}
