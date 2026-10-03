'use strict';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : '#');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const TOPICS = ['Top 10', 'World', 'Politics', 'Conflict', 'Business', 'Technology', 'Science & climate', 'Health', 'Disasters'];
const STALE_MIN = 20;
const SHOW_OUTLETS = 5;

let data = null;
let lastIds = null;      // ids from the previous update, to spot new entrants while the page is open
let sinceVisit = null;   // ids that were not in the top 10 when the reader last visited
let changeLog = [];
let topic = 'Top 10';
let region = '';
let query = '';
let loadError = false;

/* ---------- helpers ---------- */
function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 2) return 'just now';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function link(it, text) {
  const a = el('a', null, text || it.sourceName);
  a.href = safeUrl(it.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = `${it.sourceName}: ${it.title}`;
  return a;
}

/* ---------- story pieces ---------- */
// Key points taken from the outlets' own feed summaries, each credited to the outlets that say it.
function pointsEl(s) {
  if (!s.points || !s.points.length) return s.summary ? el('p', 'stand', s.summary) : null;
  const ul = el('ul', 'points');
  for (const p of s.points) {
    const li = el('li');
    li.append(p.text + ' ');
    li.appendChild(el('span', 'attr', p.sources.length > 2 ? `${p.sources.slice(0, 2).join(', ')} +${p.sources.length - 2}` : p.sources.join(', ')));
    ul.appendChild(li);
  }
  return ul;
}

function differEl(s) {
  if (!s.differences || !s.differences.length) return null;
  const box = el('p', 'differ');
  box.appendChild(el('b', null, 'Outlets differ. '));
  box.append(s.differences.map((d) => `${d.label}: ` + d.values.map((v) => `${v.value} (${v.sources.length > 2 ? v.sources.slice(0, 2).join(', ') + ' +' + (v.sources.length - 2) : v.sources.join(', ')})`).join(' vs. ')).join('. ') + '.');
  return box;
}

function readMoreEl(s) {
  const p = el('p', 'more');
  p.append('Read more at ');
  const nodes = s.items.map((it) => {
    const a = link(it);
    if (it.kind !== 'wire') return a;
    const b = el('b'); b.appendChild(a); return b;
  });
  const put = (list) => list.forEach((n, i) => { if (i) p.append(' · '); p.append(n); });
  const rest = nodes.length - SHOW_OUTLETS;
  if (rest <= 1) { put(nodes); return p; }
  put(nodes.slice(0, SHOW_OUTLETS));
  const btn = el('button', null, `all ${nodes.length} outlets`);
  btn.type = 'button';
  btn.addEventListener('click', () => {
    btn.remove();
    nodes.slice(SHOW_OUTLETS).forEach((n) => { p.append(' · '); p.append(n); });
  });
  p.append(' · ', btn);
  return p;
}

function metaEl(s) {
  const p = el('p', 'by');
  p.append(`${s.sourceCount} outlets`);
  if (s.published) {
    p.append(' · ');
    const t = el('span', null, ago(s.published));
    t.title = new Date(s.published).toLocaleString();
    p.append(t);
  }
  if (s.regions.length === 1) {
    p.append(' · ');
    p.append(el('span', 'flag', `Only outlets in ${s.regions[0]} so far`));
  }
  p.append(' · ');
  const share = el('button', 'share', 'Share');
  share.type = 'button';
  share.addEventListener('click', () => shareStory(s, share));
  p.append(share);
  return p;
}

async function shareStory(s, btn) {
  const url = location.origin + location.pathname + '#story-' + s.id;
  try {
    if (navigator.share) { await navigator.share({ title: s.headline, url }); return; }
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Link copied';
  } catch { btn.textContent = 'Copy the page address to share'; }
  setTimeout(() => { btn.textContent = 'Share'; }, 2500);
}

function whyEl(s) {
  const d = el('details', 'why');
  d.appendChild(el('summary', null, 'How this ranked'));
  const t = el('table');
  const head = el('tr');
  ['Outlet', 'Region', 'Placed', 'Points'].forEach((h) => head.appendChild(el('th', null, h)));
  t.appendChild(el('thead')).appendChild(head);
  const body = el('tbody');
  for (const it of s.items) {
    const tr = el('tr');
    const td = el('td'); td.appendChild(link(it));
    tr.append(td, el('td', null, it.region), el('td', null, `No. ${it.position}`), el('td', null, it.points.toFixed(2)));
    body.appendChild(tr);
  }
  t.appendChild(body);
  d.appendChild(t);
  d.appendChild(el('p', null, `Outlet points add up to ${s.rawScore.toFixed(2)}; the story's age scales that by ${s.freshness.toFixed(2)}, giving ${s.score.toFixed(2)}. Higher placement and a heavier-weighted outlet earn more points.`));
  return d;
}

function kickerEl(s, withRank) {
  const k = el('p', 'kicker');
  k.append(withRank ? `No. ${s.rank} · ${s.topic}` : s.topic);
  if (s.isNew) k.append(el('span', 'where', ' · New to the top 10'));
  else if (sinceVisit && sinceVisit.has(s.id)) k.append(el('span', 'where since', ' · New since your last visit'));
  else if (s.previousRank && s.previousRank !== s.rank) {
    k.append(el('span', 'where', s.previousRank > s.rank ? ` · Up from No. ${s.previousRank}` : ` · Down from No. ${s.previousRank}`));
  }
  return k;
}

function storyEl(s, variant, flashIds) {
  const outer = el('article', `story story--${variant}${flashIds.has(s.id) ? ' flash' : ''}`);
  outer.id = 'story-' + s.id;
  let art = outer;
  if (variant === 'lead' || variant === 'second') { // ranks 1-3 get a large numeral
    outer.classList.add('numbered');
    outer.appendChild(el('div', 'bignum', String(s.rank)));
    art = el('div', 'body');
    outer.appendChild(art);
  }
  art.appendChild(kickerEl(s, variant === 'result'));
  const h = el(variant === 'lead' ? 'h2' : 'h3');
  h.appendChild(link(s.items[0], s.headline));
  art.appendChild(h);
  for (const part of [pointsEl(s), differEl(s), readMoreEl(s), metaEl(s), whyEl(s)]) if (part) art.appendChild(part);
  return outer;
}

function compactEl(s) {
  const li = el('li');
  li.id = 'story-' + s.id;
  li.appendChild(el('span', 'n', String(s.rank)));
  const box = el('div');
  box.appendChild(link(s.items[0], s.headline));
  box.appendChild(el('span', 'by', `${s.topic} · ${s.sourceCount} outlets`));
  li.appendChild(box);
  return li;
}

/* ---------- page ---------- */
function matches(s) {
  if (region && !s.regions.includes(region)) return false;
  if (topic !== 'Top 10' && topic !== 'World' && s.topic !== topic) return false;
  if (query) {
    const hay = [s.headline, s.topic, ...(s.points || []).map((p) => p.text), ...s.items.map((i) => i.sourceName + ' ' + i.title)].join(' ').toLowerCase();
    return query.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }
  return true;
}

function renderStories(flashIds = new Set()) {
  const root = $('stories');
  if (!data) {
    root.replaceChildren(loadError ? errorEl() : el('p', 'loading', 'Loading the latest stories…'));
    return;
  }
  const all = [...data.stories, ...(data.more || [])];
  const nodes = [];
  const filtered = topic !== 'Top 10' || query;

  if (!filtered) {
    const top = data.stories.filter(matches);
    const [lead, ...others] = top;
    if (!region && data.stories.length < 10) {
      nodes.push(el('p', 'small thin', data.stories.length
        ? `Showing ${data.stories.length} stories. Only stories reported by at least three outlets are published.`
        : 'No story is reported by three outlets yet. Check back shortly.'));
    }
    if (!top.length && region) nodes.push(el('p', 'empty', 'No top-10 stories are covered by outlets in that region right now.'));
    if (lead) nodes.push(storyEl(lead, 'lead', flashIds));
    if (others.length) {
      const pair = el('div', 'pair');
      others.slice(0, 2).forEach((s) => pair.appendChild(storyEl(s, 'second', flashIds)));
      nodes.push(pair);
      const rows = el('div');
      others.slice(2).forEach((s) => {
        const row = el('div', 'row');
        row.appendChild(el('div', 'num', String(s.rank)));
        row.appendChild(storyEl(s, 'row', flashIds));
        rows.appendChild(row);
      });
      nodes.push(rows);
    }
    const more = (data.more || []).filter(matches);
    if (more.length) {
      nodes.push(el('h2', 'section-h', 'Also in the news'));
      const ul = el('ul', 'compact');
      more.forEach((s) => ul.appendChild(compactEl(s)));
      nodes.push(ul);
    }
  } else {
    const list = all.filter(matches);
    const what = query ? `Results for “${query}”` : topic;
    nodes.push(el('h2', 'view-h', what));
    nodes.push(el('p', 'view-n', `${list.length} of the ${all.length} leading stories${region ? ` covered by outlets in ${region}` : ''}`));
    if (!list.length) nodes.push(el('p', 'empty', 'Nothing matches. Try a different word, topic or region.'));
    list.forEach((s) => nodes.push(storyEl(s, 'result', flashIds)));
  }
  root.replaceChildren(...nodes);
}

function errorEl() {
  const box = el('div', 'empty');
  box.appendChild(el('p', null, 'We could not load the latest stories. Check your connection and try again.'));
  const b = el('button', 'btn retry', 'Try again');
  b.type = 'button';
  b.addEventListener('click', refreshNow);
  box.appendChild(b);
  return box;
}

function renderTopics() {
  $('topics').replaceChildren(...TOPICS.map((t) => {
    const a = el('a', null, t);
    a.href = t === 'Top 10' ? location.pathname : '?topic=' + encodeURIComponent(t);
    a.dataset.topic = t;
    if (t === topic) a.setAttribute('aria-current', 'true');
    return a;
  }));
}

function renderRegions() {
  const regions = [...new Set((data.sources || []).map((s) => s.region).filter(Boolean))].sort();
  const sel = $('region');
  sel.replaceChildren(new Option('any region', ''), ...regions.map((r) => new Option(r, r)));
  sel.value = regions.includes(region) ? region : '';
}

function renderRail() {
  const items = changeLog.slice(0, 8).map((c) => {
    const li = el('li');
    li.appendChild(el('time', null, clock(c.at)));
    const verb = c.type === 'entered' ? `entered at No. ${c.rank}` : c.type === 'exited' ? `left the top 10 (was No. ${c.from})` : `moved from No. ${c.from} to No. ${c.rank}`;
    li.append(`${c.headline} — ${verb}`);
    return li;
  });
  $('events').replaceChildren(...(items.length ? items : [el('li', 'muted', 'No changes recorded yet.')]));
  $('sources').replaceChildren(...(data.sources || []).map((s) => el('li', s.ok ? '' : 'bad', s.name)));
}

function renderStatus() {
  const st = $('updated');
  const banner = $('banner');
  if (!data) { st.className = 'status'; st.textContent = loadError ? 'Offline' : 'Loading…'; return; }
  const ageMin = data.updatedAt ? (Date.now() - data.updatedAt) / 60000 : Infinity;
  st.className = 'status' + (ageMin < STALE_MIN ? ' live' : '');
  st.textContent = data.updatedAt ? `Updated ${clock(data.updatedAt)} (${ago(data.updatedAt)})` : 'Waiting for the first update';
  let msg = '', warn = false;
  if (data.demo) msg = 'Demonstration mode: these headlines are fictional.';
  else if (data.error) { msg = `${data.error}. Showing the last stories we had.`; warn = true; }
  else if (ageMin > STALE_MIN) { msg = `This page was last refreshed ${Math.round(ageMin)} minutes ago, so it may be out of date. Updates may be delayed.`; warn = true; }
  banner.hidden = !msg;
  banner.className = 'banner' + (warn ? ' warn' : '');
  banner.textContent = msg;
}

function render(d, changes = []) {
  data = d; loadError = false;
  const entered = changes.filter((c) => c.type === 'entered');
  if (lastIds === null) {
    changeLog = (d.events || []).slice();
    // "New since your last visit": compare with the ids saved when the reader was last here.
    try {
      const seen = JSON.parse(store.get('top10news.seen') || 'null');
      if (seen && Array.isArray(seen.ids) && Date.now() - seen.at < 7 * 864e5) {
        const old = new Set(seen.ids);
        sinceVisit = new Set(d.stories.filter((s) => !old.has(s.id)).map((s) => s.id));
        if (sinceVisit.size === d.stories.length) sinceVisit = null; // everything is new: not informative
      }
    } catch {}
  } else {
    const fresh = (d.events || []).filter((e) => !changeLog.some((c) => c.at === e.at && c.id === e.id && c.type === e.type));
    changeLog = [...fresh, ...changeLog].slice(0, 30);
  }
  store.set('top10news.seen', JSON.stringify({ ids: [...d.stories, ...(d.more || [])].map((s) => s.id), at: Date.now() }));
  renderTopics(); renderRegions(); renderStatus(); renderRail();
  renderStories(new Set(entered.map((c) => c.id)));
  if (lastIds !== null && entered.length) notify(entered);
  lastIds = d.stories.map((s) => s.id);
  jumpToHash();
}

function jumpToHash() {
  const m = location.hash.match(/^#(story-[\w-]+)$/);
  const target = m && document.getElementById(m[1]);
  if (target && !target.dataset.jumped) {
    target.dataset.jumped = '1';
    target.classList.add('flash');
    target.scrollIntoView({ block: 'center' });
  }
}

/* ---------- alerts ---------- */
function alertsOn() { return store.get('top10news.alerts') === '1' && 'Notification' in window && Notification.permission === 'granted'; }
function paintAlertButton() {
  const b = $('alerts');
  if (!('Notification' in window)) { b.hidden = true; $('alertNote').textContent = 'Browser alerts are not supported here. Use the RSS feed instead.'; return; }
  b.textContent = alertsOn() ? 'Alerts on — turn off' : 'Alert me to new entries';
  $('alertNote').textContent = Notification.permission === 'denied'
    ? 'Your browser is blocking notifications for this site.'
    : 'Works while this page is open in a tab.';
}
$('alerts').addEventListener('click', async () => {
  if (alertsOn()) store.set('top10news.alerts', '0');
  else if (await Notification.requestPermission() === 'granted') store.set('top10news.alerts', '1');
  paintAlertButton();
});
function notify(entered) {
  if (!alertsOn()) return;
  new Notification(`New in the top 10 at No. ${entered[0].rank}`, { body: entered[0].headline + (entered.length > 1 ? ` (+${entered.length - 1} more)` : ''), tag: 'top10news' });
}

/* ---------- routing, search and display settings ---------- */
function readUrl() {
  const p = new URLSearchParams(location.search);
  const t = p.get('topic');
  topic = TOPICS.includes(t) ? t : 'Top 10';
}
function setTopic(t) {
  topic = t;
  history.pushState(null, '', t === 'Top 10' ? location.pathname : '?topic=' + encodeURIComponent(t));
  renderTopics(); renderStories();
  window.scrollTo({ top: 0 });
}
$('topics').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-topic]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault(); setTopic(a.dataset.topic);
});
window.addEventListener('popstate', () => { readUrl(); if (data) { renderTopics(); renderStories(); } });
$('region').addEventListener('change', (e) => { region = e.target.value; renderStories(); });
let timer;
$('q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { query = e.target.value.trim(); renderStories(); }, 150); });
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (e.key === '/' && !typing) { e.preventDefault(); $('q').focus(); }
  else if (e.key === 'Escape' && document.activeElement === $('q')) { $('q').value = ''; query = ''; $('q').blur(); renderStories(); }
});

