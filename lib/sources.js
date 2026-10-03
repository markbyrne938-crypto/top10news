'use strict';

// Google News RSS restricted to one publisher. Used for outlets that no
// longer publish an official RSS feed (Reuters, AP) or whose content is
// syndicated (AFP). Order here is Google's ranking, not the outlet's own
// homepage order, so these are flagged `approx`.
const googleNews = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:1d')}&hl=en-US&gl=US&ceid=US:en`;

// weight: how much a source's ranking counts toward a story's score.
// Wire services get the most weight; they are the primary sources.
const SOURCES = [
  { id: 'reuters', region: 'UK', name: 'Reuters', kind: 'wire', weight: 1.5, approx: true, url: googleNews('site:reuters.com') },
  { id: 'ap', region: 'US', name: 'Associated Press', kind: 'wire', weight: 1.5, approx: true, url: googleNews('site:apnews.com') },
  { id: 'afp', region: 'Europe', name: 'AFP', kind: 'wire', weight: 1.5, approx: true, url: googleNews('"(AFP)"') },
  { id: 'bbc', region: 'UK', name: 'BBC News', kind: 'outlet', weight: 1.0, url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'nyt', region: 'US', name: 'The New York Times', kind: 'outlet', weight: 1.0, url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { id: 'wapo', region: 'US', name: 'The Washington Post', kind: 'outlet', weight: 1.0, url: 'https://feeds.washingtonpost.com/rss/world' },
  { id: 'guardian', region: 'UK', name: 'The Guardian', kind: 'outlet', weight: 1.0, url: 'https://www.theguardian.com/world/rss' },
  { id: 'aljazeera', region: 'Middle East', name: 'Al Jazeera', kind: 'outlet', weight: 1.0, url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'npr', region: 'US', name: 'NPR', kind: 'outlet', weight: 0.8, url: 'https://feeds.npr.org/1001/rss.xml' },
  { id: 'dw', region: 'Europe', name: 'Deutsche Welle', kind: 'outlet', weight: 0.8, url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'france24', region: 'Europe', name: 'France 24', kind: 'outlet', weight: 0.8, url: 'https://www.france24.com/en/rss' },
];

module.exports = { SOURCES };
