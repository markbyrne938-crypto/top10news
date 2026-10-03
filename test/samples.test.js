'use strict';
// Replays every saved feed set in test/samples/* through the full pipeline.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { SOURCES } = require('../lib/sources');
const { Aggregator } = require('../lib/aggregator');

const root = path.join(__dirname, 'samples');
const dirs = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());

async function run(dir) {
  const agg = new Aggregator({
    sources: SOURCES,
    now: () => Date.parse('2026-10-03T12:30:00Z'),
    fetchText: async (s) => fs.readFileSync(path.join(root, dir, `${s.id}.xml`), 'utf8'),
  });
  return agg.refresh();
}

for (const dir of dirs) {
  test(`sample ${dir}: general invariants`, async () => {
    const snap = await run(dir);
    assert.ok(snap.stories.length >= 5, 'enough stories');
    const scores = snap.stories.map((s) => s.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'sorted by score');
    const titles = snap.stories.map((s) => s.headline);
    assert.equal(new Set(titles).size, titles.length, 'no duplicate headlines');
    for (const s of snap.stories) {
      assert.ok(s.items.length >= 1 && s.items.every((i) => /^https?:/.test(i.url)));
      assert.equal(new Set(s.items.map((i) => i.source)).size, s.items.length, 'one item per source');
      assert.ok(!/^(live|video|opinion)\b/i.test(s.headline), 'no format prefixes: ' + s.headline);
      assert.ok(!/ - (Reuters|AP News|AFP)$/.test(s.headline), 'publisher suffix stripped: ' + s.headline);
    }
  });
}

test('synthetic-1: distinct events stay apart, same event merges', async () => {
  const snap = await run('synthetic-1');
  const all = [...snap.stories, ...snap.more];
  const tam = all.find((s) => /Tamarinda/.test(s.headline));
  assert.ok(tam, 'Tamarinda quake is listed');
  assert.ok(tam.sourceCount >= 9, 'Tamarinda quake merged across sources, got ' + tam.sourceCount);
  // The Kaldoria quake is covered by only 2 outlets, so it is not published, and it must not have been absorbed into the other quake.
  assert.ok(!all.some((s) => /Kaldoria/.test(s.headline)), 'two-outlet story is not published');
  assert.ok(!tam.items.some((i) => /Kaldoria/.test(i.title)), 'Kaldoria headlines were not merged into the Tamarinda story');
  assert.ok(all.every((s) => s.sourceCount >= 3));
  assert.equal(snap.stories[0].id, tam.id, 'most widely covered story is #1');
});

test('synthetic-1: noise is excluded and wire wording preferred', async () => {
  const snap = await run('synthetic-1');
  const text = JSON.stringify([...snap.stories, ...snap.more]);
  assert.ok(!/commentisfree|\/football\/|nytimes\.com\/video/.test(text), 'opinion/sport/video dropped');
  const tam = snap.stories.find((s) => /Tamarinda/.test(s.headline));
  assert.equal(tam.items[0].kind, 'wire');
  assert.ok(tam.summary.length > 0, 'summary comes from a direct feed, not a Google link list');
  assert.ok(!/<|&nbsp;/.test(tam.summary));
});

test('synthetic-1: breakdown explains the score', async () => {
  const snap = await run('synthetic-1');
  for (const s of snap.stories) {
    const sum = s.items.reduce((a, i) => a + i.points, 0);
    assert.ok(Math.abs(sum - s.rawScore) < 0.05, 'points add up to rawScore');
    assert.ok(Math.abs(s.rawScore * s.freshness - s.score) < 0.05);
    assert.ok(s.topic && s.regions.length >= 1);
  }
});

test('synthetic-1: key points are sourced, short, and not headline restatements', async () => {
  const snap = await run('synthetic-1');
  const tam = snap.stories.find((s) => /Tamarinda/.test(s.headline));
  assert.ok(tam.points.length >= 2 && tam.points.length <= 4, 'got ' + tam.points.length);
  for (const p of tam.points) {
    assert.ok(p.sources.length >= 1 && p.text.length <= 300);
    assert.ok(!/more details were expected/.test(p.text), 'boilerplate excluded');
  }
  assert.ok(tam.points.some((p) => p.sources.length >= 3), 'a point backed by several outlets ranks first');
  assert.ok(tam.points[0].sources.length >= tam.points[tam.points.length - 1].sources.length);
});

test('synthetic-1: conflicting figures are flagged with who said what', async () => {
  const snap = await run('synthetic-1');
  const tam = snap.stories.find((s) => /Tamarinda/.test(s.headline));
  const d = tam.differences.find((x) => x.label === 'Deaths reported');
  assert.ok(d, 'death toll difference detected');
  const v15 = d.values.find((v) => v.value === '15');
  assert.deepEqual(v15.sources, ['Al Jazeera']);
  assert.ok(d.values.find((v) => v.value === '12').sources.length >= 2);
});
