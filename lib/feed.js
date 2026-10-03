'use strict';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// RSS 2.0 feed of the current top 10, for feed readers.
function toRss(snapshot, siteUrl = '') {
  const base = siteUrl.replace(/\/?$/, '/');
  const items = snapshot.stories.map((s) => {
    const sources = s.items.map((i) => `<li><a href="${esc(i.url)}">${esc(i.sourceName)}</a> (#${i.position})</li>`).join('');
    const pts = (s.points && s.points.length) ? `<ul>${s.points.map((p) => `<li>${esc(p.text)} (${esc(p.sources.join(', '))})</li>`).join('')}</ul>` : `<p>${esc(s.summary || '')}</p>`;
    const desc = `${pts}<p>Read more:</p><ul>${sources}</ul>`;
    return `<item><title>${esc(`${s.rank}. ${s.headline}`)}</title><link>${esc(s.items[0].url)}</link>` +
      `<guid isPermaLink="false">${esc(s.id)}-${s.rank}</guid><description>${esc(desc)}</description>` +
      (s.published ? `<pubDate>${new Date(s.published).toUTCString()}</pubDate>` : '') + '</item>';
  });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Top10News</title>` +
    `<link>${esc(base)}</link><description>The ten biggest world news stories right now, ranked across the world's newsrooms.</description>` +
    `<lastBuildDate>${new Date(snapshot.updatedAt || Date.now()).toUTCString()}</lastBuildDate>${items.join('')}</channel></rss>`;
}

module.exports = { toRss };
