'use strict';

const STOP = new Set(('a an the and or but of to in on at for from by with as is are was were be been it its this that these those ' +
  'after before over under into out up down about amid says say said will would could may might has have had not no new more ' +
  'than who what when where why how he she they his her their us we you i live latest update updates news video watch ' +
  'photos analysis opinion explainer morning briefing').split(' '));

function tokens(text) {
  return text
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

// Titles count double: summaries are noisier.
function itemTerms(item) {
  const t = new Map();
  for (const w of tokens(item.title)) t.set(w, (t.get(w) || 0) + 2);
  for (const w of tokens(item.summary.slice(0, 200))) t.set(w, (t.get(w) || 0) + 1);
  return t;
}

function cosine(a, b, idf) {
  let dot = 0, na = 0, nb = 0, shared = 0;
  for (const [w, c] of a) {
    const x = c * (idf.get(w) || 1);
    na += x * x;
    const d = b.get(w);
    if (d) { dot += x * d * (idf.get(w) || 1); shared++; }
  }
  for (const [w, c] of b) { const x = c * (idf.get(w) || 1); nb += x * x; }
  return { sim: na && nb ? dot / Math.sqrt(na * nb) : 0, shared };
}

/**
 * Group items (from different feeds) that cover the same event.
 * Each item: { source, rank, title, link, summary, published }.
 * Items are seeded in order of (source weight desc, rank asc) so the
 * strongest placements anchor each cluster.
 */
function clusterItems(items, weightOf, { threshold = 0.3, minShared = 2 } = {}) {
  const docs = items.map((item) => ({ item, terms: itemTerms(item) }));

  const df = new Map();
  for (const d of docs) for (const w of d.terms.keys()) df.set(w, (df.get(w) || 0) + 1);
  const idf = new Map();
  for (const [w, n] of df) idf.set(w, Math.log(1 + docs.length / n));

  docs.sort((x, y) => weightOf(y.item.source) - weightOf(x.item.source) || x.item.rank - y.item.rank);

  const clusters = [];
  for (const d of docs) {
    let best = null, bestSim = 0;
    for (const c of clusters) {
      const { sim, shared } = cosine(d.terms, c.centroid, idf);
      if (shared >= minShared && sim > bestSim) { best = c; bestSim = sim; }
    }
    if (best && bestSim >= threshold) {
      best.items.push(d.item);
      for (const [w, n] of d.terms) best.centroid.set(w, (best.centroid.get(w) || 0) + n);
    } else {
      clusters.push({ items: [d.item], centroid: new Map(d.terms) });
    }
  }
  return clusters.map((c) => c.items);
}

module.exports = { clusterItems, tokens };
