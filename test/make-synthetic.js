'use strict';
// Generates test/samples/synthetic-1/*.xml: fictional but realistically messy feeds
// (varied wording, near-duplicate events, live blogs, opinion pieces, Google News formatting).
// Real captures made with scripts/capture-sample.js live next to it and are tested the same way.
const fs = require('fs');
const path = require('path');
const { feed } = require('../lib/demo');

const NOW = Date.parse('2026-10-03T12:00:00Z');
const S = {
  quake: ['Magnitude 6.4 earthquake strikes off coast of Tamarinda', 'Strong earthquake shakes Tamarinda coast, buildings damaged', 'Tamarinda hit by 6.4 magnitude quake; no tsunami warning', 'Earthquake off Tamarinda rattles coastal cities'],
  quake2: ['Magnitude 5.9 earthquake rattles northern Kaldoria', 'Kaldoria quake injures dozens in mountain villages'],
  bank: ['Norvania central bank holds interest rates steady', 'Norvania keeps rates unchanged as inflation cools', 'Norvanian central bank leaves benchmark rate on hold'],
  talks: ['Estovia and Karelan delegations resume ceasefire talks in Geneva', 'Geneva talks: Estovia, Karelan envoys meet on border ceasefire', 'Ceasefire talks between Estovia and Karelan resume'],
  fire: ['Wildfires force thousands to flee southern Mirabel', 'Mirabel wildfires: evacuation orders widen as winds rise', 'Thousands evacuated as wildfires spread across Mirabel province'],
  trial: ['Former Carvonia minister goes on trial for corruption', 'Corruption trial of ex-minister opens in Carvonia'],
  chip: ['Lumina unveils quantum chip with lower error rates', 'Lumina says new quantum processor cuts errors sharply'],
  cholera: ['Cholera cases fall by a third after vaccine drive, health agency says', 'Mass vaccination cuts cholera cases, global health agency reports'],
  vote: ['Ostrava Republic votes in tight presidential runoff', 'Polls open in Ostrava Republic presidential runoff'],
  port: ['Port Hesper dockworkers strike over automation plans', 'Dockworkers walk out at Port Hesper'],
  oil: ['Oil slips as Brantland lifts output forecast', 'Crude falls after Brantland raises production outlook'],
};
// source → [[story, variantIndex, section]] in homepage order
const PLAN = {
  bbc: [['quake', 0], ['talks', 2], ['fire', 1], ['bank', 0], ['vote', 0], ['cholera', 0], ['oil', 0]],
  nyt: [['talks', 0], ['quake', 1], ['vote', 1], ['fire', 0], ['trial', 0], ['bank', 1], ['chip', 0]],
  wapo: [['quake', 2], ['fire', 2], ['talks', 1], ['port', 0], ['chip', 1], ['bank', 2]],
  guardian: [['fire', 1], ['quake', 3], ['talks', 2], ['cholera', 1], ['quake2', 0], ['trial', 1]],
  aljazeera: [['talks', 1], ['quake', 0], ['quake2', 1], ['fire', 0], ['vote', 1]],
  npr: [['quake', 1], ['bank', 0], ['fire', 2], ['port', 1], ['chip', 0]],
  dw: [['talks', 0], ['quake', 2], ['vote', 0], ['cholera', 0], ['oil', 1]],
  france24: [['quake', 3], ['talks', 1], ['vote', 1], ['fire', 1], ['trial', 0]],
  // Google-News style: " - Publisher" suffix, redirect URLs, link-list descriptions
  reuters: [['quake', 0], ['bank', 1], ['talks', 0], ['fire', 2], ['oil', 0], ['chip', 1]],
  ap: [['quake', 2], ['fire', 0], ['talks', 1], ['vote', 0], ['trial', 1], ['port', 1]],
  afp: [['quake', 1], ['talks', 2], ['fire', 1], ['cholera', 1], ['vote', 1]],
};
const NOISE = {
  bbc: [{ t: 'Live: Reaction as Tamarinda counts the cost of the quake', l: 'https://www.bbc.com/news/live/abc123', d: '' }],
  guardian: [{ t: 'The government must not look away from coastal flooding', l: 'https://www.theguardian.com/commentisfree/2026/oct/03/flood-view', d: 'Opinion piece.' },
             { t: 'Cup final: Qalatar beat Brantland on penalties', l: 'https://www.theguardian.com/football/2026/oct/03/cup-final', d: 'Match report.' }],
  nyt: [{ t: 'Video: A tour of the new Lumina lab', l: 'https://www.nytimes.com/video/technology/lumina', d: '' }],
};
const DETAIL = {
  quake: ['The quake struck about 40 kilometres offshore at a shallow depth, the geological survey said.', 'At least 12 people were killed and dozens injured, local officials said.', 'Rescue teams were searching collapsed buildings in several coastal towns.', 'Authorities said no tsunami warning had been issued.'],
  bank: ['Policymakers said inflation had cooled but remained above target.', 'The bank signalled that any future cuts would depend on incoming data.'],
  talks: ['Negotiators from both sides met for a second day at a hotel in Geneva.', 'Mediators said discussions focused on a monitored ceasefire along the border.'],
  fire: ['Strong winds pushed flames toward several towns on Friday.', 'Emergency services said more than 3,000 residents had been told to leave their homes.'],
  vote: ['Opinion polls had shown the two candidates separated by only a few points.'],
};
const GOOGLE = new Set(['reuters', 'ap', 'afp']);
const pub = { reuters: 'Reuters', ap: 'AP News', afp: 'AFP' };

DETAIL.quake = DETAIL.quake.slice();
const dir = path.join(__dirname, 'samples', 'synthetic-1');
fs.mkdirSync(dir, { recursive: true });
for (const [src, plan] of Object.entries(PLAN)) {
  const items = [];
  const noise = NOISE[src] || [];
  plan.forEach(([story, v], i) => {
    if (i === 1 && noise[0]) items.push({ ...noise.shift(), p: NOW - 30 * 60000 });
    const title = S[story][v % S[story].length];
    items.push(GOOGLE.has(src)
      ? { t: `${title} - ${pub[src]}`, l: `https://news.google.com/rss/articles/${src}-${story}-${v}`, d: `<ol><li><a href="https://x">${title}</a>&nbsp;&nbsp;<font>${pub[src]}</font></li></ol>`, p: NOW - (i + 1) * 25 * 60000 }
      : { t: title, l: `https://www.${src}.example/news/${story}-${v}`, d: `${title}. ${(DETAIL[story] || ['Officials said more details were expected later today.']).slice(i % 2, (i % 2) + 2).join(' ')}`, p: NOW - (i + 1) * 25 * 60000 });
    if (src === 'aljazeera' && story === 'quake') items[items.length - 1].d = items[items.length - 1].d.replace('12 people', '15 people');
  });
  for (const n of noise) items.push({ ...n, p: NOW - 90 * 60000 });
  fs.writeFileSync(path.join(dir, `${src}.xml`), feed(items));
}
console.log('wrote', dir);
