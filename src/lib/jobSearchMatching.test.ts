import { expect, test } from 'bun:test';
import { filterJobsBySearch, jobSearchScore, matchesJobSearch, mergeSearchSuggestions, simplifySearchQuery } from './jobSearchMatching';

test('long suggestion titles simplify to searchable words', () => {
  expect(simplifySearchQuery('Premier Relationship Manager_Digital Banking Kotak 811-Sales_Pune'))
    .toBe('premier relationship manager digital banking');
  expect(simplifySearchQuery('Sales Manager_Personal Loan_0412_8473_1029736')).toBe('sales manager personal loan');
  expect(simplifySearchQuery('Kotak')).toBe('kotak');
  expect(simplifySearchQuery('data entry')).toBe('data entry');
});

test('Haldwani Hdfc Hiring Sales Officer excludes unrelated website jobs', () => {
  const query = 'Haldwani Hdfc Hiring Sales Officer';
  expect(matchesJobSearch({ title: 'Customer Support Executive', company_name: 'Workly India', category: 'Customer Service' }, query)).toBe(false);
  expect(matchesJobSearch({ title: query, company: 'Hire Hub Hiring Solutions' }, query)).toBe(true);
});
test('Kotak matches title or company but not unrelated promoted jobs', () => {
  expect(matchesJobSearch({ title: 'Customer Support Executive', company_name: 'Workly India' }, 'Kotak')).toBe(false);
  expect(matchesJobSearch({ title: 'Data Scientist', company: 'Kotak Mahindra Bank' }, 'Kotak')).toBe(true);
  expect(matchesJobSearch({ title: 'KOTAK – OUTBOUND SALES' }, 'Kotak')).toBe(true);
});
test('suggestions match current typing and are deduplicated', () => {
  expect(mergeSearchSuggestions([{ suggestion: 'Kotak Sales' }, { suggestion: 'KOTAK Sales' }, { suggestion: 'Hdfc Sales' }], 'Kotak')).toEqual([{ suggestion: 'Kotak Sales' }]);
});
test('"jobs" in the search does not hide every result', () => {
  expect(matchesJobSearch({ title: 'Typing Assistant', company: 'Acme' }, 'typing jobs')).toBe(true);
  expect(matchesJobSearch({ title: 'Telecaller', location: 'Surat, Gujarat' }, 'telecaller jobs in surat')).toBe(true);
});
test('typing search finds data entry jobs', () => {
  expect(matchesJobSearch({ title: 'Data Entry Operator' }, 'typing jobs')).toBe(true);
  expect(matchesJobSearch({ title: 'Senior Software Engineer' }, 'typing jobs')).toBe(false);
});
test('work from home search finds remote jobs', () => {
  expect(matchesJobSearch({ title: 'Remote Chat Support' }, 'work from home')).toBe(true);
  expect(matchesJobSearch({ title: 'Merchandiser - Home Textiles' }, 'work from home')).toBe(false);
});
test('a word only in the job description still matches', () => {
  expect(matchesJobSearch({ title: 'Operations Coordinator', description: 'Handle data entry in Excel' }, 'data entry')).toBe(true);
});

test('Kotak Mahindra Bank search ranks Kotak jobs first and hides unrelated jobs', () => {
  const jobs = [
    { title: 'Call Center Executive', company_name: 'Workly India', category: 'Customer Service' },
    { title: 'Officer, Virtual Relationship Manager, Consumer Banking Group', company: 'DBS Bank Ltd' },
    { title: 'Sales Officer', company: 'Kotak Mahindra Bank' },
  ];
  const result = filterJobsBySearch(jobs, 'Kotak Mahindra Bank');
  expect(result[0].title).toBe('Sales Officer');
  expect(result.some((j) => j.title === 'Call Center Executive')).toBe(false);
  expect(result.some((j) => j.company === 'DBS Bank Ltd')).toBe(true);
});

test('title match scores above description-only match', () => {
  const titleHit = jobSearchScore({ title: 'Kotak Sales Officer' }, 'kotak');
  const descHit = jobSearchScore({ title: 'Sales Officer', description: 'Worked at Kotak earlier' }, 'kotak');
  const noHit = jobSearchScore({ title: 'Chef', company: 'Hotel Grand' }, 'kotak');
  expect(titleHit).toBeGreaterThan(descHit);
  expect(descHit).toBeGreaterThan(0);
  expect(noHit).toBe(0);
});

test('when nothing matches the search, original jobs are kept so the page is never blank', () => {
  const jobs = [{ title: 'Call Center Executive' }, { title: 'Delivery Partner' }];
  expect(filterJobsBySearch(jobs, 'xyznotfound')).toEqual(jobs);
});

test('empty search returns jobs untouched', () => {
  const jobs = [{ title: 'Call Center Executive' }];
  expect(filterJobsBySearch(jobs, '')).toEqual(jobs);
});