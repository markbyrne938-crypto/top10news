'use strict';

// Rough keyword topics, first match wins. Good enough to browse by, not to rely on.
const TOPICS = [
  ['Disasters', /\b(earthquake|quake|tsunami|flood\w*|wildfires?|hurricane|typhoon|cyclone|landslides?|eruption|volcano|storm|evacuat\w+|death toll)\b/i],
  ['Health', /\b(health|virus|outbreak|vaccin\w+|disease|cholera|covid|hospitals?|cancer|measles|pandemic|epidemic)\b/i],
  ['Conflict', /\b(war|missiles?|troops|ceasefire|attacks?|military|army|drones?|bomb\w*|shelling|hostages?|invasion|rebels?|militants?|airstrikes?|terror\w*|gaza|ukraine)\b/i],
  ['Politics', /\b(election|vote[sd]?|voters?|polls?|parliament|president\w*|prime minister|minister|government|senate|congress|lawmakers|court|trial|sanctions?|talks|summit|diplomat\w*|treaty|envoy|protests?)\b/i],
  ['Business', /\b(econom\w+|inflation|interest rates?|central bank|markets?|stocks?|shares|oil|trade|tariffs?|banks?|gdp|jobs|unemployment|profit|merger|earnings|prices?|strike)\b/i],
  ['Technology', /\b(tech\w*|ai|artificial intelligence|chips?|software|quantum|cyber\w*|hack\w*|data breach|robots?|satellite|google|apple|microsoft|openai|tesla)\b/i],
  ['Science & climate', /\b(scientists?|research\w*|study|species|climate|emissions|nasa|space|planet|discover\w+|warming|carbon|fossil)\b/i],
];

function classify(text) {
  for (const [name, re] of TOPICS) if (re.test(text)) return name;
  return 'World';
}

module.exports = { classify, TOPIC_NAMES: ['World', ...TOPICS.map((t) => t[0])] };
