/**
 * App.jsx — AI Social Post Studio
 * ---------------------------------------------------------------------------
 * A complete, self-contained screen that:
 *   • sends the user's idea to your own backend (/api/generate), which calls a
 *     real LLM. The API key lives on the server, never in this file.
 *   • shows a sign-in / create-account modal. Once accounts are live, credits
 *     live on the server per email — signing in from another phone shows the
 *     same balance.
 *   • falls back to guest mode (credits in localStorage) until the backend has
 *     accounts configured, so the page always works.
 *   • opens a pricing modal whose buttons start a real Stripe Checkout session;
 *     credits are added by the Stripe webhook, not by this page.
 *
 * Requires: React 18+.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Config — the numbers you will most likely want to change                  */
/* -------------------------------------------------------------------------- */

const FREE_CREDITS = 3; // credits a brand-new visitor starts with
const CREDIT_COST = 1; // credits charged per generation
const CREDITS_KEY = "aisg:credits:v1"; // localStorage key for the guest balance
const RESULTS_KEY = "aisg:results:v1"; // localStorage key for past captions
const MAX_RESULTS = 8; // how many past generations to keep in the list

const PLATFORMS = [
  { id: "instagram", label: "Instagram", limit: 2200 },
  { id: "x", label: "X / Twitter", limit: 280 },
  { id: "linkedin", label: "LinkedIn", limit: 3000 },
  { id: "tiktok", label: "TikTok", limit: 2200 },
  { id: "facebook", label: "Facebook", limit: 63206 },
];

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "bold", label: "Bold" },
  { id: "witty", label: "Witty" },
  { id: "professional", label: "Professional" },
  { id: "inspirational", label: "Inspirational" },
];

/* Display copy only — the real prices are in api/_lib/plans.js. */
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 9,
    credits: 50,
    tagline: "Try it out",
    perks: ["50 generations", "All 5 platforms", "Every tone", "Copy-ready captions"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    credits: 250,
    tagline: "For creators",
    popular: true,
    perks: ["250 generations", "Everything in Starter", "3 options per post", "Saved history"],
  },
  {
    id: "agency",
    name: "Agency",
    price: 49,
    credits: 1000,
    tagline: "For teams",
    perks: ["1,000 generations", "Everything in Pro", "Best price per post", "Priority support"],
  },
];

