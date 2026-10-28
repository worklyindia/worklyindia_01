import { describe, it, expect } from "vitest";
import { ROUTE_SEO } from "../routeSeo";
describe("route SEO", () => {
  const e = Object.values(ROUTE_SEO);
  it("every page has a unique title", () => expect(new Set(e.map(x => x.title)).size).toBe(e.length));
  it("every page has a unique description", () => expect(new Set(e.map(x => x.description)).size).toBe(e.length));
  it("covers requested pages", () => ["/about-us","/referral","/resume-builder","/auth","/employer-auth","/developers","/developers/faq","/faq","/api-docs/quick-start","/jobs","/ai-assistant","/post-job","/careers","/press-kit"].forEach(p => expect(ROUTE_SEO[p]).toBeTruthy()));
});
