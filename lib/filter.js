'use strict';

// Sections that are not hard news. Matched against the article URL (direct feeds only).
const NON_NEWS_URL = /\/(opinions?|commentisfree|editorials?|columnists?|sports?|football|soccer|cricket|rugby|tennis|golf|culture|lifestyle|life-and-style|travel|style|food|fashion|games|puzzles|crosswords?|newsletters?|podcasts?|wellness|real-estate|arts|books|film|music|tv-and-radio|obituaries|cartoons|letters|reviews|quiz)\//i;
// Formats that are not stories.
const NON_NEWS_TITLE = /^(opinion|editorial|analysis|review|quiz|crossword|podcast|newsletter|video|watch|listen|photos?|pictures?|in pictures|cartoon|letters?)\s*[:|–—-]\s|\b(horoscope|wordle|crossword|recipe)s?\b/i;

// "Live: X", "X – live", "X | Live updates" → "X"
function cleanTitle(title, source) {
  let t = title.replace(/\s+/g, ' ').trim();
  t = t.replace(/^(live|live updates|breaking|just in|latest)\s*[:|–—-]\s*/i, '');
  t = t.replace(/\s*[–—|-]\s*(live( updates| blog| coverage)?|as it happened)\s*$/i, '');
  // Google News appends " - Publisher".
  if (source.approx) t = t.replace(/\s+[-–—]\s+[^-–—]{2,40}$/, '');
  return t.trim();
}

/** Returns a cleaned item, or null if it should not take part in the ranking. */
function normalize(item, source) {
  const title = cleanTitle(item.title, source);
  if (title.length < 15) return null;
  if (NON_NEWS_TITLE.test(item.title)) return null;
  if (!source.approx && NON_NEWS_URL.test(item.link)) return null;
  // Google News descriptions are lists of related links, not a standfirst.
  return { ...item, title, summary: source.approx ? '' : item.summary };
}

module.exports = { normalize, cleanTitle };
