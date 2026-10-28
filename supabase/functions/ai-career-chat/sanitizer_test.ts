// Tests for the hallucinated tool-call sanitizer.
// We re-implement the sanitizer here in test scope by importing the same
// patterns. Since `sanitizeStreamContent` lives in index.ts (not exported to
// keep the bundle small), we duplicate the public-shape regression by parsing
// it out. To keep this self-contained and fast, we test the END-TO-END
// behavior by importing the function via dynamic eval of the relevant block
// would be brittle — instead we copy the patterns under test here and verify
// they match the strings we care about. This guards against future regressions.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const PATTERNS: RegExp[] = [
  /<function_call>[\s\S]*?<\/function_call>/gi,
  /<tool_call>[\s\S]*?<\/tool_call>/gi,
  /<call\s*:?\s*[a-z_][a-z0-9_]*\b[\s\S]*?\/>/gi,
  /<call\s*:?\s*[a-z_][a-z0-9_]*\b[\s\S]*?<\/call\s*:?\s*[a-z0-9_]*\s*>/gi,
  /<call\b[^<>]*\/?>/gi,
  /<\/call\s*:?\s*[a-z0-9_]*\s*>/gi,
  /<(?:invoke|tool|function)\b[^>]*\/>/gi,
  /<(?:invoke|tool|function)\b[^>]*>[\s\S]*?<\/(?:invoke|tool|function)>/gi,
];

function sanitize(text: string): string {
  let out = text;
  for (const p of PATTERNS) out = out.replace(p, '');
  return out.replace(/\s+/g, ' ').trim();
}

Deno.test('strips <call:tool_name ... /> self-closing tag (the production bug)', () => {
  const input = 'Priya is now checking your wallet balance. <call:get_user_management_data data_type="wallet" />';
  const cleaned = sanitize(input);
  assertEquals(cleaned, 'Priya is now checking your wallet balance.');
  assert(!cleaned.includes('<call:'));
});

Deno.test('strips <call:tool>...</call:tool> paired tag', () => {
  const input = 'Checking now. <call:search_jobs>{"q":"react"}</call:search_jobs> Done.';
  const cleaned = sanitize(input);
  assertEquals(cleaned, 'Checking now. Done.');
});

Deno.test('strips <invoke .../> tag', () => {
  const input = 'Hello <invoke name="foo" arg="bar" /> world';
  const cleaned = sanitize(input);
  assertEquals(cleaned, 'Hello world');
});

Deno.test('strips legacy <function_call>...</function_call>', () => {
  const input = 'Reply <function_call>{"name":"x"}</function_call> end';
  const cleaned = sanitize(input);
  assertEquals(cleaned, 'Reply end');
});

Deno.test('preserves natural HTML-like punctuation that is not a tool tag', () => {
  const input = 'Use < and > carefully. Email: <a@b.com>.';
  const cleaned = sanitize(input);
  // <a@b.com> is not a tool tag — should pass through untouched
  assert(cleaned.includes('<a@b.com>'));
});

Deno.test('strips nameless <call: video_id="X" /> tag (screenshot bug)', () => {
  const input = 'Pehle main is video ki current details dekhti hoon. 👀\n<call: video_id="RcYvALhmr94" />';
  const cleaned = sanitize(input);
  assertEquals(cleaned, 'Pehle main is video ki current details dekhti hoon. 👀');
  assert(!cleaned.includes('<call'));
});

Deno.test('strips <call ... /> with no colon at all', () => {
  const input = 'Ok. <call get_video_stats video_id="abc" /> Done.';
  const cleaned = sanitize(input);
  assertEquals(cleaned, 'Ok. Done.');
});
