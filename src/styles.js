/**
 * styles.js — the stylesheet for the studio screen.
 * ---------------------------------------------------------------------------
 * Every rule is scoped by the `.aisg` prefix, so importing this once is safe
 * on any page. App.jsx injects it with <style>{CSS}</style>.
 * ---------------------------------------------------------------------------
 */

export const CSS = `
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
  width: 44px; height: 44px; border-radius: 14px; flex: none;
  display: grid; place-items: center; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 10px 24px -8px rgba(91, 83, 240, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.28);
}
.aisg-mark svg { width: 29px; height: 29px; display: block; }
.aisg-brand h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.03em; }
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
.aisg-user { display: flex; align-items: center; gap: 8px; min-width: 0; }
.aisg-account { display: flex; align-items: center; gap: 7px; min-width: 0; color: var(--muted); }
.aisg-avatar {
  width: 26px; height: 26px; border-radius: 50%; flex: none;
  display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 4px 10px -4px rgba(91, 83, 240, 0.75);
}
.aisg-who {
  max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px;
}
.aisg-logout {
  font-size: 13px; font-weight: 600; padding: 9px 14px; border-radius: 999px;
  background: var(--card); border: 1px solid var(--line); color: var(--ink);
  box-shadow: 0 1px 2px rgba(18, 20, 42, 0.05);
}
.aisg-logout:hover { border-color: #f2c2cd; color: #b02a44; background: #fff7f9; }
.aisg-logout-icon { width: 15px; height: 15px; flex: none; }

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
.aisg-perks li::before { content: "\u2713"; position: absolute; left: 0; top: 0; color: var(--ok); font-weight: 800; font-size: 12px; }
.aisg-modal-error { margin-top: 4px; }
.aisg-fineprint { font-size: 11.5px; color: var(--muted); text-align: center; line-height: 1.6; margin-top: 4px; }

@media (max-width: 720px) {
  .aisg { padding: 22px 14px 56px; }
  .aisg-controls { grid-template-columns: 1fr 1fr; }
  .aisg-submit { grid-column: 1 / -1; }
  .aisg-plans { grid-template-columns: 1fr; }
  .aisg-head { align-items: flex-start; }
  .aisg-wallet { width: 100%; justify-content: flex-start; gap: 10px; }
  .aisg-user {
    width: 100%; justify-content: space-between;
    padding-top: 12px; margin-top: 2px;
    border-top: 1px solid var(--line);
  }
  .aisg-account { flex: 1 1 auto; }
  .aisg-who { max-width: min(52vw, 260px); font-size: 13px; }
  .aisg-logout { flex: none; }
}

@media (max-width: 420px) {
  .aisg-wallet { flex-direction: column; align-items: stretch; }
  .aisg-credits { justify-content: center; }
  .aisg-wallet > .aisg-btn { width: 100%; }
  .aisg-user { flex-direction: column; align-items: stretch; gap: 10px; }
  .aisg-account { justify-content: center; }
  .aisg-who { max-width: 100%; text-align: center; }
  .aisg-logout { width: 100%; }
}
`;
