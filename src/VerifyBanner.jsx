/**
 * VerifyBanner.jsx — the "confirm your email" strip
 * ---------------------------------------------------------------------------
 * Shown whenever the signed-in account hasn't confirmed its address. It holds
 * the two ways to finish: paste the six-digit code from the email, or press
 * "Resend verification email" for a fresh one. When the deploy has no mail
 * provider configured the signup response carries the link back, and it is
 * offered here so the flow can still be completed.
 * ---------------------------------------------------------------------------
 */

export default function VerifyBanner({
  email,
  code,
  onCode,
  busy,
  note,
  error,
  fallbackUrl,
  onResend,
  onVerify,
}) {
  return (
    <section className="aisg-verify" aria-label="Verify your email">
      <div className="aisg-verify-head">
        <span className="aisg-verify-mark" aria-hidden="true" />
        <div>
          <strong>Confirm your email to unlock your 5 free test credits</strong>
          <p>
            We sent a verification link and a six-digit code to{" "}
            <span className="aisg-verify-email">{email}</span>. Your credits are already saved —
            the generator opens the moment the address is confirmed.
          </p>
        </div>
      </div>

      <form className="aisg-verify-form" onSubmit={onVerify}>
        <input
          className="aisg-input aisg-verify-code"
          value={code}
          onChange={(event) => onCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Six-digit verification code"
        />
        <button
          type="submit"
          className="aisg-btn aisg-btn-primary aisg-btn-small"
          disabled={busy || code.length < 6}
        >
          {busy ? "Checking…" : "Verify code"}
        </button>
        <button
          type="button"
          className="aisg-btn aisg-btn-outline aisg-btn-small"
          onClick={onResend}
          disabled={busy}
        >
          Resend verification email
        </button>
      </form>

      {note && <p className="aisg-verify-note">{note}</p>}
      {error && <p className="aisg-error aisg-verify-error">{error}</p>}

      {fallbackUrl && (
        <p className="aisg-verify-fallback">
          Email delivery isn't switched on for this deploy yet.{" "}
          <a href={fallbackUrl}>Open your verification link</a> to finish now.
        </p>
      )}
    </section>
  );
}
