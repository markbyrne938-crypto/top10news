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

let data = null;
let lastIds = null;
let topic = decodeURIComponent(location.hash.slice(1)) || 'Top 10';
let region = '';
let changeLog = [];

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

/* ---------- story pieces ---------- */
function bylineEl(s) {
  const p = el('p', 'by');
  p.append('Reported by ');
  const shown = s.items.slice(0, 3);
  shown.forEach((it, i) => {
    const a = el('a', null, it.sourceName);
    a.href = safeUrl(it.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = it.title;
    const node = it.kind === 'wire' ? el('b') : document.createDocumentFragment();
    node.append(a);
    p.append(node);
    if (i < shown.length - 1) p.append(i === shown.length - 2 && s.items.length === shown.length ? ' and ' : ', ');
  });
  const rest = s.items.length - shown.length;
  if (rest > 0) p.append(` and ${rest} other${rest === 1 ? '' : 's'}`);
  if (s.published) p.append(` · ${ago(s.published)}`);
  if (s.regions.length === 1 && s.sourceCount > 1) {
    p.append(' · ');
    p.append(el('span', 'flag', `Only outlets in ${s.regions[0]} so far`));
  }
  return p;
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
    const td = el('td');
    const a = el('a', null, it.sourceName);
    a.href = safeUrl(it.url); a.target = '_blank'; a.rel = 'noopener noreferrer';
    td.appendChild(a);
    tr.append(td, el('td', null, it.region), el('td', null, `No. ${it.position}`), el('td', null, it.points.toFixed(2)));
    body.appendChild(tr);
  }
  t.appendChild(body);
  d.appendChild(t);
  d.appendChild(el('p', null, `Outlet points add up to ${s.rawScore.toFixed(2)}; the story's age scales that by ${s.freshness.toFixed(2)}, giving ${s.score.toFixed(2)}. Higher placement and a heavier-weighted outlet earn more points.`));
  return d;
}

function kickerEl(s, label) {
  const k = el('p', 'kicker');
  if (label === '') k.append(s.topic); // list rows already show their number
  else k.append(`No. ${s.rank} · ${s.topic}`);
  if (s.isNew) k.append(el('span', 'where', ' · New to the top 10'));
  else if (s.previousRank && s.previousRank !== s.rank) {
    k.append(el('span', 'where', s.previousRank > s.rank ? ` · Up from No. ${s.previousRank}` : ` · Down from No. ${s.previousRank}`));
  }
  return k;
}

function storyEl(s, variant, flashIds) {
  const art = el('article', `story story--${variant}${flashIds.has(s.id) ? ' flash' : ''}`);
  art.appendChild(kickerEl(s, variant === 'row' ? '' : undefined));
  const h = el(variant === 'lead' ? 'h2' : 'h3');
  const a = el('a', null, s.headline);
  a.href = safeUrl(s.items[0].url); a.target = '_blank'; a.rel = 'noopener noreferrer';
  h.appendChild(a);
  art.appendChild(h);
  if (s.summary) art.appendChild(el('p', 'stand', s.summary));
  art.appendChild(bylineEl(s));
  art.appendChild(whyEl(s));
  return art;
}

function compactEl(s) {
  const li = el('li');
  li.appendChild(el('span', 'n', String(s.rank)));
  const box = el('div');
  const a = el('a', null, s.headline);
  a.href = safeUrl(s.items[0].url); a.target = '_blank'; a.rel = 'noopener noreferrer';
  box.appendChild(a);
  const by = el('span', 'by', `${s.topic} · ${s.sourceCount} source${s.sourceCount === 1 ? '' : 's'}`);
  box.appendChild(by);
  li.appendChild(box);
  return li;
}

/* ---------- page ---------- */
function renderStories(flashIds) {
  const root = $('stories');
  const all = [...data.stories, ...(data.more || [])];
  const pass = (s) => (!region || s.regions.includes(region));
  const nodes = [];

  if (topic === 'Top 10' ) {
    const top = data.stories.filter(pass);
    const [lead, ...others] = top;
    if (!top.length) nodes.push(el('p', 'empty', 'No top-10 stories are covered by outlets in that region right now.'));
    if (lead) nodes.push(storyEl(lead, 'lead', flashIds));
    if (others.length) {
      const pair = el('div', 'pair');
      others.slice(0, 2).forEach((s) => pair.appendChild(storyEl(s, 'second', flashIds)));
      nodes.push(pair);
      const ol = el('div');
      others.slice(2).forEach((s) => {
        const row = el('div', 'row');
        row.appendChild(el('div', 'num', String(s.rank)));
        row.appendChild(storyEl(s, 'row', flashIds));
        ol.appendChild(row);
      });
      nodes.push(ol);
    }
    const more = (data.more || []).filter(pass);
    if (more.length) {
      nodes.push(el('h2', 'section-h', 'Also in the news'));
      const ul = el('ul', 'compact');
      more.forEach((s) => ul.appendChild(compactEl(s)));
      nodes.push(ul);
    }
  } else {
    const list = all.filter((s) => (topic === 'World' || s.topic === topic) && pass(s));
    nodes.push(el('h2', 'section-h', `${topic}: where the ten leading stories and the next fifteen overlap`));
    if (!list.length) nodes.push(el('p', 'empty', `Nothing in ${topic} is among the top 25 stories right now.`));
    const ul = el('ul', 'compact');
    list.forEach((s) => ul.appendChild(compactEl(s)));
    nodes.push(ul);
  }
  root.replaceChildren(...nodes);
}