const THEMES = ['', 'dark', 'light'];
function paintTheme() {
  const t = document.documentElement.dataset.theme || '';
  $('theme').textContent = 'Theme: ' + (t || 'auto');
}
$('theme').addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(document.documentElement.dataset.theme || '') + 1) % THEMES.length];
  if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
  store.set('top10news.theme', next);
  paintTheme();
});
function zoom(delta) {
  const z = Math.max(-1, Math.min(2, Number(document.documentElement.dataset.zoom || 0) + delta));
  document.documentElement.dataset.zoom = String(z);
  store.set('top10news.zoom', String(z));
}
$('larger').addEventListener('click', () => zoom(1));
$('smaller').addEventListener('click', () => zoom(-1));

/* ---------- data ---------- */
async function pollStatic() {
  try {
    const res = await fetch('data/top10.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    const before = new Set(lastIds || []);
    const changes = lastIds ? d.stories.filter((s) => !before.has(s.id)).map((s) => ({ type: 'entered', id: s.id, headline: s.headline, rank: s.rank })) : [];
    render(d, changes);
  } catch {
    loadError = true;
    if (!data) renderStories();
    renderStatus();
    if (data) { $('updated').textContent = 'Offline — showing the last stories we had'; $('updated').className = 'status'; }
  }
}
let serverMode = false;
async function refreshNow() {
  const b = $('refresh');
  b.setAttribute('aria-busy', 'true'); b.textContent = 'Checking…';
  try {
    if (serverMode) { const d = await (await fetch('api/top10')).json(); render(d, []); } else await pollStatic();
  } catch { loadError = true; renderStatus(); }
  b.removeAttribute('aria-busy'); b.textContent = 'Refresh';
}
$('refresh').addEventListener('click', refreshNow);

function connectSSE() {
  const es = new EventSource('events');
  es.addEventListener('hello', (e) => render(JSON.parse(e.data)));
  es.addEventListener('update', (e) => { const d = JSON.parse(e.data); render(d, d.changes); });
  es.onerror = () => { $('updated').textContent = 'Reconnecting…'; $('updated').className = 'status'; };
}

async function start() {
  readUrl();
  $('today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  paintAlertButton(); paintTheme(); renderTopics();
  try { serverMode = !!window.EventSource && (await fetch('api/top10')).ok; } catch {}
  if (serverMode) connectSSE();
  else {
    pollStatic(); setInterval(pollStatic, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pollStatic(); });
  }
  setInterval(() => { if (data) renderStatus(); }, 60000);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
start();
