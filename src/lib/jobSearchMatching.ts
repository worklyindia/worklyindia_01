export const normalizeJobSearch = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

interface SearchableJob {
  title?: string;
  company_name?: string;
  company?: string;
  skills?: string[];
  category?: string;
  location?: string;
  description?: string;
  snippet?: string;
}

// Words people add to almost every search ("typing jobs", "jobs in surat",
// "naukri for freshers") that never appear in a job's own fields. Requiring
// them hid every result, so they are ignored when matching.
const FILLER_WORDS = new Set([
  'job', 'jobs', 'naukri', 'naukriya', 'vacancy', 'vacancies', 'opening', 'openings',
  'hiring', 'requirement', 'required', 'wanted', 'work', 'kaam',
  'in', 'at', 'for', 'near', 'me', 'the', 'a', 'an', 'and', 'of', 'ke', 'ki', 'ka', 'mein', 'me',
]);

// Phrases that mean the same thing in job posts.
const PHRASE_GROUPS: string[][] = [
  ['work from home', 'wfh', 'remote', 'home based', 'online', 'from home'],
  ['part time', 'parttime', 'part timer'],
  ['full time', 'fulltime'],
  ['tele caller', 'telecaller', 'telecalling', 'tele calling', 'telesales'],
  ['data entry', 'dataentry', 'typing', 'typist'],
];

const singular = (word: string) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

const wordMatches = (text: string, word: string) => text.includes(word) || text.includes(singular(word));

/**
 * Splits a search into required terms. Known phrases become one term with
 * their synonyms; filler words are dropped. Each term is a list of
 * alternatives — any one of them may match.
 */
export const jobSearchTerms = (query: string): string[][] => {
  let rest = ` ${normalizeJobSearch(query)} `;
  const terms: string[][] = [];
  for (const group of PHRASE_GROUPS) {
    for (const phrase of group) {
      if (rest.includes(` ${phrase} `)) {
        terms.push(group);
        rest = rest.replace(` ${phrase} `, ' ');
        break;
      }
    }
  }
  rest.split(' ').filter(Boolean).forEach((word) => {
    if (!FILLER_WORDS.has(word)) terms.push([word]);
  });
  return terms;
};

export const matchesJobSearch = (job: SearchableJob, query: string): boolean => {
  const terms = jobSearchTerms(query);
  if (terms.length === 0) return true;
  const text = ` ${normalizeJobSearch([
    job.title, job.company_name, job.company, job.category, job.location,
    ...(job.skills || []), job.description, job.snippet,
  ].filter(Boolean).join(' '))} `;
  return terms.every((alternatives) => alternatives.some((alt) => wordMatches(text, alt)));
};

/**
 * Relevance score for a job against a search. Each search term that appears
 * in the job adds points — title and company matches count the most, so a
 * "Kotak Mahindra Bank" search ranks Kotak jobs above jobs that only happen
 * to mention "bank" in the description. A score of 0 means the job has
 * nothing to do with the search.
 */
export const jobSearchScore = (job: SearchableJob, query: string): number => {
  const terms = jobSearchTerms(query);
  if (terms.length === 0) return 1;
  const norm = (value?: string) => ` ${normalizeJobSearch(value || '')} `;
  const title = norm(job.title);
  const company = norm(`${job.company_name || ''} ${job.company || ''}`);
  const category = norm(`${job.category || ''} ${(job.skills || []).join(' ')}`);
  const rest = norm(`${job.location || ''} ${job.description || ''} ${job.snippet || ''}`);
  let score = 0;
  for (const alternatives of terms) {
    const hit = (text: string) => alternatives.some((alt) => wordMatches(text, alt));
    if (hit(title)) score += 4;
    else if (hit(company)) score += 3;
    else if (hit(category)) score += 2;
    else if (hit(rest)) score += 1;
  }
  return score;
};

/**
 * Keeps only the jobs that actually match the search, best matches first.
 * "Kotak Mahindra Bank" shows Kotak/banking jobs and hides unrelated ones
 * like "Call Center Executive". If nothing matches at all, the original
 * list is returned so the page never goes blank.
 */
export const filterJobsBySearch = <T extends SearchableJob>(jobs: T[], query: string): T[] => {
  if (!query.trim()) return jobs;
  const scored = jobs.map((job) => ({ job, score: jobSearchScore(job, query) }));
  const matching = scored.filter((entry) => entry.score > 0);
  if (matching.length === 0) return jobs;
  return matching.sort((a, b) => b.score - a.score).map((entry) => entry.job);
};

/**
 * Long suggestion titles like "Premier Relationship Manager_Digital Banking
 * Kotak 811-Sales_Pune" match nothing when sent verbatim — underscores and
 * numeric IDs are not real words. Simplify to the meaningful words so the
 * search still returns results.
 */
export const simplifySearchQuery = (query: string): string => {
  const words = normalizeJobSearch(query)
    .split(' ')
    .filter(Boolean)
    .filter((word) => !/\d/.test(word)); // drop numeric IDs like 811, 0412
  if (words.length <= 5) return words.join(' ');
  return words.slice(0, 5).join(' ');
};

export const mergeSearchSuggestions = <T extends { suggestion: string }>(items: T[], query: string, limit = 6): T[] => {
  const words = normalizeJobSearch(query).split(' ').filter(Boolean);
  const seen = new Set<string>();
  return items.filter(item => {
    const key = normalizeJobSearch(item.suggestion);
    if (seen.has(key) || !words.every(word => key.includes(word))) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
};
