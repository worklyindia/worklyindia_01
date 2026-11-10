// Detects "search the internet for me" intent in the user's message.
// Used to force ONE-SHOT search behaviour: no "dhoondh rahi hoon..." bubbles,
// just a single final reply that contains the actual search results.

const SEARCH_RE =
  /\b(google|search|searching|khoj|khojo|dhundh|dhoondh|dhundho|internet|web|online|browse|link\s*de|link\s*do|website|site|news|khabar|samachar|latest|current|price|rate|score|result\s*date|kya\s*hai|kaun\s*hai|kahan\s*hai|batao\s*net\s*se|image\s*de|photo\s*de|logo\s*de|wallpaper|near\s*me|address|contact\s*number)\b|गूगल|खोज|ढूंढ|ढूँढ|इंटरनेट|खबर|समाचार|ताज़ा|कीमत|पता\s*करो/i;

export function isWebSearchQuery(text: string): boolean {
  return SEARCH_RE.test(text || "");
}
