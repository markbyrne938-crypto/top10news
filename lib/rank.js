'use strict';

const HALF_LIFE_HOURS = 18;

// 1st place = 1.0, 5th ≈ 0.5, 10th ≈ 0.31, 20th ≈ 0.17.
const positionScore = (rank) => 1 / (1 + 0.25 * rank);

/**
 * Turn clusters of items into ranked stories.
 * A story's score is the sum, over each source covering it, of
 * source weight × how prominently that source places it. Coverage by
 * several independent sources therefore beats a single prominent placement.
 */
function rankStories(clusters, sourcesById, now = Date.now()) {
  const stories = clusters.map((items) => {
    // Best placement per source.
    const bySource = new Map();
    for (const it of items) {
      const cur = bySource.get(it.source);
      if (!cur || it.rank < cur.rank) bySource.set(it.source, it);
    }
    const placements = [...bySource.values()];

    let score = 0;
    for (const p of placements) score += sourcesById[p.source].weight * positionScore(p.rank);

    const newest = Math.max(0, ...placements.map((p) => p.published || 0));
    if (newest) {
      const ageH = Math.max(0, (now - newest) / 3.6e6);
      score *= Math.max(0.3, Math.pow(0.5, ageH / HALF_LIFE_HOURS));
    }

    // Lead item: the wire service's wording when available, else the best-placed outlet.
    const lead = [...placements].sort(
      (a, b) =>
        (sourcesById[b.source].kind === 'wire') - (sourcesById[a.source].kind === 'wire') ||
        a.rank - b.rank
    )[0];

    return {
      score,
      sourceCount: placements.length,
      headline: lead.title,
      summary: lead.summary.length > 240 ? lead.summary.slice(0, 237).replace(/\s+\S*$/, '') + '…' : lead.summary,
      published: newest || null,
      items: placements
        .sort((a, b) => sourcesById[b.source].weight - sourcesById[a.source].weight || a.rank - b.rank)
        .map((p) => ({
          source: p.source,
          sourceName: sourcesById[p.source].name,
          title: p.title,
          url: p.link,
          position: p.rank + 1,
        })),
    };
  });

  // Prefer stories confirmed by 2+ sources; single-source stories only fill gaps.
  stories.sort((a, b) => (b.sourceCount > 1) - (a.sourceCount > 1) || b.score - a.score);
  return stories;
}

module.exports = { rankStories, positionScore };
