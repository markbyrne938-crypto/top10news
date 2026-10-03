'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { parseFeed } = require('./rss');
const { clusterItems, tokens } = require('./cluster');
const { rankStories } = require('./rank');
const { normalize } = require('./filter');
const { classify } = require('./topics');

const TOP_N = 10;
const PER_FEED = 25;
const MORE_N = 15;

async function httpFetch(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Top10News/1.0 (+news aggregator; headlines and links only)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const titleSet = (s) => new Set(tokens(s.headline).concat(...s.items.map((i) => tokens(i.title))));
function jaccard(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n || 1);
}

class Aggregator extends EventEmitter {
  constructor({ sources, fetchText = httpFetch, now = () => Date.now() }) {
    super();
    this.sources = sources;
    this.byId = Object.fromEntries(sources.map((s) => [s.id, s]));
    this.fetchText = fetchText;
    this.now = now;
    this.snapshot = { updatedAt: null, stories: [], sources: [], events: [] };
    this.known = []; // recent stories (top ~40) used to keep ids stable between refreshes
    this.events = [];
  }

  async refresh() {
    const results = await Promise.allSettled(
      this.sources.map(async (s) =>
        parseFeed(await this.fetchText(s)).slice(0, PER_FEED).map((it, rank) => normalize({ ...it, rank }, s)).filter(Boolean)
      )
    );
    const items = [];
    const status = results.map((r, i) => {
      const s = this.sources[i];
      if (r.status === 'fulfilled') {
        r.value.forEach((it) => items.push({ ...it, source: s.id }));
        return { id: s.id, name: s.name, kind: s.kind, region: s.region, weight: s.weight, approx: !!s.approx, ok: true, items: r.value.length };
      }
      return { id: s.id, name: s.name, kind: s.kind, region: s.region, weight: s.weight, approx: !!s.approx, ok: false, error: String(r.reason && r.reason.message || r.reason) };
    });

    if (!items.length) {
      this.snapshot = { ...this.snapshot, sources: status, error: 'No sources reachable' };
      return this.snapshot;
    }

    const clusters = clusterItems(items, (id) => this.byId[id].weight);
    const ranked = rankStories(clusters, this.byId, this.now());
    const pool = ranked.slice(0, 40).map((s) => this._assignIdentity(s));
    const top = pool.slice(0, TOP_N).sort((a, b) => b.score - a.score);
    const more = pool.slice(TOP_N, TOP_N + MORE_N).sort((a, b) => b.score - a.score);
    for (const s of pool) s.topic = classify([s.headline, s.summary, ...s.items.map((i) => i.title)].join(' '));

    const prev = new Map(this.snapshot.stories.map((s) => [s.id, s.rank]));
    top.forEach((s, i) => {
      s.rank = i + 1;
      s.previousRank = prev.get(s.id) ?? null;
      s.isNew = this.snapshot.stories.length > 0 && !prev.has(s.id);
    });
    more.forEach((s, i) => { s.rank = TOP_N + i + 1; });
    this.known = pool;

    const changes = this._diff(this.snapshot.stories, top);
    const first = !this.snapshot.updatedAt;
    this.snapshot = { updatedAt: this.now(), stories: top, more, sources: status, events: this.events, error: null };
    if (changes.length && !first) {
      this.events.unshift(...changes.map((c) => ({ ...c, at: this.now() })));
      this.events.length = Math.min(this.events.length, 30);
      this.emit('update', { changes, snapshot: this.snapshot });
    }
    return this.snapshot;
  }

  // Resume from a previously published snapshot (used by the static builder).
  restore(snap) {
    if (!snap || !Array.isArray(snap.stories)) return;
    this.snapshot = { ...snap, stories: snap.stories };
    this.events = Array.isArray(snap.events) ? snap.events : [];
    this.known = snap.stories.concat(snap.more || []).map((s) => ({ ...s, _tokens: titleSet(s) }));
  }

  // Reuse the id/firstSeen of the previously seen story this one continues.
  _assignIdentity(story) {
    const mine = titleSet(story);
    const urls = new Set(story.items.map((i) => i.url));
    let best = null, bestScore = 0;
    for (const k of this.known) {
      if (k._claimed) continue;
      const shareUrl = k.items.some((i) => urls.has(i.url));
      const sim = jaccard(mine, k._tokens);
      const score = shareUrl ? 1 + sim : sim;
      if (score > bestScore && (shareUrl || sim >= 0.4)) { best = k; bestScore = score; }
    }
    if (best) best._claimed = true;
    const out = { ...story, _tokens: mine };
    out.id = best ? best.id : crypto.createHash('sha1').update(story.headline + this.now()).digest('hex').slice(0, 10);
    out.firstSeen = best ? best.firstSeen : this.now();
    return out;
  }

  _diff(oldTop, newTop) {
    const oldIds = new Map(oldTop.map((s) => [s.id, s]));
    const newIds = new Set(newTop.map((s) => s.id));
    const changes = [];
    for (const s of newTop) {
      const o = oldIds.get(s.id);
      if (!o) changes.push({ type: 'entered', id: s.id, headline: s.headline, rank: s.rank });
      else if (o.rank !== s.rank) changes.push({ type: 'moved', id: s.id, headline: s.headline, from: o.rank, rank: s.rank });
    }
    for (const o of oldTop) if (!newIds.has(o.id)) changes.push({ type: 'exited', id: o.id, headline: o.headline, from: o.rank });
    return changes;
  }

  publicSnapshot() {
    const strip = ({ _tokens, _claimed, ...rest }) => rest;
    return { ...this.snapshot, stories: this.snapshot.stories.map(strip), more: (this.snapshot.more || []).map(strip) };
  }
}

module.exports = { Aggregator, TOP_N };
