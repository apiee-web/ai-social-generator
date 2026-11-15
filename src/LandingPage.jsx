/**
 * LandingPage.jsx — the page signed-out visitors land on.
 * ---------------------------------------------------------------------------
 * Nothing here is interactive beyond opening the existing auth modal and the
 * privacy/terms dialogs: no ads, no chat widget, no external script. The only
 * jobs are "explain the product in ten seconds" and "get an account created".
 *
 * The signed-in app lives in App.jsx and is untouched; App decides which of the
 * two to render. Buttons hand off to the same AuthModal the app uses, in signup
 * or signin mode, so there is one place that talks to /api/auth.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";

import { LANDING_CSS } from "./styles-landing.js";
import { PLANS } from "./studio-config.js";

const STEPS = [
  {
    title: "Build your Brand Vault",
    body:
      "Name the brand, the audience and the offer, then paste 2–3 posts you actually wrote. The AI measures your sentence rhythm, vocabulary and hooks into a Voice DNA profile.",
  },
  {
    title: "Type one idea",
    body:
      "A sentence is enough — in Dutch, English or any language you write in. The language of your idea decides the language of every word that comes back.",
  },
  {
    title: "Copy, paste, post",
    body:
      "LinkedIn gets a hook-story-CTA post, Instagram a caption with 5–7 hashtags, TikTok a 12-word hook and a 350-character spoken script. One click each.",
  },
];

const REASONS = [
  {
    title: "No AI clichés",
    body:
      "“In today's fast-paced world”, “delve”, “game-changer”: filtered out before you ever see them. Sentences of different lengths, concrete details, a human rhythm.",
  },
  {
    title: "One language, start to finish",
    body:
      "The idea's language is detected and enforced on every field — even when your Brand Vault, or the examples behind your Voice DNA, are in another language.",
  },
  {
    title: "Formatted per channel",
    body:
      "Two-sentence paragraphs for LinkedIn, 5–7 hashtags on Instagram, a hook under 12 words and no stage directions or emoji in a spoken script.",
  },
];

const FREE_PERKS = [
  "5 free test credits",
  "1 Brand Vault profile",
  "Voice DNA writing-style clone",
  "All three channels per generation",
  "Unlocks after email verification",
];

const PAID_PERKS = {
  creator: [
    "Unlimited generations",
    "LinkedIn, Instagram and TikTok in one click",
    "1 Brand Vault profile",
    "Voice DNA writing style",
    "Anti-cliché voice guard",
    "Manage or cancel anytime",
  ],
  agency: [
    "Unlimited generations",
    "Everything in Creator",
    "Up to 5 Brand Vault profiles",
    "Switch brands per generation",
    "For agencies and multi-brand creators",
    "Manage or cancel anytime",
  ],
};

const POLICIES = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Your email address, a password (stored only as a one-way hash), the brand profiles and example posts you save, and the ideas you generate with. Card details never reach us — Stripe handles the payment.",
        ],
      },
      {
        heading: "Why we use it",
        paragraphs: [
          "To keep your account, plan and credits; to write in your brand's voice; to send the verification link that unlocks your free credits; and to bill a subscription you started.",
        ],
      },
      {
        heading: "Who processes it",
        paragraphs: [
          "Vercel (hosting), Neon (database), Stripe (payments), Groq (the language model that writes the drafts) and Resend (verification email). Each processes data only to provide that service for us.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "One session cookie that keeps you signed in. No advertising cookies, no third-party analytics, no tracking pixels on this page.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Until you delete your account, which removes your profile, brand vaults and example posts. Invoices are kept as long as tax law requires.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "Email support@getomnicontext.com to access, correct or delete your data. You can also remove individual brand profiles inside the app at any time.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      {
        heading: "The service",
        paragraphs: [
          "OmniContext AI turns an idea you type into drafts for LinkedIn, Instagram/Facebook and TikTok. Drafts are written by an AI model and should be reviewed before you publish them.",
        ],
      },
      {
        heading: "Your account",
        paragraphs: [
          "One account per person. Keep your password to yourself, and remember that anything published from your account is your responsibility.",
        ],
      },
      {
        heading: "Free credits and subscriptions",
        paragraphs: [
          "New verified accounts get 5 free generations, with no card required. Paid plans are monthly subscriptions billed through Stripe: they renew automatically until cancelled, can be cancelled any time from Manage billing, and access lasts until the end of the paid period.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "No unlawful, deceptive or spam content, no scraping or reselling the service, and no attempts to get around credit or plan limits.",
        ],
      },
      {
        heading: "Content and ownership",
        paragraphs: [
          "You keep the rights to the ideas and posts you paste, and to the drafts we produce for you. We keep the product, its prompts and its code.",
        ],
      },
      {
        heading: "Availability and liability",
        paragraphs: [
          "We aim to keep the service running but can't promise uninterrupted access. To the extent the law allows, our liability is limited to what you paid us in the previous three months.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: ["Questions about these terms: support@getomnicontext.com."],
      },
    ],
  },
};

function ChatMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M13.5 14h21a4 4 0 0 1 4 4v9.5a4 4 0 0 1-4 4h-11l-7.5 5.8V31.5h-2.5a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
        fill="#fff"
      />
      <circle cx="19" cy="23.2" r="1.9" fill="#6d5cf6" />
      <circle cx="24" cy="23.2" r="1.9" fill="#8c53ee" />
      <circle cx="29" cy="23.2" r="1.9" fill="#c44fd2" />
    </svg>
  );
}

function PolicyModal({ kind, onClose }) {
  useEffect(() => {
    if (!kind) return undefined;
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
  }, [kind, onClose]);

  if (!kind) return null;
  const policy = POLICIES[kind];
  if (!policy) return null;

  return (
    <div
      className="aisg-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="aisg-modal aisg-policy" role="dialog" aria-modal="true" aria-labelledby="aig-policy-title">
        <button type="button" className="aisg-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="aig-policy-title">{policy.title}</h2>
        <p className="aig-policy-updated">Last updated 15 November 2026</p>

        {policy.sections.map((section) => (
          <div key={section.heading}>
            <h3>{section.heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage({ onStart, onLogin }) {
  const [policy, setPolicy] = useState(null);

  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      blurb: "Try it on your own posts before you pay anything.",
      perks: FREE_PERKS,
      cta: "Start free",
      featured: false,
    },
    ...PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      blurb: plan.tagline,
      perks: PAID_PERKS[plan.id] || plan.perks,
      cta: `Start with ${plan.name}`,
      featured: Boolean(plan.popular),
    })),
  ];

  return (
    <div className="aisg aig">
      <style>{LANDING_CSS}</style>

      <header className="aig-nav">
        <div className="aig-shell aig-nav-inner">
          <a className="aig-nav-brand" href="#top">
            <span className="aig-nav-mark">
              <ChatMark />
            </span>
            OmniContext AI
          </a>

          <nav className="aig-nav-links" aria-label="Sections">
            <a href="#how-it-works">How it works</a>
            <a href="#voice-dna">Voice DNA</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="aig-nav-actions">
            <button type="button" className="aisg-btn aisg-btn-outline" onClick={onLogin}>
              Log in
            </button>
            <button type="button" className="aisg-btn aisg-btn-primary" onClick={onStart}>
              Start Free (5 Credits)
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="aig-hero">
          <div className="aig-shell aig-hero-grid">
            <div>
              <span className="aig-eyebrow">One idea · three channels · your voice</span>
              <h1>
                Turn 1 raw idea into 3 platform-ready posts —{" "}
                <span className="aig-grad">written in your own Voice DNA.</span>
              </h1>
              <p className="aig-sub">
                One sentence in, and you get a tailored LinkedIn post, an Instagram/Facebook caption,
                and a TikTok/Reels spoken script in seconds — in Dutch, English, or any language you
                write in.
              </p>

              <div className="aig-cta-row">
                <button type="button" className="aisg-btn aisg-btn-primary aig-cta" onClick={onStart}>
                  Try Free — Get 5 Test Credits
                </button>
              </div>
              <p className="aig-trust">No credit card required · Ready in 30 seconds</p>
            </div>

            <div className="aig-posts" aria-hidden="true">
              <span className="aig-dna-chip">
                <i /> Voice DNA active
              </span>

              <article className="aig-post">
                <div className="aig-post-top">
                  <span className="aig-dot aig-dot-li" /> LinkedIn
                </div>
                <p>
                  Monday coffee. I forgot it on the desk and drank it cold.
                  <br />
                  <br />
                  Two things I learned after six weeks of testing cups: the seal is everything, and
                  nobody wants a lecture.
                </p>
                <div className="aig-post-meta">Hook · story · call to action — no hashtags</div>
              </article>

              <article className="aig-post">
                <div className="aig-post-top">
                  <span className="aig-dot aig-dot-ig" /> Instagram / Facebook
                </div>
                <p>We don't build a perfect cup. We build one that's still hot at 5pm.</p>
                <div className="aig-post-tags">#coffee #reusablecup #slowmornings</div>
                <div className="aig-post-meta">Caption + 5–7 hashtags</div>
              </article>

              <article className="aig-post">
                <div className="aig-post-top">
                  <span className="aig-dot aig-dot-tt" /> TikTok / Reels
                </div>
                <p>
                  <strong>Hook:</strong> Your cup is cold by 10am. Here's why.
                </p>
                <p>
                  <strong>Script:</strong> The seal leaks heat, not the walls. We fixed the seal, so
                  the coffee is still hot at five. Link's in the bio.
                </p>
                <div className="aig-post-meta">12-word hook · 350-character script</div>
              </article>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="aig-section">
          <div className="aig-shell">
            <h2>How it works</h2>
            <p className="aig-lede">
              Three steps, once. After that it's one idea and one click — no prompt engineering, no
              rewriting the same post three times.
            </p>

            <div className="aig-steps">
              {STEPS.map((step, index) => (
                <article className="aig-step" key={step.title}>
                  <span className="aig-step-num">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="voice-dna" className="aig-section">
          <div className="aig-shell">
            <h2>Why it doesn't read like AI</h2>
            <p className="aig-lede">
              Generic tools give you the same polished voice as everyone else, in whichever language
              they feel like. OmniContext writes like the person your audience already follows.
            </p>

            <div className="aig-why">
              {REASONS.map((reason) => (
                <article className="aig-why-card" key={reason.title}>
                  <h3>{reason.title}</h3>
                  <p>{reason.body}</p>
                </article>
              ))}
            </div>

            <div className="aig-dna">
              <span className="aig-dna-chip">
                <i /> Voice DNA active
              </span>
              <p>
                Sentence length and rhythm: short 8–12 word sentences, with the occasional long one
                for emphasis.
              </p>
              <p>Vocabulary: plain everyday words, repeats “seal”, “cup”, “still hot” — no jargon.</p>
              <p>Hook patterns: opens with a flat statement of fact, then lands one short insight.</p>
              <p>Punctuation and emoji: periods and commas, almost never an exclamation mark.</p>
              <p className="aig-dna-foot">
                Measured from posts you wrote — not a tone dropdown, and it isn't shared with anyone
                else.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="aig-section">
          <div className="aig-shell">
            <h2>Pricing</h2>
            <p className="aig-lede">
              Start free, upgrade when the drafts are worth posting. Both paid plans are unlimited —
              they differ in how many brands you keep in the vault.
            </p>

            <div className="aig-plans">
              {plans.map((plan) => (
                <article
                  className={plan.featured ? "aig-plan is-featured" : "aig-plan"}
                  key={plan.id}
                >
                  <div className="aig-plan-head">
                    <h3>{plan.name}</h3>
                    {plan.featured && <span className="aig-plan-badge">Most popular</span>}
                  </div>
                  <p className="aig-plan-price">
                    {plan.price === 0 ? "€0" : `€${plan.price}`}
                    {plan.price === 0 ? <span> forever</span> : <span> / month</span>}
                  </p>
                  <p className="aig-plan-blurb">{plan.blurb}</p>
                  <ul>
                    {plan.perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={
                      plan.featured
                        ? "aisg-btn aisg-btn-primary aisg-btn-full"
                        : "aisg-btn aisg-btn-outline aisg-btn-full"
                    }
                    onClick={onStart}
                  >
                    {plan.cta}
                  </button>
                </article>
              ))}
            </div>

            <p className="aig-plans-note">
              Free credits unlock as soon as you confirm your email. Paid plans are billed monthly by
              Stripe and can be cancelled any time from your account.
            </p>
          </div>
        </section>
      </main>

      <footer className="aig-foot">
        <div className="aig-shell">
          <div className="aig-foot-inner">
            <div>
              <div className="aig-foot-brand">OmniContext AI</div>
              <p className="aig-foot-note">One idea, every channel — in your own voice.</p>
            </div>

            <div className="aig-foot-links">
              <a href="mailto:support@getomnicontext.com">support@getomnicontext.com</a>
              <button type="button" onClick={() => setPolicy("privacy")}>
                Privacy Policy
              </button>
              <button type="button" onClick={() => setPolicy("terms")}>
                Terms of Service
              </button>
            </div>
          </div>

          <p className="aig-foot-legal">
            © 2026 OmniContext AI · No ads, no trackers · Payments handled by Stripe
          </p>
        </div>
      </footer>

      <PolicyModal kind={policy} onClose={() => setPolicy(null)} />
    </div>
  );
}
