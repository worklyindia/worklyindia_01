import { expect, test } from "bun:test";
import { matchesConfirmation } from "./typedConfirmation";
for (const phrase of ["Auto-pay Cancel", "Auto-Top-Up Cancel"]) {
  test(`${phrase} requires its full action-specific phrase`, () => {
    expect(matchesConfirmation("", phrase)).toBe(false);
    expect(matchesConfirmation("Cancel", phrase)).toBe(false);
    expect(matchesConfirmation(phrase === "Auto-pay Cancel" ? "Auto-Top-Up Cancel" : "Auto-pay Cancel", phrase)).toBe(false);
    expect(matchesConfirmation(` ${phrase.toLowerCase()} `, phrase)).toBe(true);
  });
}
