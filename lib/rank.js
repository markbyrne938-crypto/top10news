'use strict';

const { keyPoints, differences } = require('./points');

const HALF_LIFE_HOURS = 18;
const MIN_FRESHNESS = 0.3;
const MIN_SOURCES = 3; // a story is only published once this many outlets carry it

// 1st place = 1.0, 5th ≈ 0.5, 10th ≈ 0.31, 20th ≈ 0.17.
const positionScore = (rank) => 1 / (1 + 0.25 * rank);
const round = (n) => Math.round(n * 100) / 100;

function truncate(s, n = 240) {
  return s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '…' : s;
}

/**
 * Turn clusters of items into ranked stories.
 * score = (Σ over sources: weight × placement score) × freshness.
 * Coverage by several independent sources beats one prominent placement.
 */
function rankStories(clusters, sourcesById, now = Date.now()) {
  const stories = clusters.map((items) => {
    const bySource = new Map();
    for (const it of items) {
      const cur = bySource.get(it.source);
      if (!cur || it.rank < cur.rank) bySource.set(it.source, it);
    }
    const placements = [...bySource.values()].sort(
      (a, b) => sourcesById[b.source].weight - sourcesById[a.source].weight || a.rank - b.rank
    );

    let raw = 0;
    const outlets = placements.map((p) => {
      const src = sourcesById[p.source];
      const points = src.weight * positionScore(p.rank);
      raw += points;
      return {
        source: p.source, sourceName: src.name, short: src.short, region: src.region, kind: src.kind,
        title: p.title, url: p.link, position: p.rank + 1, weight: src.weight, points: round(points),
      };
    });

    const newest = Math.max(0, ...placements.map((p) => p.published || 0));
    const freshness = newest ? Math.max(MIN_FRESHNESS, Math.pow(0.5, Math.max(0, now - newest) / 3.6e6 / HALF_LIFE_HOURS)) : 1;

    // Wording: wire service first, then best-placed outlet.
    const lead = [...placements].sort(
      (a, b) => (sourcesById[b.source].kind === 'wire') - (sourcesById[a.source].kind === 'wire') || a.rank - b.rank
    )[0];
    const withSummary = [...placements]
      .filter((p) => p.summary)
      .sort((a, b) => (sourcesById[b.source].kind === 'wire') - (sourcesById[a.source].kind === 'wire') || a.rank - b.rank)[0];

    const texts = placements.map((p) => ({ short: sourcesById[p.source].short, sourceName: sourcesById[p.source].name, kind: sourcesById[p.source].kind, title: p.title, summary: p.summary }));

    return {
      points: keyPoints(texts),
      differences: differences(texts),
      score: round(raw * freshness),
      rawScore: round(raw),
      freshness: round(freshness),
      sourceCount: outlets.length,
      regions: [...new Set(outlets.map((o) => o.region))],
      headline: lead.title,
      summary: withSummary ? truncate(withSummary.summary) : '',
      published: newest || null,
      items: outlets,
    };
  });

  return stories.filter((s) => s.sourceCount >= MIN_SOURCES).sort((a, b) => b.score - a.score);
}

module.exports = { rankStories, positionScore, MIN_SOURCES };
