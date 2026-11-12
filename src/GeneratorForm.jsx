/**
 * GeneratorForm.jsx — the idea box, the tone picker and the generate button.
 * ---------------------------------------------------------------------------
 * There is no platform dropdown any more: one idea returns LinkedIn,
 * Instagram/Facebook and a TikTok script in the same call.
 *
 * The button knows about the two things that can stand in the way: an
 * unconfirmed email, and a spent free balance. Both replace the button rather
 * than failing a request the user already waited for.
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
  creditTotal,
  creditWord,
  needsSignIn,
  verified,
  outOfCredits,
  brand,
  onUpgrade,
  onSubmit,
}) {
  const lockedByCredits = Boolean(outOfCredits) && !unlimited && !needsSignIn;
  const lockedByEmail = verified === false && !needsSignIn;

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

        {lockedByEmail ? (
          <button type="button" className="aisg-btn aisg-btn-outline aisg-submit" disabled>
            Verify your email to generate
          </button>
        ) : lockedByCredits ? (
          <button type="button" className="aisg-btn aisg-submit aisg-submit-upgrade" onClick={onUpgrade}>
            You've used your {creditTotal} free test credits · See plans
          </button>
        ) : (
          <button
            type="submit"
            className="aisg-btn aisg-btn-primary aisg-submit"
            disabled={loading || lockedByCredits || lockedByEmail}
          >
            {loading ? (
              <>
                <span className="aisg-spinner" aria-hidden="true" /> Writing three channels…
              </>
            ) : (
              <>Generate all 3 channels{unlimited ? "" : ` · ${CREDIT_COST} credit`}</>
            )}
          </button>
        )}
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
          ? `Sign in to start — a new account comes with ${creditTotal} free test credits.`
          : lockedByEmail
            ? "Check your inbox and confirm the address — the generator and your credits unlock together."
            : brand
              ? `Writing as ${brand.name} · ${brand.tone} tone · three channels per idea.`
              : unlimited
                ? "Unlimited generations on your plan · three channels per idea."
                : credits > 0
                  ? `${credits} of ${creditTotal} free test credits left · each generation returns all three channels.`
                  : `You've used all ${creditTotal} free test credits — pick a plan to keep generating.`}
      </p>
    </form>
  );
}
