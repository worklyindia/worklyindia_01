import { expect, test } from "bun:test";
import { buildAffiliateUrl, domainPurchaseMode } from "./affiliate";

test("selling off without a link locks domain purchases", () => {
  expect(domainPurchaseMode(false, "")).toBe("locked");
  expect(domainPurchaseMode(false, "   ")).toBe("locked");
});

test("selling off with a link opens the configured affiliate destination", () => {
  expect(domainPurchaseMode(false, "https://example.com/{domain}")).toBe("affiliate");
  expect(buildAffiliateUrl("https://example.com/{domain}", "workly.in")).toBe("https://example.com/workly.in");
});

test("selling on retains normal checkout even with an affiliate link", () => {
  expect(domainPurchaseMode(true, "https://example.com")).toBe("cart");
});

test("unavailable storefront settings cannot enable checkout", () => {
  expect(domainPurchaseMode(null, "https://example.com")).toBe("locked");
});