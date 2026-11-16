/**
 * styles-landing.js — the public landing page.
 * ---------------------------------------------------------------------------
 * LandingPage.jsx injects this with <style>. It sits inside `.aisg`, so the
 * colour tokens, buttons and modal styles come from styles.js — only the
 * landing-specific layout lives here.
 *
 * Everything is prefixed `.aig-` so it can never collide with the app screen.
 * ---------------------------------------------------------------------------
 */

export const LANDING_CSS = `
.aig { padding: 0; }
.aig *, .aig *::before, .aig *::after { box-sizing: border-box; }
.aig-shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 20px; }
.aig-hero-grid > * { min-width: 0; }
.aig section { scroll-margin-top: 84px; }
.aig a { color: inherit; }

/* ---- nav ---------------------------------------------------------------- */
.aig-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(255, 255, 255, 0.84);
  border-bottom: 1px solid rgba(228, 231, 243, 0.9);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.aig-nav-inner {
  display: flex; align-items: center; gap: 20px; min-height: 68px;
}
.aig-nav-brand {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 800; letter-spacing: -0.02em;
  text-decoration: none; white-space: nowrap;
}
.aig-nav-mark {
  width: 34px; height: 34px; flex: none; border-radius: 11px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 18px -10px rgba(91, 83, 240, 0.95);
}
.aig-nav-mark svg { width: 22px; height: 22px; display: block; }
.aig-nav-links { display: flex; align-items: center; gap: 20px; }
.aig-nav-links a {
  font-size: 13.5px; font-weight: 600; color: var(--muted);
  text-decoration: none; padding: 6px 0;
}
.aig-nav-links a:hover { color: var(--ink); }
.aig-nav-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }

/* ---- hero --------------------------------------------------------------- */
.aig-hero { padding: 64px 0 24px; }
.aig-hero-grid {
  display: grid; grid-template-columns: 1.04fr 0.96fr;
  gap: 48px; align-items: center;
}
.aig-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--accent); background: rgba(91, 83, 240, 0.1);
  border-radius: 999px; padding: 7px 12px;
}
.aig-hero h1 {
  margin-top: 18px; font-size: clamp(31px, 4.4vw, 50px);
  line-height: 1.07; letter-spacing: -0.035em; font-weight: 800;
}
.aig-grad {
  background: linear-gradient(100deg, var(--accent) 0%, var(--accent-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.aig-sub {
  margin-top: 18px; font-size: 16px; line-height: 1.65; color: var(--muted);
  max-width: 48ch;
}
.aig-cta-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 26px; }
.aig-cta { font-size: 15px; padding: 14px 22px; border-radius: 14px; }
.aig-trust { margin-top: 12px; font-size: 12.5px; color: var(--muted); }

/* ---- hero preview ------------------------------------------------------- */
.aig-posts { display: grid; gap: 12px; }
.aig-post {
  background: #fff; border: 1px solid var(--line); border-radius: 16px;
  padding: 14px 16px; box-shadow: 0 22px 44px -38px rgba(18, 20, 42, 0.7);
}
.aig-post-top {
  display: flex; align-items: center; gap: 8px;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--muted);
}
.aig-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.aig-dot-li { background: #0a66c2; }
.aig-dot-ig { background: var(--accent-2); }
.aig-dot-tt { background: #12142a; }
.aig-post p { margin-top: 8px; font-size: 12.8px; line-height: 1.62; color: #3b4064; }
.aig-post-tags { margin-top: 6px; font-size: 12px; color: var(--accent); }
.aig-post-meta {
  margin-top: 8px; font-size: 11px; font-weight: 700; color: var(--muted);
}
.aig-dna-chip {
  display: inline-flex; align-items: center; gap: 7px; margin-bottom: 2px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--accent);
}
.aig-dna-chip i {
  width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 3px rgba(91, 83, 240, 0.18);
}

/* ---- sections ----------------------------------------------------------- */
.aig-section { padding: 54px 0 6px; }
.aig-section h2 {
  font-size: clamp(22px, 2.6vw, 30px); letter-spacing: -0.025em; font-weight: 800;
}
.aig-lede {
  margin-top: 10px; font-size: 14.5px; line-height: 1.65; color: var(--muted);
  max-width: 62ch;
}
.aig-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 26px; }
.aig-step {
  background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 20px;
}
.aig-step-num {
  width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center;
  font-size: 12.5px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}
.aig-step h3 { margin-top: 13px; font-size: 14.5px; letter-spacing: -0.01em; }
.aig-step p { margin-top: 8px; font-size: 13px; line-height: 1.62; color: var(--muted); }

.aig-why { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
.aig-why-card {
  border: 1px solid rgba(91, 83, 240, 0.22); border-radius: 16px; padding: 20px;
  background: linear-gradient(180deg, #f8f7ff, #f3f2ff);
}
.aig-why-card h3 { font-size: 13.5px; letter-spacing: -0.01em; }
.aig-why-card p { margin-top: 8px; font-size: 12.8px; line-height: 1.62; color: #4b4a63; }

.aig-dna {
  margin-top: 16px; background: #fff; border: 1px solid var(--line);
  border-radius: 18px; padding: 18px 20px;
  display: grid; gap: 5px;
}
.aig-dna p { font-size: 12.8px; line-height: 1.62; color: #4b4a63; }
.aig-dna-foot { margin-top: 8px; font-size: 12px; color: var(--muted); }

/* ---- pricing ------------------------------------------------------------ */
.aig-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 26px; }
.aig-plan {
  display: flex; flex-direction: column;
  background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 22px;
}
.aig-plan.is-featured {
  border-color: rgba(91, 83, 240, 0.5);
  box-shadow: 0 30px 60px -46px rgba(91, 83, 240, 0.95);
}
.aig-plan-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.aig-plan h3 { font-size: 15px; letter-spacing: -0.01em; }
.aig-plan-badge {
  font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--accent); background: rgba(91, 83, 240, 0.1);
  border-radius: 7px; padding: 5px 8px;
}
.aig-plan-price { margin-top: 12px; font-size: 30px; font-weight: 800; letter-spacing: -0.035em; }
.aig-plan-price span { font-size: 13px; font-weight: 600; color: var(--muted); }
.aig-plan-blurb { margin-top: 6px; font-size: 12.5px; color: var(--muted); line-height: 1.55; }
.aig-plan ul { list-style: none; padding: 0; margin: 16px 0 18px; display: grid; gap: 8px; }
.aig-plan li { position: relative; padding-left: 20px; font-size: 13px; line-height: 1.5; color: #3b4064; }
.aig-plan li::before {
  content: "✓"; position: absolute; left: 0; top: 0;
  color: var(--ok); font-weight: 800; font-size: 12px;
}
.aig-plan .aisg-btn { margin-top: auto; }
.aig-plans-note { margin-top: 14px; font-size: 12px; color: var(--muted); }

/* ---- footer ------------------------------------------------------------- */
.aig-foot { margin-top: 46px; border-top: 1px solid var(--line); padding: 26px 0 44px; }
.aig-foot-inner { display: flex; align-items: flex-start; justify-content: space-between; gap: 22px; flex-wrap: wrap; }
.aig-foot-brand { font-size: 14.5px; font-weight: 800; letter-spacing: -0.02em; }
.aig-foot-note { margin-top: 6px; font-size: 12.5px; color: var(--muted); }
.aig-foot-links { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.aig-foot-links button, .aig-foot-links a {
  font: inherit; font-size: 13px; color: var(--muted);
  background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none;
}
.aig-foot-links button:hover, .aig-foot-links a:hover { color: var(--ink); }
.aig-foot-legal { margin-top: 18px; font-size: 12px; color: var(--muted); }

/* ---- policy modal ------------------------------------------------------- */
.aig-policy { max-width: 660px; max-height: 84vh; overflow: auto; }
.aig-policy h2 { font-size: 19px; letter-spacing: -0.02em; }
.aig-policy h3 { margin-top: 18px; font-size: 13.5px; letter-spacing: -0.01em; }
.aig-policy p { margin-top: 7px; font-size: 13px; line-height: 1.7; color: #3b4064; }
.aig-policy-updated { margin-top: 6px; font-size: 12px; color: var(--muted); }

@media (max-width: 960px) {
  .aig-hero-grid { grid-template-columns: 1fr; gap: 32px; }
  .aig-hero { padding-top: 44px; }
  .aig-nav-links { display: none; }
  .aig-steps, .aig-why, .aig-plans { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  /* Brand on its own line, both buttons on the next one: side by side they
     squeezed "Log in" and "Start Free (5 Credits)" into stacked words. */
  .aig-nav-inner {
    min-height: 0; padding-top: 10px; padding-bottom: 10px;
    flex-wrap: wrap; gap: 10px;
  }
  .aig-nav-mark { width: 30px; height: 30px; border-radius: 9px; }
  .aig-nav-mark svg { width: 19px; height: 19px; }
  .aig-nav-actions { width: 100%; margin-left: 0; gap: 8px; }
  .aig-nav-actions .aisg-btn {
    flex: 1 1 0; min-width: 0; padding: 10px 10px;
    font-size: 12px; white-space: nowrap; justify-content: center;
  }
  .aig-cta-row { align-items: stretch; }
  .aig-cta { width: 100%; justify-content: center; text-align: center; }
  .aig-foot-inner { flex-direction: column; }
}
`;
