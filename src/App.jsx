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

import { CSS } from "./styles.js";
import AuthModal from "./AuthModal.jsx";
import BrandHeader from "./BrandHeader.jsx";
import GeneratorForm from "./GeneratorForm.jsx";
import PricingModal from "./PricingModal.jsx";
import ResultsSection from "./ResultsSection.jsx";
import {
  CREDIT_COST,
  CREDITS_KEY,
  FREE_CREDITS,
  MAX_RESULTS,
  PLATFORM_MAP,
  PLATFORMS,
  RESULTS_KEY,
  TONES,
  cleanHashtags,
  copyText,
  makeId,
  readStorage,
  writeStorage,
} from "./studio-config.js";

export { CREDIT_COST, FREE_CREDITS, PLANS, PLATFORMS, TONES } from "./studio-config.js";

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
      /* The cookie is HttpOnly, so only the server can clear it — but even if
         this request fails we still return to the signed-out screen, and the
         session expires on its own. */
    }
    setUser(null);
    setPricingOpen(false);
    setError(null);
    setResults([]);
    setTopic("");
    setAuthOpen(true); // straight back to the sign-in screen
    flash("You're logged out. Your credits stay on your account.");
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
        <BrandHeader
          credits={credits}
          creditWord={creditWord}
          user={user}
          accountsOn={cloud}
          onBuy={() => {
            setPricingError(null);
            setPricingOpen(true);
          }}
          onSignIn={() => setAuthOpen(true)}
          onSignOut={handleSignOut}
        />

        {keyMissing && (
          <div className="aisg-warn" role="status">
            <strong>No AI key found.</strong> Add <code>AI_API_KEY</code> to your environment
            and redeploy — generation can't work until you do.
          </div>
        )}

        <GeneratorForm
          topic={topic}
          onTopic={setTopic}
          platform={platform}
          onPlatform={setPlatform}
          tone={tone}
          onTone={setTone}
          loading={loading}
          credits={credits}
          creditWord={creditWord}
          needsSignIn={needsSignIn}
          platformLabel={selectedPlatform.label}
          onSubmit={handleGenerate}
        />

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

        <ResultsSection
          results={results}
          loading={loading}
          copiedId={copiedId}
          onCopy={handleCopy}
          onClear={clearHistory}
        />
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
