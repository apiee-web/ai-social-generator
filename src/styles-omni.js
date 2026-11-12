/**
 * styles-omni.js — the extra rules for the Brand Vault and channel tabs.
 * ---------------------------------------------------------------------------
 * Kept apart from styles.js so the base sheet (and its phone breakpoints) stays
 * untouched. App.jsx injects both with <style> tags.
 * ---------------------------------------------------------------------------
 */

export const OMNI_CSS = `
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
}
`;
