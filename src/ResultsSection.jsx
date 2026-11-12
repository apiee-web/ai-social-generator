/**
 * ResultsSection.jsx — the list of past generations, plus its empty state.
 * ---------------------------------------------------------------------------
 */

import { LoadingCard, ResultCard } from "./Cards.jsx";

export default function ResultsSection({ results, loading, copiedId, onCopy, onClear }) {
  return (
    <section className="aisg-results" aria-busy={loading}>
      <div className="aisg-results-head">
        <h2>Your content</h2>
        {results.length > 0 && (
          <button type="button" className="aisg-link" onClick={onClear}>
            Clear history
          </button>
        )}
      </div>

      {loading && <LoadingCard />}

      {results.map((result) => (
        <ResultCard key={result.id} result={result} credits={null} copiedId={copiedId} onCopy={onCopy} />
      ))}

      {!loading && results.length === 0 && (
        <div className="aisg-empty">
          <p className="aisg-empty-title">Nothing written yet</p>
          <p>
            Describe the idea once, then hit Generate. You get LinkedIn, Instagram/Facebook and a
            TikTok script back together — each in your saved brand voice.
          </p>
        </div>
      )}
    </section>
  );
}
