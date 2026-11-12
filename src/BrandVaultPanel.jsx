/**
 * BrandVaultPanel.jsx — the saved brand context.
 * ---------------------------------------------------------------------------
 * One panel that holds the four facts the generator injects into every prompt:
 * who you are, who you talk to, what you offer and how you sound. Saving is
 * server-side, so the same profile is there on any device.
 *
 * `vaults` and `limit` come from /api/brand, which is also what enforces the
 * plan limit — this component only explains it.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";

import { TONES } from "./studio-config.js";

const EMPTY = { id: "", name: "", audience: "", offer: "", tone: TONES[0].id };

export default function BrandVaultPanel({
  vaults,
  limit,
  selectedId,
  onSelect,
  onSave,
  onDelete,
  saving,
  error,
  unlimited,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY);

  const selected = vaults.find((vault) => vault.id === selectedId) || null;

  /* Open the form straight away for a first-time user. */
  useEffect(() => {
    if (vaults.length === 0 && !saving) setOpen(true);
  }, [vaults.length, saving]);

  function startNew() {
    setDraft(EMPTY);
    setOpen(true);
  }

  function startEdit() {
    if (!selected) return startNew();
    setDraft({ ...selected });
    setOpen(true);
  }

  function change(field) {
    return (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    const saved = await onSave(draft);
    if (saved) {
      setOpen(false);
      setDraft(EMPTY);
    }
  }

  return (
    <section className="aisg-card aisg-vault">
      <div className="aisg-vault-head">
        <div>
          <h2 className="aisg-vault-title">Brand Vault</h2>
          <p className="aisg-vault-sub">
            {selected
              ? `Writing as ${selected.name} — this context is added to every generation.`
              : "Save your brand once. Every generation writes in this voice automatically."}
          </p>
        </div>
        <span className="aisg-vault-count">
          {vaults.length}/{limit} profile{limit === 1 ? "" : "s"}
        </span>
      </div>

      {vaults.length > 0 && (
        <div className="aisg-vault-list" role="list">
          {vaults.map((vault) => (
            <button
              key={vault.id}
              type="button"
              role="listitem"
              className={vault.id === selectedId ? "aisg-vault-pill is-active" : "aisg-vault-pill"}
              onClick={() => onSelect(vault.id)}
              title={vault.audience}
            >
              {vault.name}
            </button>
          ))}
          <button type="button" className="aisg-btn aisg-btn-small" onClick={startEdit}>
            Edit
          </button>
          {selected && (
            <button
              type="button"
              className="aisg-link aisg-vault-remove"
              onClick={() => onDelete(selected.id)}
            >
              Remove
            </button>
          )}
          {vaults.length < limit && (
            <button type="button" className="aisg-link" onClick={startNew}>
              + Add brand
            </button>
          )}
        </div>
      )}

      {!open && vaults.length > 0 && (
        <p className="aisg-vault-hint">
          {unlimited
            ? "Included with your plan."
            : `Your free plan includes ${limit} profile — Agency keeps up to 5.`}
        </p>
      )}

      {(open || vaults.length === 0) && (
        <form className="aisg-vault-form" onSubmit={submit}>
          <div className="aisg-vault-grid">
            <label className="aisg-fieldlabel">
              Brand or creator name
              <input
                className="aisg-input"
                value={draft.name}
                onChange={change("name")}
                placeholder="e.g. Northwind Coffee"
                maxLength={120}
                required
              />
            </label>
            <label className="aisg-fieldlabel">
              Target audience
              <input
                className="aisg-input"
                value={draft.audience}
                onChange={change("audience")}
                placeholder="e.g. Home baristas who care about waste"
                maxLength={200}
                required
              />
            </label>
            <label className="aisg-fieldlabel">
              Core offer or niche
              <input
                className="aisg-input"
                value={draft.offer}
                onChange={change("offer")}
                placeholder="e.g. Reusable cups that keep coffee hot for 8 hours"
                maxLength={200}
                required
              />
            </label>
            <label className="aisg-fieldlabel">
              Tone of voice
              <select className="aisg-input" value={draft.tone} onChange={change("tone")}>
                {TONES.map((tone) => (
                  <option key={tone.id} value={tone.id}>
                    {tone.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="aisg-error aisg-vault-error">{error}</p>}

          <div className="aisg-vault-actions">
            <button type="submit" className="aisg-btn aisg-btn-primary" disabled={saving}>
              {saving ? "Saving…" : draft.id ? "Save changes" : "Save brand"}
            </button>
            {vaults.length > 0 && (
              <button
                type="button"
                className="aisg-btn aisg-btn-outline"
                onClick={() => {
                  setOpen(false);
                  setDraft(EMPTY);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
