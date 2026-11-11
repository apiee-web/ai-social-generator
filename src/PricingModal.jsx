/**
 * PricingModal.jsx — the credit packs and their checkout buttons.
 * ---------------------------------------------------------------------------
 */

import { useEffect } from "react";

import { CREDIT_COST, PLANS } from "./studio-config.js";

export default function PricingModal({
  open,
  credits,
  purchasing,
  error,
  cloud,
  signedIn,
  onClose,
  onSelect,
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

        <h2 id="aisg-pricing-title">Buy credits</h2>
        <p className="aisg-modal-sub">
          You have {credits} {credits === 1 ? "credit" : "credits"}. Each generation costs{" "}
          {CREDIT_COST} credit and returns 3 full captions.
        </p>

        <div className="aisg-plans">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={plan.popular ? "aisg-plan aisg-plan-popular" : "aisg-plan"}
            >
              {plan.popular && <span className="aisg-badge">Most popular</span>}
              <h3>{plan.name}</h3>
              <p className="aisg-price">
                <span>${plan.price}</span> one-time
              </p>
              <p className="aisg-plan-tagline">{plan.tagline}</p>
              <ul className="aisg-perks">
                {plan.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <button
                type="button"
                className="aisg-btn aisg-btn-primary aisg-btn-full"
                onClick={() => onSelect(plan)}
                disabled={Boolean(purchasing)}
              >
                {purchasing === plan.id
                  ? "Opening checkout…"
                  : cloud && !signedIn
                    ? "Sign in to buy"
                    : `Get ${plan.credits} credits`}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="aisg-error aisg-modal-error" role="alert">
            {error}
          </p>
        )}

        <p className="aisg-fineprint">
          {cloud && signedIn
            ? "Secure payment by Stripe. You'll be returned here automatically and the credits are added to your account the moment payment clears."
            : cloud
              ? "Sign in first — credits are tied to your email so they follow you to any device."
              : "Demo mode: no card is charged until accounts and Stripe are connected."}
        </p>
      </div>
    </div>
  );
}
