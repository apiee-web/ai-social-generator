/**
 * Cards.jsx — one generated result as channel tabs, plus the loading placeholder.
 * ---------------------------------------------------------------------------
 * A single generation now holds three channels, so each card shows tabs and a
 * copy button for whichever channel is open. The body keeps its paragraph
 * breaks: `whitespace-pre-line` lets the model's double line breaks render, and
 * the copy button hands over the same text with those breaks intact.
 * ---------------------------------------------------------------------------
 */

import { useState } from "react";

import {
  CHANNELS,
  CHANNEL_MAP,
  channelHasContent,
  composeChannel,
  timeAgo,
} from "./studio-config.js";

function ResultCard({ result, copiedId, onCopy }) {
  const available = CHANNELS.filter((channel) => channelHasContent(channel.id, result.channels));
  const [activeId, setActiveId] = useState(available[0]?.id || CHANNELS[0].id);
  const active = CHANNEL_MAP[activeId] || CHANNELS[0];
  const channel = result.channels?.[activeId] || {};
  const text = composeChannel(activeId, result.channels);
  const copyKey = `${result.id}-${activeId}`;
  const over = text.length > active.limit;

  return (
    <article className="aisg-card aisg-result">
      <div className="aisg-result-head">
        <div className="aisg-result-meta">
          {result.brandName && <span className="aisg-chip aisg-chip-soft">{result.brandName}</span>}
          {result.toneLabel && <span className="aisg-chip">{result.toneLabel}</span>}
          <span className="aisg-time">{timeAgo(result.createdAt)}</span>
        </div>
        <p className="aisg-result-topic" title={result.topic}>
          {result.topic}
        </p>
      </div>

      <div className="aisg-tabs" role="tablist" aria-label="Channels">
        {available.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={option.id === activeId}
            className={option.id === activeId ? "aisg-tab is-active" : "aisg-tab"}
            onClick={() => setActiveId(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="aisg-channel-body" role="tabpanel">
        {activeId === "tiktok" ? (
          <>
            {channel.hook && (
              <div className="aisg-tiktok-hook">
                <span className="aisg-tiktok-label">First 3 seconds</span>
                <p>{channel.hook}</p>
              </div>
            )}
            <p className="aisg-variant-text whitespace-pre-line">{channel.script}</p>
          </>
        ) : (
          <p className="aisg-variant-text whitespace-pre-line">{channel.text}</p>
        )}

        {activeId === "instagram" &&
          Array.isArray(channel.hashtags) &&
          channel.hashtags.length > 0 && (
            <p className="aisg-hashtags">{channel.hashtags.join(" ")}</p>
          )}
      </div>

      <div className="aisg-variant-foot">
        <span className={over ? "aisg-count aisg-count-over" : "aisg-count"}>
          {text.length.toLocaleString()} / {active.limit.toLocaleString()}
          {over ? " · trim before posting" : ""}
        </span>
        <button
          type="button"
          className="aisg-btn aisg-btn-small"
          onClick={() => onCopy(text, copyKey)}
        >
          {copiedId === copyKey ? "Copied ✓" : `Copy ${active.label}`}
        </button>
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
