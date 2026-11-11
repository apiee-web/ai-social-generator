/**
 * Cards.jsx — one generated result, and the loading placeholder.
 * ---------------------------------------------------------------------------
 */

import { PLATFORM_MAP, PLATFORMS, TONE_MAP, composeText, timeAgo } from "./studio-config.js";

function ResultCard({ result, copiedId, onCopy }) {
  const platform = PLATFORM_MAP[result.platform] || PLATFORMS[0];
  const tone = TONE_MAP[result.tone];

  return (
    <article className="aisg-card aisg-result">
      <div className="aisg-result-head">
        <div className="aisg-result-meta">
          <span className="aisg-chip">{platform.label}</span>
          {tone && <span className="aisg-chip aisg-chip-soft">{tone.label}</span>}
          <span className="aisg-time">{timeAgo(result.createdAt)}</span>
        </div>
        <p className="aisg-result-topic" title={result.topic}>
          {result.topic}
        </p>
      </div>

      <div className="aisg-variants">
        {result.variants.map((variant, index) => {
          const text = composeText(variant);
          const id = `${result.id}-${index}`;
          const over = text.length > platform.limit;

          return (
            <div className="aisg-variant" key={id}>
              <p className="aisg-variant-text">{text}</p>
              <div className="aisg-variant-foot">
                <span className={over ? "aisg-count aisg-count-over" : "aisg-count"}>
                  {text.length.toLocaleString()} / {platform.limit.toLocaleString()}
                  {over ? " · too long" : ""}
                </span>
                <button
                  type="button"
                  className="aisg-btn aisg-btn-small"
                  onClick={() => onCopy(text, id)}
                >
                  {copiedId === id ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function LoadingCard() {
  return (
    <article className="aisg-card aisg-result">
      <div className="aisg-skeleton aisg-skeleton-short" />
      <div className="aisg-skeleton" />
      <div className="aisg-skeleton" />
      <div className="aisg-skeleton aisg-skeleton-tiny" />
    </article>
  );
}

export { ResultCard, LoadingCard };
