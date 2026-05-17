// Lightweight regex classifier — maps a Wikipedia article's short
// description (e.g. "Species of moth", "1973 film", "American basketball
// player") to the curated topic list shared with the mobile app's
// Settings → Topics. Stores result in `articles.categories` so the For
// You feed and card chips can use it.
//
// This is intentionally simple — a full taxonomy needs Wikidata lookups,
// which is real work. The description field hits ~80% of articles with
// a meaningful classification; everything else falls through to [].

const RULES: Array<{ topic: string; pattern: RegExp }> = [
  // Order matters loosely — more specific patterns first so e.g.
  // "rock band" matches Music, not Geography (rock formation).
  { topic: 'Music', pattern: /\b(band|musician|composer|singer|songwriter|album|song|jazz|orchestra|opera|rapper|rock band|dj )/i },
  { topic: 'Film', pattern: /\b(film|movie|director|actor|actress|cinematograph|screenwriter|tv series|television series|cartoon|anime)/i },
  { topic: 'Sports', pattern: /\b(footballer|basketball|baseball|tennis|golfer|swimmer|boxer|wrestler|athlete|olympic|cricket|hockey|cyclist|sailor|sport|rugby)/i },
  { topic: 'Nature', pattern: /\b(moth|bird|species of|plant|tree|fish|insect|animal|reptile|mammal|fungi|fungus|flower|forest|jungle|wildlife|wetland)/i },
  { topic: 'Geography', pattern: /\b(city in|town in|village in|river|lake|mountain|island|country|county|valley|desert|peninsula|capital of|province of|state in|region of|district)/i },
  { topic: 'History', pattern: /\b(historian|empire|kingdom|dynasty|ancient|medieval|battle of|war|revolution|treaty|monarch|emperor|pharaoh|caliphate|crusade|colonial)/i },
  { topic: 'Science', pattern: /\b(physicist|chemist|biologist|astronomer|geologist|mathematician|scientist|theorem|equation|particle|element|enzyme|gene|protein|virus)/i },
  { topic: 'Technology', pattern: /\b(software|programming|computer|operating system|internet|protocol|algorithm|database|cryptograph|hardware|smartphone|robot|engineer)/i },
  { topic: 'Art', pattern: /\b(painter|sculptor|illustrator|art movement|painting|sculpture|museum|gallery|art collective|architect of)/i },
  { topic: 'Literature', pattern: /\b(novelist|poet|writer|playwright|novel|poem|book|essay|literary|literature)/i },
  { topic: 'Politics', pattern: /\b(politician|senator|president of|prime minister|governor|congresswoman|congressman|mayor of|diplomat|parliament|political party)/i },
  { topic: 'Philosophy', pattern: /\b(philosopher|philosophy|epistemolog|metaphysic|ethic|logic)/i },
  { topic: 'Religion', pattern: /\b(religion|theolog|monk|priest|bishop|pope|rabbi|imam|buddhist|hindu|christian|muslim|jewish|sikh|saint|sacred)/i },
  { topic: 'Food', pattern: /\b(dish|cuisine|chef|recipe|food|beverage|cocktail|wine|beer|coffee|tea|bread|pastry|cheese|fruit|vegetable)/i },
  { topic: 'Architecture', pattern: /\b(architect|architecture|building|skyscraper|cathedral|temple|palace|fortress|bridge|tower of|monument)/i },
  { topic: 'Mathematics', pattern: /\b(mathematician|theorem|conjecture|topolog|algebra|geometry|calculus|number theory)/i },
  { topic: 'Medicine', pattern: /\b(physician|surgeon|disease|syndrome|virus|vaccine|treatment|cancer|surgery|epidemic|hospital)/i },
  { topic: 'Space', pattern: /\b(asteroid|comet|galaxy|planet|moon of|nebula|star system|exoplanet|telescope|astronaut|cosmonaut|spacecraft|mission to)/i },
];

export function classifyTopics(description: string | null | undefined): string[] {
  if (!description) return [];
  const matched = new Set<string>();
  for (const rule of RULES) {
    if (rule.pattern.test(description)) matched.add(rule.topic);
  }
  return [...matched];
}
