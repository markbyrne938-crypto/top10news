'use strict';

const { tokens } = require('./cluster');

const toks = (s) => new Set(tokens(s));
function jaccard(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n || 1);
}
const splitSentences = (t) =>
  t.split(/(?<=[.!?])\s+(?=[A-Z"“])/).map((x) => x.trim()).filter((x) => x.length >= 35 && x.length <= 300);

const numbers = (t) => (t.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, '')).sort().join('|');
const tidy = (t) =>
  t.replace(/\s*\([^)]{0,60}\)/g, '') // short parentheticals
    .replace(/^(?:On \w+day|Earlier|Meanwhile|However|Separately|Also),?\s+/i, '') // filler lead-ins
    .replace(/^[a-z]/, (c) => c.toUpperCase());

/**
 * Pick up to `max` short key points for a story from the summaries outlets publish in
 * their feeds. Sentences several outlets agree on come first. When outlets say the same
 * thing, the most concise wording that keeps the same figures is used. Text is never
 * paraphrased: each bullet is a sentence an outlet published, minus filler, with the
 * outlets that support it.
 * placements: [{ short, sourceName, kind, title, summary }]
 */
function keyPoints(placements, max = 3) {
  const name = (p) => p.short || p.sourceName;
  const titleSets = placements.map((p) => toks(p.title));
  const allTitle = new Set(titleSets.flatMap((s) => [...s]));
  const cands = [];
  for (const p of placements) {
    for (const raw of splitSentences(p.summary || '')) {
      const text = tidy(raw);
      const t = toks(text);
      if (titleSets.some((ts) => jaccard(t, ts) >= 0.6)) continue; // just restates a headline
      cands.push({ text, t, name: name(p), wire: p.kind === 'wire', nums: numbers(text), onTopic: [...t].some((w) => allTitle.has(w)) });
    }
  }

  for (const c of cands) {
    c.group = cands.filter((o) => o === c || (o.name !== c.name && jaccard(c.t, o.t) >= 0.3));
    c.support = new Set(c.group.map((o) => o.name));
  }
  // Keep a sentence only if it is about the story, or several outlets independently say it.
  const kept = cands.filter((c) => c.onTopic || c.support.size >= 2);
  kept.sort((a, b) => b.support.size - a.support.size || b.wire - a.wire || a.text.length - b.text.length);

  const picked = [];
  for (const c of kept) {
    if (picked.length >= max) break;
    if (picked.some((p) => jaccard(p.t, c.t) >= 0.45)) continue;
    // Most concise equivalent wording: same figures, closely matching words.
    const best = c.group.filter((o) => o.nums === c.nums && jaccard(o.t, c.t) >= 0.45).sort((a, b) => a.text.length - b.text.length)[0] || c;
    picked.push({ ...best, support: c.support });
  }
  return picked.map((c) => ({ text: c.text, sources: [...c.support] }));
}

const FACTS = [
  ['Deaths reported', /(\d[\d,]*)\s+(?:\w+\s+)?(?:people\s+)?(?:were\s+)?(?:killed|dead|deaths)\b|death toll[^.\d]{0,30}(\d[\d,]*)/i],
  ['Injured', /(\d[\d,]*)\s+(?:\w+\s+)?(?:people\s+)?(?:were\s+)?injured\b|injur\w+\s+(?:at least\s+)?(\d[\d,]*)/i],
  ['Magnitude', /magnitude\s*(\d(?:\.\d)?)|(\d\.\d)[- ]magnitude/i],
];

/** Flags figures (deaths, injured, magnitude) that outlets report differently. */
function differences(placements) {
  const out = [];
  for (const [label, re] of FACTS) {
    const byValue = new Map();
    for (const p of placements) {
      const m = `${p.title}. ${p.summary || ''}`.match(re);
      const v = m && (m[1] || m[2]);
      if (!v) continue;
      const key = v.replace(/,/g, '');
      if (!byValue.has(key)) byValue.set(key, []);
      byValue.get(key).push(p.short || p.sourceName);
    }
    if (byValue.size > 1) out.push({ label, values: [...byValue].map(([value, sources]) => ({ value, sources })) });
  }
  return out;
}

module.exports = { keyPoints, differences };
