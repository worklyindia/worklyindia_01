import { describe, expect, it } from "vitest";
import { sortNewestFirst } from "./storageSort";

type Item = { name: string; at: string | null };
const sort = (items: Item[]) => sortNewestFirst(items, (i) => i.at, (i) => i.name).map((i) => i.name);

describe("sortNewestFirst", () => {
  it("puts the newest upload date on top and the oldest at the bottom", () => {
    expect(sort([
      { name: "old", at: "2026-10-01T10:00:00Z" },
      { name: "new", at: "2026-10-20T10:00:00Z" },
      { name: "mid", at: "2026-10-10T10:00:00Z" },
    ])).toEqual(["new", "mid", "old"]);
  });

  it("orders the same date by time, later time first", () => {
    expect(sort([
      { name: "morning", at: "2026-10-20T08:00:00Z" },
      { name: "evening", at: "2026-10-20T18:30:00Z" },
    ])).toEqual(["evening", "morning"]);
  });

  it("keeps items without a date at the bottom", () => {
    expect(sort([
      { name: "nodate", at: null },
      { name: "dated", at: "2026-10-20T08:00:00Z" },
    ])).toEqual(["dated", "nodate"]);
  });
});
