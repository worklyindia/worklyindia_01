import { expect, test } from 'bun:test';
import { jobPreloadDistance, shouldLoadJobPage } from './jobScrollPreload';

test('loads upcoming jobs before mobile readers reach the end', () => {
  const distance = jobPreloadDistance(639);
  expect(shouldLoadJobPage(7000, 639, 10000, distance)).toBe(true);
  expect(shouldLoadJobPage(1000, 639, 10000, distance)).toBe(false);
});
test('fast scrolling starts earlier with a bounded lookahead', () => {
  expect(jobPreloadDistance(639, 300, 2)).toBeGreaterThan(jobPreloadDistance(639));
  expect(jobPreloadDistance(639, 300, 100)).toBe(8000);
});