import { describe, expect, it } from "vitest";
import { isTurnstileHostAllowed, parseDomains } from "./turnstileDomain";

describe("Turnstile shows only on the owner's saved domain", () => {
  const saved = parseDomains("https://worklyindia.com/");

  it("shows on the saved domain", () => {
    expect(isTurnstileHostAllowed("worklyindia.com", saved)).toBe(true);
  });

  it("shows on www of the saved domain", () => {
    expect(isTurnstileHostAllowed("www.worklyindia.com", saved)).toBe(true);
  });

  it("hides on any other domain", () => {
    expect(isTurnstileHostAllowed("id-preview--abc.lovable.app", saved)).toBe(false);
    expect(isTurnstileHostAllowed("worklyindia.com.evil.net", saved)).toBe(false);
  });

  it("accepts several saved domains", () => {
    const many = parseDomains("worklyindia.com, other.in");
    expect(isTurnstileHostAllowed("other.in", many)).toBe(true);
  });

  it("keeps showing everywhere when no domain is saved", () => {
    expect(isTurnstileHostAllowed("anything.app", parseDomains(""))).toBe(true);
  });
});
