import { describe, expect, it } from "vitest";
import { newEventSchema, summarizeEvent, toEventPayload } from "../src/events";

describe("newEventSchema", () => {
  it("defaults to a workout", () => {
    const event = newEventSchema.parse({ date: "2026-11-02", name: "Swim", type: "Swim" });

    expect(event.category).toBe("WORKOUT");
  });

  it("requires a sport for workouts but not for notes", () => {
    expect(newEventSchema.safeParse({ date: "2026-11-02", name: "Easy" }).success).toBe(false);
    expect(
      newEventSchema.safeParse({ date: "2026-11-02", name: "Rest", category: "NOTE" }).success,
    ).toBe(true);
  });

  it("rejects malformed dates", () => {
    expect(newEventSchema.safeParse({ date: "02.11.2026", name: "X", type: "Run" }).success).toBe(
      false,
    );
  });
});

describe("toEventPayload", () => {
  it("builds the local start and drops date and time", () => {
    const payload = toEventPayload({
      date: "2026-11-02",
      time: "06:30",
      name: "Swim",
      category: "WORKOUT",
      type: "Swim",
    });

    expect(payload).toEqual({
      start_date_local: "2026-11-02T06:30:00",
      name: "Swim",
      category: "WORKOUT",
      type: "Swim",
    });
  });

  it("sends only the patched fields", () => {
    expect(toEventPayload({ name: "New name" })).toEqual({ name: "New name" });
  });

  it("refuses a time without a date", () => {
    expect(() => toEventPayload({ time: "07:00" })).toThrow("requires the date");
  });
});

describe("summarizeEvent", () => {
  it("counts parsed steps and drops the raw document", () => {
    const summary = summarizeEvent({ id: 1, workout_doc: { steps: [{}, {}] } });

    expect(summary.parsed_steps).toBe(2);
    expect(summary).not.toHaveProperty("workout_doc");
  });

  it("reports zero steps when the text was not parsed", () => {
    expect(summarizeEvent({ id: 1, workout_doc: null }).parsed_steps).toBe(0);
  });
});
