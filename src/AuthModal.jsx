/**
 * AuthModal.jsx — sign in / create account
 * ---------------------------------------------------------------------------
 * Email + password, posted to /api/auth/signup or /api/auth/login. The server
 * sets an HttpOnly cookie, so nothing secret is ever stored in this file.
 * Kept separate from App.jsx so the screen file stays readable.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";

export default function AuthModal({ open, base, onClose, onAuthed }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!open) return null;

  const signingUp = mode === "signup";

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }
    if (signingUp && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${base}/api/auth/${signingUp ? "signup" : "login"}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.user) {
        throw new Error(data.error || `Couldn't sign you in (${response.status}).`);
      }

      setPassword("");
      onAuthed(data.user);
    } catch (err) {
      const message = String(err?.message || err);
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Check your connection and try again."
          : message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="aisg-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="aisg-modal aisg-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aisg-auth-title"
      >
        <button type="button" className="aisg-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 id="aisg-auth-title">{signingUp ? "Create your account" : "Sign in"}</h2>
        <p className="aisg-modal-sub">
          {signingUp
            ? "Your credits are saved to this email, so they follow you to any device. New accounts get 3 free credits."
            : "Enter the email and password you signed up with."}
        </p>

        <form className="aisg-auth-form" onSubmit={submit}>
          <div className="aisg-field">
            <label className="aisg-label aisg-label-small" htmlFor="aisg-email">
              Email
            </label>
            <input
              id="aisg-email"
              className="aisg-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="aisg-field">
            <label className="aisg-label aisg-label-small" htmlFor="aisg-password">
              Password
            </label>
            <input
              id="aisg-password"
              className="aisg-input"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              placeholder={signingUp ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className="aisg-error aisg-modal-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="aisg-btn aisg-btn-primary aisg-btn-full" disabled={busy}>
            {busy ? (
              <>
                <span className="aisg-spinner" aria-hidden="true" />{" "}
                {signingUp ? "Creating account…" : "Signing in…"}
              </>
            ) : signingUp ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </button>

          <p className="aisg-auth-switch">
            {signingUp ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="aisg-link"
              onClick={() => {
                setMode(signingUp ? "signin" : "signup");
                setError(null);
              }}
            >
              {signingUp ? "Sign in" : "Create one"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
