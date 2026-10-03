'use strict';
// Saves the raw feeds as they are right now into test/samples/<date>/, so real-world
// grouping/ranking regressions can be captured and replayed by `npm test`.
//   node scripts/capture-sample.js [name]
const fs = require('fs');
const path = require('path');
const { SOURCES } = require('../lib/sources');

(async () => {
  const name = process.argv[2] || new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', 'test', 'samples', name);
  fs.mkdirSync(dir, { recursive: true });
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { headers: { 'User-Agent': 'Top10News/1.0' }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      fs.writeFileSync(path.join(dir, `${s.id}.xml`), await res.text());
      console.log('saved', s.id);
    } catch (e) { console.log('skipped', s.id, e.message); }
  }
})();
