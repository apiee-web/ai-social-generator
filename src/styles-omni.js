/**
 * styles-omni.js — the extra rules for the Brand Vault, Voice DNA, channel tabs
 * and the verification banner.
 * ---------------------------------------------------------------------------
 * Kept apart from styles.js so the base sheet (and its phone breakpoints) stays
 * untouched. App.jsx injects both with <style> tags.
 * ---------------------------------------------------------------------------
 */

export const OMNI_CSS = `
.aisg-verify {
  margin-bottom: 18px; padding: 16px 18px;
  border: 1px solid #f3d9a8; border-radius: 14px;
  background: linear-gradient(180deg, #fffaf1, #fff6e6);
}
.aisg-verify-head { display: flex; gap: 12px; align-items: flex-start; }
.aisg-verify-mark {
  flex: none; width: 9px; height: 9px; margin-top: 7px; border-radius: 50%;
  background: #e0930d; box-shadow: 0 0 0 4px rgba(224, 147, 13, 0.16);
}
.aisg-verify-head strong { font-size: 14px; color: #6b4405; }
.aisg-verify-head p { font-size: 13px; line-height: 1.6; color: #8a6321; margin-top: 5px; }
.aisg-verify-email { font-weight: 600; color: #6b4405; word-break: break-word; }
.aisg-verify-form { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
.aisg-verify-code {
  width: 128px; flex: none; text-align: center; letter-spacing: 0.22em;
  font-size: 15px; font-weight: 700;
}
.aisg-verify-note { margin-top: 11px; font-size: 12.5px; color: #8a6321; }
.aisg-verify-error { margin-top: 11px; margin-bottom: 0; }
.aisg-verify-fallback { margin-top: 11px; font-size: 12.5px; color: #8a6321; }
.aisg-verify-fallback a { color: #6b4405; font-weight: 600; }
.aisg-chip-warn { background: #fdeccd; color: #8a5a06; }
.aisg-submit-upgrade {
  background: #fff; border: 1px solid var(--accent); color: var(--accent);
  font-weight: 700;
}
.aisg-submit-upgrade:hover { background: rgba(91, 83, 240, 0.08); }

.aisg-voice {
  margin-top: 14px; padding: 12px 14px;
  border: 1px solid rgba(91, 83, 240, 0.28); border-radius: 12px;
  background: linear-gradient(180deg, #f8f7ff, #f3f2ff);
}
.aisg-voice-badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--accent);
}
.aisg-voice-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 3px rgba(91, 83, 240, 0.18);
}
.aisg-voice-summary {
  margin-top: 7px; font-size: 12.5px; line-height: 1.65; color: #4b4a63;
  white-space: pre-line;
}
.aisg-vault-dna { margin-left: 6px; color: var(--accent); font-size: 11px; }
.aisg-voice-field { margin-top: 14px; }
.aisg-voice-textarea {
  min-height: 96px; resize: vertical; line-height: 1.6;
  font-size: 13.5px; font-family: inherit;
}
.aisg-voice-helper {
  font-size: 12px; font-weight: 400; letter-spacing: 0; text-transform: none;
  color: var(--muted); line-height: 1.6; margin-top: 2px;
}
.aisg-voice-note { margin-top: 12px; font-size: 12.5px; color: var(--muted); }

.aisg-vault { margin-bottom: 18px; }
.aisg-vault-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.aisg-vault-title { font-size: 15px; letter-spacing: -0.01em; }
.aisg-vault-sub { font-size: 13px; color: var(--muted); line-height: 1.6; margin-top: 4px; }
.aisg-vault-count {
  flex: none; font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em;
  text-transform: uppercase; color: var(--accent);
  background: rgba(91, 83, 240, 0.1); border-radius: 7px; padding: 5px 9px;
}
.aisg-vault-list { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.aisg-vault-pill {
  font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  background: #f3f4fb; border: 1px solid var(--line); color: var(--ink);
  border-radius: 999px; padding: 8px 15px; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.aisg-vault-pill:hover { background: #eaecf9; }
.aisg-vault-pill.is-active {
  border-color: var(--accent); color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 20px -10px rgba(91, 83, 240, 0.85);
}
.aisg-vault-remove { margin-left: auto; }
.aisg-vault-hint { font-size: 12.5px; color: var(--muted); margin-top: 12px; }
.aisg-vault-form { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.aisg-vault-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.aisg-fieldlabel {
  display: flex; flex-direction: column; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.aisg-fieldlabel .aisg-input {
  font-size: 14px; font-weight: 400; color: var(--ink);
  text-transform: none; letter-spacing: 0;
}
.aisg-vault-error { margin-top: 12px; margin-bottom: 0; }
.aisg-vault-actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }

.aisg-channel-preview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.aisg-channel-pill {
  display: inline-flex; align-items: baseline; gap: 6px;
  border: 1px solid var(--line); background: #fbfbff; border-radius: 10px;
  padding: 7px 11px; font-size: 11.5px; color: var(--muted);
}
.aisg-channel-pill strong { font-size: 12px; color: var(--ink); }

.aisg-tabs {
  display: flex; gap: 4px; overflow-x: auto; margin-bottom: 12px;
  border-bottom: 1px solid var(--line); padding-bottom: 8px;
  scrollbar-width: thin;
}
.aisg-tab {
  font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
  background: transparent; border: 1px solid transparent; color: var(--muted);
  border-radius: 9px; padding: 7px 12px;
}
.aisg-tab:hover { color: var(--ink); background: #f3f4fb; }
.aisg-tab.is-active { color: var(--accent); background: rgba(91, 83, 240, 0.1); }
.aisg-channel-body { padding: 4px 2px 2px; }
.aisg-tiktok-hook {
  border-left: 3px solid var(--accent); background: #f7f6ff;
  border-radius: 0 10px 10px 0; padding: 10px 13px; margin-bottom: 12px;
}
.aisg-tiktok-label {
  display: block; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 4px;
}
.aisg-tiktok-hook p { font-size: 14px; line-height: 1.55; }
.aisg-hashtags { font-size: 13px; color: var(--accent); margin-top: 10px; line-height: 1.6; word-break: break-word; }
.aisg-plans-two { grid-template-columns: repeat(2, 1fr); }

@media (max-width: 720px) {
  .aisg-vault-grid { grid-template-columns: 1fr; }
  .aisg-vault-remove { margin-left: 0; }
  .aisg-plans-two { grid-template-columns: 1fr; }
  .aisg-vault-head { flex-direction: column; gap: 8px; }
  .aisg-channel-preview { display: grid; grid-template-columns: 1fr; }
  .aisg-tab { font-size: 12px; padding: 7px 10px; }
  .aisg-verify-form { display: grid; grid-template-columns: 1fr; }
  .aisg-verify-code { width: 100%; }
  .aisg-verify-form .aisg-btn { width: 100%; }
  .aisg-vault-actions .aisg-btn { width: 100%; }
}
`;
