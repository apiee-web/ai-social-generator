/**
 * BrandHeader.jsx — the logo, the credit counter and the account controls.
 * ---------------------------------------------------------------------------
 * Purely presentational: everything it needs arrives as props, so the screen
 * file stays about state instead of markup.
 * ---------------------------------------------------------------------------
 */

export default function BrandHeader({
  credits,
  creditWord,
  user,
  accountsOn,
  onBuy,
  onSignIn,
  onSignOut,
}) {
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
          <h1>Social Post Studio</h1>
          <p>Real AI captions for every platform</p>
        </div>
      </div>

      <div className="aisg-wallet">
        <div className="aisg-credits" aria-live="polite">
          <span aria-hidden="true">⚡</span>
          <strong>{credits}</strong>
          <span className="aisg-credits-label">{creditWord}</span>
        </div>
        <button type="button" className="aisg-btn aisg-btn-outline" onClick={onBuy}>
          Buy credits
        </button>
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