function renderTopics() {
  $('topics').replaceChildren(...TOPICS.map((t) => {
    const a = el('a', null, t);
    a.href = '#' + encodeURIComponent(t);
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
  $('events').replaceChildren(...(items.length ? items : [el('li', 'muted', 'No changes since this page opened.')]));
  $('sources').replaceChildren(...(data.sources || []).map((s) => el('li', s.ok ? '' : 'bad', s.name)));
}

function renderStatus() {
  const st = $('updated');
  const banner = $('banner');
  const ageMin = data.updatedAt ? (Date.now() - data.updatedAt) / 60000 : Infinity;
  st.className = 'status' + (ageMin < STALE_MIN ? ' live' : '');
  st.textContent = data.updatedAt ? `Updated ${clock(data.updatedAt)}${data.static ? '' : ' · live'}` : 'Waiting for the first update';
  let msg = '', warn = false;
  if (data.demo) msg = 'Demonstration mode: these headlines are fictional.';
  else if (data.error) { msg = `${data.error}. Showing the last stories we had.`; warn = true; }
  else if (ageMin > STALE_MIN) { msg = `This page was last refreshed ${Math.round(ageMin)} minutes ago, so it may be out of date. Updates may be delayed.`; warn = true; }
  banner.hidden = !msg;
  banner.className = 'banner' + (warn ? ' warn' : '');
  banner.textContent = msg;
}

function render(d, changes = []) {
  data = d;
  const entered = changes.filter((c) => c.type === 'entered');
  const fresh = (d.events || []).filter((e) => !changeLog.some((c) => c.at === e.at && c.id === e.id && c.type === e.type));
  if (lastIds === null) changeLog = (d.events || []).slice();
  else changeLog = [...fresh, ...changeLog].slice(0, 30);
  renderTopics(); renderRegions(); renderStatus(); renderRail();
  renderStories(new Set(entered.map((c) => c.id)));
  if (lastIds !== null && entered.length) notify(entered);
  lastIds = d.stories.map((s) => s.id);
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
  const s = data.stories.find((x) => x.id === entered[0].id);
  new Notification(`New in the top 10 at No. ${entered[0].rank}`, { body: entered[0].headline + (entered.length > 1 ? ` (+${entered.length - 1} more)` : ''), tag: 'top10news' });
  if (s) document.title = `(${entered.length}) Top10News`;
}

/* ---------- filters ---------- */
window.addEventListener('hashchange', () => { topic = decodeURIComponent(location.hash.slice(1)) || 'Top 10'; if (data) { renderTopics(); renderStories(new Set()); } });
$('region').addEventListener('change', (e) => { region = e.target.value; if (data) renderStories(new Set()); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = "Top10News — the world's ten biggest stories, ranked across newsrooms"; });

/* ---------- data ---------- */
async function pollStatic() {
  try {
    const d = await (await fetch('data/top10.json', { cache: 'no-store' })).json();
    const before = new Set(lastIds || []);
    const changes = lastIds ? d.stories.filter((s) => !before.has(s.id)).map((s) => ({ type: 'entered', id: s.id, headline: s.headline, rank: s.rank })) : [];
    render(d, changes);
  } catch { $('updated').textContent = 'Offline — retrying'; $('updated').className = 'status'; }
}
function connectSSE() {
  const es = new EventSource('events');
  es.addEventListener('hello', (e) => render(JSON.parse(e.data)));
  es.addEventListener('update', (e) => { const d = JSON.parse(e.data); render(d, d.changes); });
  es.onerror = () => { $('updated').textContent = 'Reconnecting…'; $('updated').className = 'status'; };
}
async function start() {
  $('today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  paintAlertButton();
  let hasServer = false;
  try { hasServer = !!window.EventSource && (await fetch('api/top10')).ok; } catch {}
  if (hasServer) connectSSE();
  else { pollStatic(); setInterval(pollStatic, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) pollStatic(); }); }
  setInterval(() => { if (data) renderStatus(); }, 60000);
}
start();
