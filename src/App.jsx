/**
 * App.jsx — OmniContext AI
 * ---------------------------------------------------------------------------
 * One screen that:
 *   • keeps a Brand Vault per account (/api/brand) and writes with it
 *   • turns one idea into LinkedIn, Instagram/Facebook and TikTok at once
 *     (/api/generate), with the anti-cliché voice rules applied server-side
 *   • shows accounts, plan status and usage from /api/auth/me
 *   • locks the generator until the address is confirmed, with a banner that
 *     resends the email or takes the six-digit code (/api/auth/verify)
 *   • opens a subscription pricing modal (Creator €19 / Agency €49) whose
 *     buttons start a real monthly Stripe Checkout session
 *   • still works in guest mode (credits in localStorage) when the backend has
 *     no database configured
 *
 * Requires: React 18+.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { CSS } from "./styles.js";
import { OMNI_CSS } from "./styles-omni.js";
import AuthModal from "./AuthModal.jsx";
import BrandHeader from "./BrandHeader.jsx";
import BrandVaultPanel from "./BrandVaultPanel.jsx";
import GeneratorForm from "./GeneratorForm.jsx";
import PricingModal from "./PricingModal.jsx";
import ResultsSection from "./ResultsSection.jsx";
import VerifyBanner from "./VerifyBanner.jsx";
import {
  CREDIT_COST,
  CREDITS_KEY,
  FREE_CREDITS,
  MAX_RESULTS,
  RESULTS_KEY,
  TONES,
  TONE_MAP,
  copyText,
  makeId,
  readStorage,
  writeStorage,
} from "./studio-config.js";

export { CREDIT_COST, FREE_CREDITS, PLANS, TONES } from "./studio-config.js";

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
  const [tone, setTone] = useState(TONES[0].id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [pricingOpen, setPricingOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [pricingError, setPricingError] = useState(null);

  const [keyMissing, setKeyMissing] = useState(false);

  /* Email verification */
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNote, setVerifyNote] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [verifyLink, setVerifyLink] = useState(null);

  /* Brand Vault */
  const [vaults, setVaults] = useState([]);
  const [brandId, setBrandId] = useState("");
  const [vaultLimit, setVaultLimit] = useState(1);
  const [vaultSaving, setVaultSaving] = useState(false);
  const [vaultError, setVaultError] = useState(null);

  const copyTimer = useRef(null);
  const noticeTimer = useRef(null);

  /* Cloud mode means the balance and plan are the server's, not this browser's. */
  const cloud = accountsEnabled && sessionReady;
  const unlimited = Boolean(user?.unlimited);
  const credits = cloud ? (user?.credits ?? 0) : guestCredits;
  const creditTotal = Number(user?.freeCredits) || FREE_CREDITS;
  const needsSignIn = cloud && !user;
  const selectedBrand = vaults.find((vault) => vault.id === brandId) || null;
  const verified = !user || user.emailVerified !== false;
  const outOfCredits = !unlimited && !needsSignIn && credits < CREDIT_COST;

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

  /* The Brand Vault only exists for a signed-in account. */
  const loadVaults = useCallback(async () => {
    if (!cloud || !user) {
      setVaults([]);
      setBrandId("");
      return;
    }
    try {
      const response = await fetch(`${base}/api/brand`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data) return;
      const list = Array.isArray(data.vaults) ? data.vaults : [];
      setVaults(list);
      setVaultLimit(Number(data.limit) || 1);
      setBrandId((current) =>
        current && list.some((vault) => vault.id === current) ? current : list[0]?.id || ""
      );
    } catch {
      /* the generator works without a vault too */
    }
  }, [base, cloud, user]);

  /* First load: who is signed in, did we just come back from Stripe, and is
     this a verification link? */
  useEffect(() => {
    let alive = true;

    (async () => {
      await refreshSession();
      if (!alive) return;

      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("verify");
        const state = params.get("checkout");

        if (state === "success") {
          setNotice("Payment received — your plan and credits are syncing.");
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

        if (token) {
          const response = await fetch(`${base}/api/auth/verify`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            if (alive && data.user) setUser(data.user);
            flash("Email confirmed — your free test credits are unlocked.");
          } else {
            setVerifyError(String(data.error || "That link didn't work. Use the code below."));
          }
        }

        if (state || token) {
          params.delete("checkout");
          params.delete("session_id");
          params.delete("verify");
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
  }, [base, refreshSession]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

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

    /* No confirmation yet: point at the banner instead of spending a request. */
    if (cloud && user && user.emailVerified === false) {
      setError("Confirm your email first — the verification banner above has the code box.");
      return;
    }

    const idea = topic.trim();
    if (!idea) {
      setError("Write the idea first — one or two sentences is plenty.");
      return;
    }
    if (!unlimited && credits < CREDIT_COST) {
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
        body: JSON.stringify({ topic: idea, tone, brandId: brandId || undefined }),
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
      if (response.status === 403 && data.code === "email_unverified") {
        await refreshSession();
        setError(data.error || "Verify your email address first.");
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || `The server replied with ${response.status}.`);
      }
      if (!data.channels) {
        throw new Error("The AI sent back an empty answer. Try again.");
      }

      if (cloud && typeof data.credits === "number") {
        setUser((current) => (current ? { ...current, credits: data.credits } : current));
        if (data.credits < 1 && !unlimited) {
          flash(
            `That was your last free test credit. The button above now opens the plans — nothing is charged until you choose one.`
          );
        }
      }

      const entry = {
        id: makeId(),
        topic: idea,
        tone,
        toneLabel: TONE_MAP[tone]?.label || "",
        brandName: data.brand?.name || null,
        language: data.detectedLanguage || data.channels?.detectedLanguage || null,
        channels: {
          linkedin: { text: String(data.channels.linkedin?.text || "").trim() },
          instagram: {
            text: String(data.channels.instagram?.text || "").trim(),
            hashtags: Array.isArray(data.channels.instagram?.hashtags)
              ? data.channels.instagram.hashtags.map((tag) => String(tag))
              : [],
          },
          tiktok: {
            hook: String(data.channels.tiktok?.hook || "").trim(),
            script: String(data.channels.tiktok?.script || "").trim(),
          },
        },
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

  async function handleVerifyCode(event) {
    event?.preventDefault?.();
    if (verifyBusy || !user) return;

    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyNote(null);
    try {
      const response = await fetch(`${base}/api/auth/verify`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, code: verifyCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Couldn't verify that (${response.status}).`);

      if (data.user) setUser(data.user);
      setVerifyCode("");
      setVerifyLink(null);
      flash("Email confirmed — your free test credits are unlocked.");
    } catch (err) {
      setVerifyError(String(err?.message || err));
    } finally {
      setVerifyBusy(false);
    }
  }

  async function handleResend() {
    if (verifyBusy || !user) return;

    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyNote(null);
    try {
      const response = await fetch(`${base}/api/auth/resend`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await response.json().catch(() => ({}));

      if (data.url) setVerifyLink(data.url);
      if (!response.ok) {
        throw new Error(data.error || `Couldn't resend that (${response.status}).`);
      }
      setVerifyNote(
        data.sent
          ? `Sent again to ${user.email}. It can take a minute or two — check spam too.`
          : data.alreadyVerified
            ? "This address is already confirmed."
            : "No mail provider is configured on this deploy, so use the link below."
      );
    } catch (err) {
      setVerifyError(String(err?.message || err));
    } finally {
      setVerifyBusy(false);
    }
  }

  async function handleSaveBrand(draft) {
    if (vaultSaving) return false;
    setVaultSaving(true);
    setVaultError(null);
    try {
      const response = await fetch(`${base}/api/brand`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Couldn't save that (${response.status}).`);

      if (Array.isArray(data.vaults)) setVaults(data.vaults);
      if (typeof data.limit === "number") setVaultLimit(data.limit);
      if (data.vault?.id) setBrandId(data.vault.id);
      flash(`Brand saved — "${data.vault?.name}" is now in every generation.`);
      return true;
    } catch (err) {
      setVaultError(String(err?.message || err));
      return false;
    } finally {
      setVaultSaving(false);
    }
  }

  async function handleDeleteBrand(id) {
    if (!id) return;
    try {
      const response = await fetch(`${base}/api/brand?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't remove that brand.");
      if (Array.isArray(data.vaults)) setVaults(data.vaults);
      setBrandId((current) => (current === id ? "" : current));
      flash("Brand removed from your vault.");
    } catch (err) {
      setVaultError(String(err?.message || err));
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
        setPricingOpen(false);
        flash("Demo checkout — connect Stripe to take real payments.");
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
      /* The cookie is HttpOnly, so only the server can clear it — even if this
         request fails, the page returns to the signed-out screen and the
         session expires on its own. */
    }
    setUser(null);
    setPricingOpen(false);
    setError(null);
    setResults([]);
    setTopic("");
    setVaults([]);
    setBrandId("");
    setVerifyCode("");
    setVerifyNote(null);
    setVerifyError(null);
    setVerifyLink(null);
    setAuthOpen(true); // straight back to the sign-in screen
    flash("You're logged out. Your plan and Brand Vault are safe on your account.");
    refreshSession();
  }

  function handleAuthed(nextUser, verification) {
    setUser(nextUser);
    setAuthOpen(false);
    if (nextUser?.emailVerified === false) {
      setVerifyCode("");
      setVerifyError(null);
      setVerifyNote(
        verification?.sent
          ? "Check your inbox — the link and code are on their way."
          : null
      );
      setVerifyLink(verification?.url || null);
      flash("One step left: confirm your email to unlock your 5 free test credits.");
      return;
    }
    flash(`Signed in as ${nextUser.email}.`);
  }

  async function handleCopy(text, id) {
    const ok = await copyText(text);
    if (!ok) {
      setError("Your browser blocked clipboard access — select the text and copy it by hand.");
      return;
    }
    setCopiedId(id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
  }

  function clearHistory() {
    setResults([]);
    flash("History cleared. Your plan and credits are untouched.");
  }

  const creditWord = credits === 1 ? "free test credit left" : "free test credits left";

  return (
    <div className="aisg">
      <style>{CSS}</style>
      <style>{OMNI_CSS}</style>

      <div className="aisg-shell">
        <BrandHeader
          credits={credits}
          creditTotal={creditTotal}
          creditWord={creditWord}
          unlimited={unlimited}
          plan={user?.plan}
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

        {cloud && user && user.emailVerified === false && (
          <VerifyBanner
            email={user.email}
            code={verifyCode}
            onCode={setVerifyCode}
            busy={verifyBusy}
            note={verifyNote}
            error={verifyError}
            fallbackUrl={verifyLink}
            onResend={handleResend}
            onVerify={handleVerifyCode}
          />
        )}

        {cloud && user && user.emailVerified !== false && (
          <BrandVaultPanel
            vaults={vaults}
            limit={vaultLimit}
            selectedId={brandId}
            unlimited={unlimited}
            saving={vaultSaving}
            error={vaultError}
            onSelect={setBrandId}
            onSave={handleSaveBrand}
            onDelete={handleDeleteBrand}
          />
        )}

        <GeneratorForm
          topic={topic}
          onTopic={setTopic}
          tone={tone}
          onTone={setTone}
          loading={loading}
          unlimited={unlimited}
          credits={credits}
          creditTotal={creditTotal}
          creditWord={creditWord}
          needsSignIn={needsSignIn}
          verified={verified}
          outOfCredits={outOfCredits}
          brand={selectedBrand}
          onUpgrade={() => {
            setPricingError(null);
            setPricingOpen(true);
          }}
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
        purchasing={purchasing}
        error={pricingError}
        cloud={cloud}
        signedIn={Boolean(user)}
        plan={user?.plan}
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
