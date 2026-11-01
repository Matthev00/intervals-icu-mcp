import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format");

const clockTime = z.string().regex(/^\d{2}:\d{2}$/, "Use the HH:MM format");

const EVENT_CATEGORIES = [
  "WORKOUT",
  "NOTE",
  "RACE_A",
  "RACE_B",
  "RACE_C",
  "HOLIDAY",
  "SICK",
  "INJURED",
] as const;

const eventFields = {
  time: clockTime.optional().describe("Local start time, HH:MM. Omit for an all-day entry."),
  description: z
    .string()
    .optional()
    .describe("Workout text in the Intervals.icu syntax, or free text for a note."),
  moving_time: z.number().int().positive().optional().describe("Planned duration in seconds."),
  distance: z.number().positive().optional().describe("Planned distance in meters."),
  icu_training_load: z.number().nonnegative().optional().describe("Planned training load."),
  target: z.enum(["AUTO", "POWER", "HR", "PACE"]).optional(),
  indoor: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
};

export const newEventSchema = z
  .object({
    date: isoDate.describe("Local date, YYYY-MM-DD."),
    name: z.string().min(1),
    category: z.enum(EVENT_CATEGORIES).default("WORKOUT"),
    type: z.string().optional().describe("Sport: Swim, Ride, Run, WeightTraining and so on."),
    external_id: z
      .string()
      .optional()
      .describe("Stable id. Sending it again updates the same event instead of duplicating it."),
    ...eventFields,
  })
  .refine((event) => event.category !== "WORKOUT" || event.type !== undefined, {
    message: "A WORKOUT needs a type",
    path: ["type"],
  });

export const eventPatchSchema = z.object({
  date: isoDate.optional().describe("New local date, YYYY-MM-DD."),
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  ...eventFields,
});

export type NewEvent = z.infer<typeof newEventSchema>;
export type EventPatch = z.infer<typeof eventPatchSchema>;

function localStart(date: string, time = "00:00"): string {
  return `${date}T${time}:00`;
}

export function toEventPayload(event: NewEvent | EventPatch): Record<string, unknown> {
  const { date, time, ...fields } = event;
  if (time !== undefined && date === undefined) {
    throw new Error("Changing the time also requires the date");
  }
  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  if (date !== undefined) {
    payload.start_date_local = localStart(date, time);
  }
  return payload;
}

interface WorkoutDoc {
  steps?: unknown[];
}

export function summarizeEvent(event: Record<string, unknown>): Record<string, unknown> {
  const workoutDoc = event.workout_doc as WorkoutDoc | undefined | null;
  return {
    id: event.id,
    external_id: event.external_id,
    start_date_local: event.start_date_local,
    category: event.category,
    type: event.type,
    name: event.name,
    description: event.description,
    moving_time: event.moving_time,
    distance: event.distance,
    icu_training_load: event.icu_training_load,
    tags: event.tags,
    parsed_steps: workoutDoc?.steps?.length ?? 0,
  };
}