const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
const TONE_MAP = Object.fromEntries(TONES.map((t) => [t.id, t]));

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                            */
/* -------------------------------------------------------------------------- */

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the app still works, it just won't remember */
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function cleanHashtags(hashtags) {
  if (!Array.isArray(hashtags)) return [];
  return hashtags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/g, "")}`));
}

/** Caption body + hashtags, exactly as it should be pasted into the app. */
function composeText(variant) {
  const body = String(variant?.text ?? "").trim();
  const tags = cleanHashtags(variant?.hashtags);
  return tags.length > 0 ? `${body}\n\n${tags.join(" ")}` : body;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  App                                                                      */
/* -------------------------------------------------------------------------- */

export default function App({ apiBase = "" }) {
  const base = apiBase.replace(/\/+$/, "");

  /* Accounts: until /api/auth/me answers, we don't know which mode we're in. */
  const [accountsEnabled, setAccountsEnabled] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [guestCredits, setGuestCredits] = useState(() => {
    const stored = Number(readStorage(CREDITS_KEY, FREE_CREDITS));
    return Number.isFinite(stored) && stored >= 0 ? stored : FREE_CREDITS;
  });

  const [results, setResults] = useState(() => {
    const stored = readStorage(RESULTS_KEY, []);
    return Array.isArray(stored) ? stored.slice(0, MAX_RESULTS) : [];
  });

  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0].id);
  const [tone, setTone] = useState(TONES[0].id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [pricingOpen, setPricingOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [pricingError, setPricingError] = useState(null);

  const [keyMissing, setKeyMissing] = useState(false);

  const copyTimer = useRef(null);
  const noticeTimer = useRef(null);

  /* Cloud mode means the balance is the server's, not this browser's. */
  const cloud = accountsEnabled && sessionReady;
  const credits = cloud ? (user?.credits ?? 0) : guestCredits;

  function flash(message) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(`${base}/api/auth/me`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      /* 503 = accounts aren't configured on the server: guest mode. */
      if (response.status === 503) {
        setAccountsEnabled(false);
        setUser(null);
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setAccountsEnabled(true);
        setUser(data.user || null);
      }
    } catch {
      /* Offline or static host — guest mode keeps the page usable. */
      setAccountsEnabled(false);
    } finally {
      setSessionReady(true);
    }
  }, [base]);

  /* First load: who is signed in, and did we just come back from Stripe? */
  useEffect(() => {
    let alive = true;

    (async () => {
      await refreshSession();
      if (!alive) return;

      try {
        const params = new URLSearchParams(window.location.search);
        const state = params.get("checkout");
        if (state === "success") {
          setNotice("Payment received — your new credits will appear in a moment.");
          if (noticeTimer.current) clearTimeout(noticeTimer.current);
          noticeTimer.current = setTimeout(() => setNotice(null), 9000);
          /* The webhook may land a second after the redirect; check twice. */
          setTimeout(() => {
            if (alive) refreshSession();
          }, 2500);
        } else if (state === "cancelled") {
          setNotice("Checkout cancelled — no charge was made.");
          if (noticeTimer.current) clearTimeout(noticeTimer.current);
          noticeTimer.current = setTimeout(() => setNotice(null), 6000);
        }
        if (state) {
          params.delete("checkout");
          params.delete("session_id");
          const query = params.toString();
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${query ? `?${query}` : ""}`
          );
        }
      } catch {
        /* older browsers — no harm */
      }
    })();

    return () => {
      alive = false;
    };
  }, [refreshSession]);

  /* Guests still get a remembered balance; signed-in users don't need one. */
  useEffect(() => {
    if (!cloud) writeStorage(CREDITS_KEY, guestCredits);
  }, [guestCredits, cloud]);
  useEffect(() => writeStorage(RESULTS_KEY, results), [results]);

  /* Tell the user up front if the server has no AI key configured. */
  useEffect(() => {
    let alive = true;
    fetch(`${base}/api/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data && data.hasKey === false) setKeyMissing(true);
      })
      .catch(() => {
        /* server not running yet — the first generation will explain it */
      });
    return () => {
      alive = false;
    };
  }, [base]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  async function handleGenerate(event) {
    event?.preventDefault?.();
    if (loading) return;

    /* Signed-out visitors get the login modal instead of a failed request. */
    if (cloud && !user) {
      setError(null);
      setAuthOpen(true);
      return;
    }

    const idea = topic.trim();
    if (!idea) {
      setError("Write what the post should be about first.");
      return;
    }
    if (credits < CREDIT_COST) {
      setPricingOpen(true);
      return;
    }

    setError(null);
    setNotice(null);
    setLoading(true);

    /* Guests are charged here and refunded below if it fails. Signed-in users
       are charged by the server, which returns the new balance. */
    let chargedUpFront = false;
    if (!cloud) {
      setGuestCredits((value) => value - CREDIT_COST);
      chargedUpFront = true;
    }

    try {
      const response = await fetch(`${base}/api/generate`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: idea, platform, tone, count: 3 }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setAuthOpen(true);
        return;
      }
      if (response.status === 402) {
        setPricingOpen(true);
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || `The server replied with ${response.status}.`);
      }
      if (!Array.isArray(data.variants) || data.variants.length === 0) {
        throw new Error("The AI sent back an empty answer. Try again.");
      }

      if (cloud && typeof data.credits === "number") {
        setUser((current) => (current ? { ...current, credits: data.credits } : current));
      }

      const entry = {
        id: makeId(),
        topic: idea,
        platform,
        tone,
        variants: data.variants.map((variant) => ({
          text: String(variant?.text ?? "").trim(),
          hashtags: cleanHashtags(variant?.hashtags),
        })),
        createdAt: Date.now(),
      };
      setResults((previous) => [entry, ...previous].slice(0, MAX_RESULTS));
    } catch (err) {
      if (chargedUpFront) setGuestCredits((value) => value + CREDIT_COST);
      const message = String(err?.message || err);
      setError(
        err instanceof TypeError
          ? "Couldn't reach the AI server. Check your connection and try again."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(plan) {
    if (purchasing) return;

    /* No account yet? Sign in first, then come back to the plan. */
    if (cloud && !user) {
      setPricingOpen(false);
      setAuthOpen(true);
      return;
    }

    setPurchasing(plan.id);
    setPricingError(null);

    try {
      const response = await fetch(`${base}/api/checkout`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await response.json().catch(() => ({}));

      /* Real Stripe Checkout: the server hands back a URL, we follow it. */
      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (response.status === 401) {
        setPricingOpen(false);
        setAuthOpen(true);
        return;
      }
      if (response.ok && data.demo) {
        setGuestCredits((value) => value + data.credits);
        setPricingOpen(false);
        flash(`Added ${data.credits} credits (demo mode — no payment was taken).`);
        return;
      }
      throw new Error(data.error || `Checkout failed (${response.status}).`);
    } catch (err) {
      setPricingError(String(err?.message || err));
    } finally {
      setPurchasing(null);
    }
  }

  async function handleSignOut() {
    try {
      await fetch(`${base}/api/auth/logout`, { method: "POST", credentials: "same-origin" });
    } catch {
      /* even if the request fails the cookie is cleared on reload */
    }
    setUser(null);
    flash("Signed out. Your credits stay on your account.");
    refreshSession();
  }

  function handleAuthed(nextUser) {
    setUser(nextUser);
    setAuthOpen(false);
    flash(`Signed in as ${nextUser.email}.`);
  }

  async function handleCopy(text, id) {
    const ok = await copyText(text);
    if (!ok) {
      setError("Your browser blocked clipboard access — select the caption and copy it by hand.");
      return;
    }
    setCopiedId(id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
  }

  function clearHistory() {
    setResults([]);
    flash("History cleared. Your credits are untouched.");
  }

  const selectedPlatform = PLATFORM_MAP[platform] || PLATFORMS[0];
  const creditWord = credits === 1 ? "credit" : "credits";
  const needsSignIn = cloud && !user;

  return (
    <div className="aisg">
      <style>{CSS}</style>

      <div className="aisg-shell">
        <header className="aisg-head">
          <div className="aisg-brand">
            <span className="aisg-mark" aria-hidden="true">
              ✦
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
            <button
              type="button"
              className="aisg-btn aisg-btn-outline"
              onClick={() => {
                setPricingError(null);
                setPricingOpen(true);
              }}
            >
              Buy credits
            </button>
            {cloud &&
              (user ? (
                <button type="button" className="aisg-link aisg-account" onClick={handleSignOut}>
                  <span className="aisg-who" title={user.email}>
                    {user.email}
                  </span>
                  <span>Sign out</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="aisg-btn aisg-btn-outline"
                  onClick={() => setAuthOpen(true)}
                >
                  Sign in
                </button>
              ))}
          </div>
        </header>

        {keyMissing && (
          <div className="aisg-warn" role="status">
            <strong>No AI key found.</strong> Add <code>AI_API_KEY</code> to your environment
            and redeploy — generation can't work until you do.
          </div>
        )}

        <form className="aisg-card aisg-form" onSubmit={handleGenerate}>
          <label className="aisg-label" htmlFor="aisg-topic">
            What's the post about?
          </label>
          <textarea
            id="aisg-topic"
            className="aisg-input aisg-textarea"
            rows={3}
            maxLength={400}
            placeholder="e.g. We just launched a reusable coffee cup that keeps drinks hot for 8 hours"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                handleGenerate(event);
              }
            }}
          />

          <div className="aisg-controls">
            <div className="aisg-field">
              <label className="aisg-label aisg-label-small" htmlFor="aisg-platform">
                Platform
              </label>
              <select
                id="aisg-platform"
                className="aisg-input"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              >
                {PLATFORMS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="aisg-field">
              <label className="aisg-label aisg-label-small" htmlFor="aisg-tone">
                Tone
              </label>
              <select
                id="aisg-tone"
                className="aisg-input"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
              >
                {TONES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="aisg-btn aisg-btn-primary aisg-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="aisg-spinner" aria-hidden="true" /> Writing…
                </>
              ) : (
                <>Generate · {CREDIT_COST} credit</>
              )}
            </button>
          </div>

          <p className="aisg-hint">
            {needsSignIn
              ? "Sign in to start — a new account comes with 3 free credits."
              : credits > 0
                ? `${credits} ${creditWord} left · each generation returns 3 options for ${selectedPlatform.label}`
                : "You're out of credits — buy more to keep generating."}
          </p>
        </form>

        {error && (
          <div className="aisg-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="aisg-notice" role="status">
            {notice}
          </div>
        )}

        <section className="aisg-results" aria-busy={loading}>
          <div className="aisg-results-head">
            <h2>Your captions</h2>
            {results.length > 0 && (
              <button type="button" className="aisg-link" onClick={clearHistory}>
                Clear history
              </button>
            )}
          </div>

          {loading && <LoadingCard />}

          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          ))}

          {!loading && results.length === 0 && (
            <div className="aisg-empty">
              <p className="aisg-empty-title">No captions yet</p>
              <p>
                Type an idea above, pick a platform and a tone, then hit Generate. You get
                three different angles to choose from.
              </p>
            </div>
          )}
        </section>
      </div>

      <PricingModal
        open={pricingOpen}
        credits={credits}
        purchasing={purchasing}
        error={pricingError}
        cloud={cloud}
        signedIn={Boolean(user)}
        onClose={() => setPricingOpen(false)}
        onSelect={handlePurchase}
      />

      <AuthModal
        open={authOpen}
        base={base}
        onClose={() => setAuthOpen(false)}
        onAuthed={handleAuthed}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                           */
/* -------------------------------------------------------------------------- */

function ResultCard({ result, copiedId, onCopy }) {
  const platform = PLATFORM_MAP[result.platform] || PLATFORMS[0];
  const tone = TONE_MAP[result.tone];

  return (
    <article className="aisg-card aisg-result">
      <div className="aisg-result-head">
        <div className="aisg-result-meta">
          <span className="aisg-chip">{platform.label}</span>
          {tone && <span className="aisg-chip aisg-chip-soft">{tone.label}</span>}
          <span className="aisg-time">{timeAgo(result.createdAt)}</span>
        </div>
        <p className="aisg-result-topic" title={result.topic}>
          {result.topic}
        </p>
      </div>

      <div className="aisg-variants">
        {result.variants.map((variant, index) => {
          const text = composeText(variant);
          const id = `${result.id}-${index}`;
          const over = text.length > platform.limit;

          return (
            <div className="aisg-variant" key={id}>
              <p className="aisg-variant-text">{text}</p>
              <div className="aisg-variant-foot">
                <span className={over ? "aisg-count aisg-count-over" : "aisg-count"}>
                  {text.length.toLocaleString()} / {platform.limit.toLocaleString()}
                  {over ? " · too long" : ""}
                </span>
                <button
                  type="button"
                  className="aisg-btn aisg-btn-small"
                  onClick={() => onCopy(text, id)}
                >
                  {copiedId === id ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function LoadingCard() {
  return (
    <article className="aisg-card aisg-result">
      <div className="aisg-skeleton aisg-skeleton-short" />
      <div className="aisg-skeleton" />
      <div className="aisg-skeleton" />
      <div className="aisg-skeleton aisg-skeleton-tiny" />
    </article>
  );
}

function PricingModal({ open, credits, purchasing, error, cloud, signedIn, onClose, onSelect }) {
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

function AuthModal({ open, base, onClose, onAuthed }) {
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

/* -------------------------------------------------------------------------- */
/*  Styles (scoped by the .aisg prefix, no extra CSS file needed)            */
/* -------------------------------------------------------------------------- */

const CSS = `
.aisg {
  --bg: #f4f5fb;
  --card: #ffffff;
  --ink: #12142a;
  --muted: #656b8c;
  --line: #e4e7f3;
  --accent: #5b53f0;
  --accent-2: #d84bc0;
  --ok: #0f9d6b;
  --danger: #cf2f4b;
  min-height: 100vh;
  background:
    radial-gradient(900px 500px at 12% -10%, #e8e7ff 0%, rgba(232, 231, 255, 0) 60%),
    radial-gradient(800px 460px at 92% 0%, #ffe6f6 0%, rgba(255, 230, 246, 0) 55%),
    var(--bg);
  color: var(--ink);
  padding: 32px 20px 72px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.aisg *, .aisg *::before, .aisg *::after { box-sizing: border-box; }
.aisg-shell { max-width: 940px; margin: 0 auto; }
.aisg h1, .aisg h2, .aisg h3, .aisg p { margin: 0; }

.aisg-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
}
.aisg-brand { display: flex; align-items: center; gap: 12px; }
.aisg-mark {
  width: 42px; height: 42px; border-radius: 13px; flex: none;
  display: grid; place-items: center; font-size: 19px; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 20px rgba(91, 83, 240, 0.32);
}
.aisg-brand h1 { font-size: 20px; letter-spacing: -0.02em; }
.aisg-brand p { font-size: 13px; color: var(--muted); margin-top: 2px; }

.aisg-wallet { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.aisg-credits {
  display: flex; align-items: baseline; gap: 5px;
  background: var(--card); border: 1px solid var(--line);
  border-radius: 999px; padding: 9px 16px; font-size: 13px; color: var(--muted);
  box-shadow: 0 1px 2px rgba(18, 20, 42, 0.04);
}
.aisg-credits strong { font-size: 16px; color: var(--ink); font-variant-numeric: tabular-nums; }
.aisg-credits-label { font-size: 12px; }
.aisg-account {
  display: flex; align-items: center; gap: 8px; text-decoration: none;
  background: none; border: none; font: inherit; cursor: pointer; color: var(--muted);
}
.aisg-account:hover { color: var(--ink); }
.aisg-who {
  max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px;
}

.aisg-card {
  background: var(--card); border: 1px solid var(--line); border-radius: 18px;
  padding: 22px; box-shadow: 0 1px 2px rgba(18, 20, 42, 0.04), 0 12px 32px -18px rgba(18, 20, 42, 0.22);
}
.aisg-form { margin-bottom: 18px; }
.aisg-label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.aisg-label-small { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }

.aisg-input {
  width: 100%; font: inherit; font-size: 15px; color: var(--ink);
  background: #fbfbff; border: 1px solid var(--line); border-radius: 12px;
  padding: 12px 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.aisg-input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(91, 83, 240, 0.12); background: #fff; }
.aisg-textarea { resize: vertical; min-height: 84px; line-height: 1.55; }

.aisg-controls {
  display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px;
  align-items: end; margin-top: 14px;
}
.aisg-field { display: flex; flex-direction: column; }
.aisg-submit { height: 44px; white-space: nowrap; }

.aisg-hint { font-size: 12.5px; color: var(--muted); margin-top: 12px; }

.aisg-btn {
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  border-radius: 11px; border: 1px solid transparent; padding: 11px 18px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform 0.12s, box-shadow 0.15s, background 0.15s, opacity 0.15s;
}
.aisg-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.aisg-btn:not(:disabled):active { transform: translateY(1px); }
.aisg-btn-primary {
  color: #fff; background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 10px 24px -10px rgba(91, 83, 240, 0.8);
}
.aisg-btn-primary:not(:disabled):hover { box-shadow: 0 14px 28px -10px rgba(91, 83, 240, 0.9); }
.aisg-btn-outline { background: var(--card); border-color: var(--line); color: var(--ink); }
.aisg-btn-outline:hover { border-color: #c9cde4; background: #fafaff; }
.aisg-btn-small { font-size: 12.5px; padding: 7px 13px; background: #f3f4fb; border-color: var(--line); color: var(--ink); font-weight: 600; }
.aisg-btn-small:hover { background: #eaecf9; }
.aisg-btn-full { width: 100%; }
.aisg-link { font: inherit; font-size: 13px; background: none; border: none; color: var(--muted); cursor: pointer; padding: 0; text-decoration: underline; }
.aisg-link:hover { color: var(--ink); }

.aisg-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff;
  animation: aisg-spin 0.7s linear infinite;
}
@keyframes aisg-spin { to { transform: rotate(360deg); } }

.aisg-warn {
  background: #fff8e6; border: 1px solid #f3ddab; color: #7a5a10;
  border-radius: 13px; padding: 12px 16px; font-size: 13.5px; line-height: 1.6; margin-bottom: 16px;
}
.aisg-warn code, .aisg-fineprint code {
  background: rgba(18, 20, 42, 0.07); border-radius: 5px; padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em;
}
.aisg-error { background: #fdeef1; border: 1px solid #f6c9d2; color: #94203a; border-radius: 13px; padding: 12px 16px; font-size: 13.5px; margin-bottom: 16px; }
.aisg-notice { background: #eafaf2; border: 1px solid #b9ecd5; color: #0a7250; border-radius: 13px; padding: 12px 16px; font-size: 13.5px; margin-bottom: 16px; }

.aisg-results-head { display: flex; align-items: center; justify-content: space-between; margin: 26px 0 12px; }
.aisg-results-head h2 { font-size: 15px; letter-spacing: -0.01em; }
.aisg-result { margin-bottom: 14px; }
.aisg-result-head { margin-bottom: 14px; }
.aisg-result-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.aisg-chip { font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: var(--accent); background: rgba(91, 83, 240, 0.1); border-radius: 7px; padding: 4px 8px; }
.aisg-chip-soft { color: #8a3f9d; background: rgba(216, 75, 192, 0.1); }
.aisg-time { font-size: 12px; color: var(--muted); }
.aisg-result-topic { font-size: 14px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

.aisg-variants { display: grid; gap: 10px; }
.aisg-variant { border: 1px solid var(--line); border-radius: 13px; padding: 14px; background: #fcfcff; }
.aisg-variant-text { font-size: 14.5px; line-height: 1.62; white-space: pre-wrap; word-break: break-word; }
.aisg-variant-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.aisg-count { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.aisg-count-over { color: var(--danger); font-weight: 600; }

.aisg-empty { text-align: center; color: var(--muted); font-size: 14px; line-height: 1.65; padding: 44px 20px; border: 1px dashed var(--line); border-radius: 18px; background: rgba(255, 255, 255, 0.6); }
.aisg-empty-title { font-weight: 700; color: var(--ink); margin-bottom: 6px; font-size: 15px; }

.aisg-skeleton { height: 12px; border-radius: 6px; margin-bottom: 10px; background: linear-gradient(90deg, #eef0f9 25%, #f7f8fd 37%, #eef0f9 63%); background-size: 400% 100%; animation: aisg-shimmer 1.4s ease infinite; }
.aisg-skeleton-short { width: 34%; }
.aisg-skeleton-tiny { width: 55%; margin-bottom: 0; }
@keyframes aisg-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.aisg-overlay {
  position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  padding: 22px; background: rgba(16, 18, 38, 0.55); backdrop-filter: blur(4px);
  overflow-y: auto; animation: aisg-fade 0.16s ease-out;
}
@keyframes aisg-fade { from { opacity: 0; } to { opacity: 1; } }
.aisg-modal {
  position: relative; width: 100%; max-width: 880px; background: var(--card);
  border-radius: 22px; padding: 30px 26px 24px; border: 1px solid var(--line);
  box-shadow: 0 40px 80px -30px rgba(12, 14, 35, 0.6); margin: auto;
}
.aisg-auth-modal { max-width: 420px; }
.aisg-modal h2 { font-size: 21px; letter-spacing: -0.02em; }
.aisg-modal-sub { font-size: 13.5px; color: var(--muted); margin-top: 6px; line-height: 1.6; }
.aisg-close {
  position: absolute; top: 14px; right: 16px; width: 32px; height: 32px;
  border-radius: 9px; border: none; background: #f3f4fb; color: var(--muted);
  font-size: 20px; line-height: 1; cursor: pointer;
}
.aisg-close:hover { background: #e9ebf8; color: var(--ink); }

.aisg-auth-form { display: grid; gap: 14px; margin-top: 20px; }
.aisg-auth-switch { font-size: 12.5px; color: var(--muted); text-align: center; }

.aisg-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 22px 0 14px; }
.aisg-plan { position: relative; border: 1px solid var(--line); border-radius: 16px; padding: 18px 16px; background: #fcfcff; display: flex; flex-direction: column; }
.aisg-plan-popular { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(91, 83, 240, 0.12); background: #fff; }
.aisg-badge { position: absolute; top: -10px; left: 16px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; background: linear-gradient(135deg, var(--accent), var(--accent-2)); border-radius: 999px; padding: 4px 9px; }
.aisg-plan h3 { font-size: 15px; }
.aisg-price { margin-top: 6px; font-size: 12.5px; color: var(--muted); }
.aisg-price span { font-size: 27px; font-weight: 800; letter-spacing: -0.03em; color: var(--ink); margin-right: 4px; }
.aisg-plan-tagline { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
.aisg-perks { list-style: none; padding: 0; margin: 14px 0 18px; display: grid; gap: 8px; flex: 1; }
.aisg-perks li { position: relative; padding-left: 20px; font-size: 13px; line-height: 1.45; color: #3b4064; }
.aisg-perks li::before { content: "✓"; position: absolute; left: 0; top: 0; color: var(--ok); font-weight: 800; font-size: 12px; }
.aisg-modal-error { margin-top: 4px; }
.aisg-fineprint { font-size: 11.5px; color: var(--muted); text-align: center; line-height: 1.6; margin-top: 4px; }

@media (max-width: 720px) {
  .aisg { padding: 22px 14px 56px; }
  .aisg-controls { grid-template-columns: 1fr 1fr; }
  .aisg-submit { grid-column: 1 / -1; }
  .aisg-plans { grid-template-columns: 1fr; }
  .aisg-head { align-items: flex-start; }
  .aisg-wallet { width: 100%; justify-content: space-between; }
}
`;

export { FREE_CREDITS, CREDIT_COST, PLANS, PLATFORMS, TONES };
