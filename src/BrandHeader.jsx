/**
 * BrandHeader.jsx — the logo, the plan/credit counter and the account controls.
 * ---------------------------------------------------------------------------
 * Purely presentational: everything it needs arrives as props, so the screen
 * file stays about state instead of markup. The markup keeps the `.aisg-wallet`
 * and `.aisg-user` hooks that the phone breakpoints in styles.js rely on.
 * ---------------------------------------------------------------------------
 */

export default function BrandHeader({
  credits,
  creditTotal,
  creditWord,
  unlimited,
  plan,
  user,
  accountsOn,
  billingBusy,
  onBuy,
  onSignIn,
  onSignOut,
  onManageBilling,
}) {
  const planLabel = unlimited ? `${plan ? plan[0].toUpperCase() + plan.slice(1) : "Paid"} plan` : null;
  const verified = user ? user.emailVerified !== false : false;

  return (
    <header className="aisg-head">
      <div className="aisg-brand">
        <span className="aisg-mark">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path
              d="M13.5 14h21a4 4 0 0 1 4 4v9.5a4 4 0 0 1-4 4h-11l-7.5 5.8V31.5h-2.5a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
              fill="#fff"
            />
            <circle cx="19" cy="23.2" r="1.9" fill="#6d5cf6" />
            <circle cx="24" cy="23.2" r="1.9" fill="#8c53ee" />
            <circle cx="29" cy="23.2" r="1.9" fill="#c44fd2" />
            <path
              d="M36.2 4.4l1.4 3.02 3.02 1.4-3.02 1.4-1.4 3.02-1.4-3.02-3.02-1.4 3.02-1.4 1.4-3.02Z"
              fill="#fff"
            />
          </svg>
        </span>
        <div>
          <h1>OmniContext AI</h1>
          <p>Multi-channel content in your brand's voice</p>
        </div>
      </div>

      <div className="aisg-wallet">
        <div className="aisg-credits" aria-live="polite">
          <span aria-hidden="true">{unlimited ? "∞" : "⚡"}</span>
          <strong>{unlimited ? "Unlimited" : credits}</strong>
          {unlimited ? (
            <span className="aisg-credits-label">{planLabel}</span>
          ) : (
            <span className="aisg-credits-label">
              of {creditTotal} {creditWord}
            </span>
          )}
        </div>
        <button type="button" className="aisg-btn aisg-btn-outline" onClick={onBuy}>
          {unlimited ? "Plans" : "Upgrade"}
        </button>
        {unlimited && user && (
          <button
            type="button"
            className="aisg-btn aisg-btn-outline aisg-manage"
            onClick={onManageBilling}
            disabled={Boolean(billingBusy)}
            title="Update your card, switch plans or cancel"
          >
            {billingBusy ? "Opening…" : "Manage billing"}
          </button>
        )}
        {accountsOn &&
          (user ? (
            <div className="aisg-user">
              <span className="aisg-account">
                <span className="aisg-avatar" aria-hidden="true">
                  {String(user.email || "?").trim().charAt(0).toUpperCase()}
                </span>
                <span className="aisg-who" title={user.email}>
                  {user.email}
                </span>
                {!verified && (
                  <span className="aisg-chip aisg-chip-warn" title="Email not verified yet">
                    Unverified
                  </span>
                )}
              </span>
              <button
                type="button"
                className="aisg-btn aisg-logout"
                onClick={onSignOut}
                title="Log out of this device"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="aisg-logout-icon">
                  <path
                    d="M8 3.25H4.75a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 1.5 1.5H8M13 6.75 16.25 10 13 13.25M16 10H7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Log out
              </button>
            </div>
          ) : (
            <button type="button" className="aisg-btn aisg-btn-outline" onClick={onSignIn}>
              Sign in
            </button>
          ))}
      </div>
    </header>
  );
}
