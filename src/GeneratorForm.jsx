/**
 * GeneratorForm.jsx — the idea box, the platform/tone pickers and the button.
 * ---------------------------------------------------------------------------
 */

import { CREDIT_COST, PLATFORMS, TONES } from "./studio-config.js";

export default function GeneratorForm({
  topic,
  onTopic,
  platform,
  onPlatform,
  tone,
  onTone,
  loading,
  credits,
  creditWord,
  needsSignIn,
  platformLabel,
  onSubmit,
}) {
  return (
    <form className="aisg-card aisg-form" onSubmit={onSubmit}>
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
        onChange={(event) => onTopic(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            onSubmit(event);
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
            onChange={(event) => onPlatform(event.target.value)}
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
            ? `${credits} ${creditWord} left · each generation returns 3 options for ${platformLabel}`
            : "You're out of credits — buy more to keep generating."}
      </p>
    </form>
  );
}
