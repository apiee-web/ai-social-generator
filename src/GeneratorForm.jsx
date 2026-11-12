/**
 * GeneratorForm.jsx — the idea box, the tone picker and the generate button.
 * ---------------------------------------------------------------------------
 * There is no platform dropdown any more: one idea returns LinkedIn,
 * Instagram/Facebook and a TikTok script in the same call.
 * ---------------------------------------------------------------------------
 */

import { CHANNELS, CREDIT_COST, TONES } from "./studio-config.js";

export default function GeneratorForm({
  topic,
  onTopic,
  tone,
  onTone,
  loading,
  unlimited,
  credits,
  creditWord,
  needsSignIn,
  brand,
  onSubmit,
}) {
  return (
    <form className="aisg-card aisg-form" onSubmit={onSubmit}>
      <label className="aisg-label" htmlFor="aisg-topic">
        What's the content about?
      </label>
      <textarea
        id="aisg-topic"
        className="aisg-input aisg-textarea"
        rows={3}
        maxLength={400}
        placeholder="e.g. We just launched a reusable coffee cup that keeps drinks hot for 8 hours"
        value={topic}
        onChange={(event) => onTopic(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            onSubmit(event);
          }
        }}
      />

      <div className="aisg-controls">
        <div className="aisg-field">
          <label className="aisg-label aisg-label-small" htmlFor="aisg-tone">
            Tone
          </label>
          <select
            id="aisg-tone"
            className="aisg-input"
            value={tone}
            onChange={(event) => onTone(event.target.value)}
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
              <span className="aisg-spinner" aria-hidden="true" /> Writing three channels…
            </>
          ) : (
            <>Generate all 3 channels{unlimited ? "" : ` · ${CREDIT_COST} credit`}</>
          )}
        </button>
      </div>

      <div className="aisg-channel-preview" aria-hidden="true">
        {CHANNELS.map((channel) => (
          <span key={channel.id} className="aisg-channel-pill">
            <strong>{channel.label}</strong>
            <span>{channel.blurb}</span>
          </span>
        ))}
      </div>

      <p className="aisg-hint">
        {needsSignIn
          ? "Sign in to start — a new account comes with 3 free generations."
          : brand
            ? `Writing as ${brand.name} · ${brand.tone} tone · three channels per idea.`
            : unlimited
              ? "Unlimited generations on your plan · three channels per idea."
              : credits > 0
                ? `${credits} free ${creditWord} left · each generation returns all three channels.`
                : "You're out of free generations — upgrade to keep going."}
      </p>
    </form>
  );
}
