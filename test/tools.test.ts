import { describe, expect, it } from "vitest";
import { pick, todayIn } from "../src/tools";

describe("pick", () => {
  it("keeps the listed fields that exist", () => {
    expect(pick({ a: 1, b: 2 }, ["a", "c"])).toEqual({ a: 1 });
  });
});

describe("todayIn", () => {
  const lateEvening = new Date("2026-11-01T23:30:00Z");

  it("uses the athlete's timezone", () => {
    expect(todayIn("Europe/Warsaw", lateEvening)).toBe("2026-11-02");
  });

  it("falls back to UTC", () => {
    expect(todayIn(undefined, lateEvening)).toBe("2026-11-01");
  });
});
