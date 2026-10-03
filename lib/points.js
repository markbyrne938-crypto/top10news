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

/**
 * Pick up to `max` plain-language key points for a story from the short summaries
 * outlets publish in their feeds. A sentence is preferred when several outlets say
 * something similar. Sentences are quoted as published, never rewritten, and each
 * carries the outlets that support it.
 * placements: [{ sourceName, kind, title, summary }]
 */
function keyPoints(placements, max = 4) {
  const titleSets = placements.map((p) => toks(p.title));
  const allTitle = new Set(titleSets.flatMap((s) => [...s]));
  const cands = [];
  placements.forEach((p) => {
    for (const text of splitSentences(p.summary || '')) {
      const t = toks(text);
      if (titleSets.some((ts) => jaccard(t, ts) >= 0.6)) continue; // just restates a headline
      cands.push({ text, t, name: p.sourceName, wire: p.kind === 'wire', onTopic: [...t].some((w) => allTitle.has(w)) });
    }
  });

  for (const c of cands) {
    const names = new Set([c.name]);
    for (const o of cands) if (o.name !== c.name && jaccard(c.t, o.t) >= 0.3) names.add(o.name);
    c.support = names;
  }
  // Keep a sentence only if it is about the story, or several outlets independently say it.
  for (let i = cands.length - 1; i >= 0; i--) if (!cands[i].onTopic && cands[i].support.size < 2) cands.splice(i, 1);
  cands.sort((a, b) => b.support.size - a.support.size || b.wire - a.wire || a.text.length - b.text.length);

  const picked = [];
  for (const c of cands) {
    if (picked.length >= max) break;
    if (picked.some((p) => jaccard(p.t, c.t) >= 0.5)) continue;
    picked.push(c);
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
      byValue.get(key).push(p.sourceName);
    }
    if (byValue.size > 1) out.push({ label, values: [...byValue].map(([value, sources]) => ({ value, sources })) });
  }
  return out;
}

module.exports = { keyPoints, differences };
