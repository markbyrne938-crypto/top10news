'use strict';

// Offline demo feeds with entirely fictional headlines, used by `npm run demo`
// and the tests. Every few refreshes a new story "breaks" so the live-update
// behaviour can be seen without network access.

const POOL = [
  ['Parliament of Valdoria passes sweeping coastal flood defence bill', 'Lawmakers in Valdoria approved a multi-year plan to reinforce sea walls after record storm surges.'],
  ['Central bank of Norvania holds interest rates steady amid inflation worries', 'Policymakers in Norvania kept the benchmark rate unchanged and signalled caution on future cuts.'],
  ['Magnitude 6.4 earthquake strikes off the coast of Tamarinda, no tsunami warning issued', 'Authorities in Tamarinda said buildings shook in coastal cities but early reports show limited damage.'],
  ['Talks between Estovia and Karelan delegations resume in Geneva', 'Negotiators from Estovia and Karelan met for a second day of talks on a border ceasefire.'],
  ['Wildfires force thousands to evacuate across southern Mirabel province', 'Mirabel emergency services ordered evacuations as wildfires spread in strong winds.'],
  ['Global health agency reports sharp fall in cholera cases after vaccination drive', 'Cholera cases fell by a third following a mass vaccination campaign, the agency said.'],
  ['Zephyr Air grounds fleet after software fault disrupts flights worldwide', 'Zephyr Air grounded its fleet for several hours after a software fault hit its booking systems.'],
  ['Scientists announce new deep-sea species discovered near Kermadoc Trench', 'A research expedition catalogued dozens of previously unknown organisms in the Kermadoc Trench.'],
  ['Voters in Ostrava Republic head to polls in tight presidential runoff', 'Polls opened in the Ostrava Republic runoff, with opinion surveys showing a narrow gap.'],
  ['Heavy monsoon rains cause deadly landslides in northern Dravidia', 'Rescue teams in northern Dravidia searched for survivors after monsoon rains triggered landslides.'],
  ['Tech giant Lumina unveils quantum chip, claims leap in error correction', 'Lumina said its new quantum processor sharply reduces error rates in early benchmarks.'],
  ['Peace envoy arrives in Sundara as aid convoys cross the border', 'A UN envoy arrived in Sundara while aid convoys entered the region for the first time in weeks.'],
  ['Oil prices slip as Brantland raises output forecast', 'Crude futures dipped after Brantland lifted its production outlook for next quarter.'],
  ['Stadium roof collapse in Qalatar injures dozens ahead of cup final', 'Dozens were injured when part of a stadium roof collapsed in Qalatar before the cup final.'],
  ['Dockworkers in Port Hesper begin 48-hour strike over automation plans', 'Port Hesper dockworkers walked out in protest at plans to automate cargo handling.'],
  ['Landmark trial of ex-minister begins in Carvonia on corruption charges', 'The trial of a former Carvonia minister opened amid heavy security.'],
];
const SOURCE_IDS = ['reuters', 'ap', 'afp', 'bbc', 'nyt', 'wapo', 'guardian', 'aljazeera', 'npr', 'dw', 'france24'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const feed = (items) =>
  `<?xml version="1.0"?><rss version="2.0"><channel>${items
    .map((i) => `<item><title>${esc(i.t)}</title><link>${i.l}</link><description>${esc(i.d)}</description><pubDate>${new Date(i.p).toUTCString()}</pubDate></item>`)
    .join('')}</channel></rss>`;

// Deterministic pseudo-random so tests are stable.
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }

function makeDemoFetch(now = () => Date.now()) {
  let calls = 0;
  return async (source) => {
    const round = Math.floor(calls++ / SOURCE_IDS.length); // one round per refresh
    const shift = Math.floor(round / 2) % POOL.length;      // a new story rises every other refresh
    const rand = rng(SOURCE_IDS.indexOf(source.id) + 7 + round);
    const order = POOL.map((_, i) => i);
    const rotated = order.slice(shift).concat(order.slice(0, shift)).slice(0, 14);
    // Each outlet orders things slightly differently.
    for (let i = 0; i + 1 < rotated.length; i++) if (rand() < 0.25) [rotated[i], rotated[i + 1]] = [rotated[i + 1], rotated[i]];
    return feed(rotated.map((idx, n) => ({
      t: POOL[idx][0],
      l: `https://example.com/${source.id}/${idx}`,
      d: POOL[idx][1],
      p: now() - (n + 1) * 20 * 60000,
    })));
  };
}

module.exports = { makeDemoFetch, feed, POOL };
