/**
 * ResultsSection.jsx — the list of past captions, plus its empty state.
 * ---------------------------------------------------------------------------
 */

import { LoadingCard, ResultCard } from "./Cards.jsx";

export default function ResultsSection({ results, loading, copiedId, onCopy, onClear }) {
  return (
    <section className="aisg-results" aria-busy={loading}>
      <div className="aisg-results-head">
        <h2>Your captions</h2>
        {results.length > 0 && (
          <button type="button" className="aisg-link" onClick={onClear}>
            Clear history
          </button>
        )}
      </div>

      {loading && <LoadingCard />}

      {results.map((result) => (
        <ResultCard key={result.id} result={result} copiedId={copiedId} onCopy={onCopy} />
      ))}

      {!loading && results.length === 0 && (
        <div className="aisg-empty">
          <p className="aisg-empty-title">No captions yet</p>
          <p>
            Type an idea above, pick a platform and a tone, then hit Generate. You get
            three different angles to choose from.
          </p>
        </div>
      )}
    </section>
  );
}
