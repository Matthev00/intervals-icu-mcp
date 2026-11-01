import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  eventPatchSchema,
  isoDate,
  newEventSchema,
  summarizeEvent,
  toEventPayload,
} from "./events";
import { IntervalsClient } from "./intervals";

type ApiRecord = Record<string, unknown>;

const MAX_EVENTS_PER_CALL = 50;
const DEFAULT_ACTIVITY_LIMIT = 100;

const ATHLETE_FIELDS = ["id", "name", "sex", "timezone", "icu_weight", "icu_resting_hr"];
const SPORT_FIELDS = [
  "types",
  "ftp",
  "indoor_ftp",
  "w_prime",
  "lthr",
  "max_hr",
  "threshold_pace",
  "pace_units",
  "power_zones",
  "hr_zones",
  "pace_zones",
];
const ACTIVITY_SUMMARY_FIELDS = [
  "id",
  "start_date_local",
  "type",
  "name",
  "source",
  "moving_time",
  "distance",
  "total_elevation_gain",
  "average_heartrate",
  "icu_average_watts",
  "icu_weighted_avg_watts",
  "average_speed",
  "pace",
  "icu_training_load",
  "icu_intensity",
  "icu_rpe",
  "feel",
  "compliance",
  "paired_event_id",
];
const ACTIVITY_DETAIL_FIELDS = [
  ...ACTIVITY_SUMMARY_FIELDS,
  "description",
  "average_cadence",
  "max_heartrate",
  "decoupling",
  "icu_efficiency_factor",
  "icu_variability_index",
  "pool_length",
  "lengths",
  "trainer",
  "icu_zone_times",
  "icu_hr_zone_times",
  "pace_zone_times",
];
const INTERVAL_FIELDS = [
  "type",
  "label",
  "moving_time",
  "distance",
  "average_watts",
  "average_heartrate",
  "average_speed",
  "average_cadence",
  "intensity",
  "zone",
];
const WELLNESS_FIELDS = [
  "id",
  "ctl",
  "atl",
  "rampRate",
  "restingHR",
  "hrv",
  "sleepSecs",
  "sleepScore",
  "sleepQuality",
  "readiness",
  "fatigue",
  "soreness",
  "stress",
  "mood",
  "motivation",
  "injury",
  "weight",
  "comments",
];

const SERVER_INSTRUCTIONS = `Plans triathlon training on the athlete's Intervals.icu calendar.
Read get_athlete, list_activities, list_wellness and list_events before planning.
Use the ids from list_events when changing or deleting entries.`;

const WORKOUT_SYNTAX = `Workout text syntax for the description field:
Each step is a line starting with "- ": duration or distance, then a target.
Durations: 10m, 90s, 1h30m. "m" always means minutes.
Distances: 400mtr, 2km. Use "mtr" for meters.
Power: 75%, 95-105%, 220w, Z2. Heart rate: 70% HR, 95% LTHR, Z2 HR.
Pace: 80% Pace, Z2 Pace, 1:45/100m Pace, 4:30/km Pace.
Ramps: 10m ramp 50%-75%. Free ride: 20m freeride. Cadence: 10m 75% 90rpm.
Text before the duration is a cue: "- Warmup 10m 60%".
Repeats: a line such as "Main set 4x" or "5x" followed by steps, with a blank line before and after. Repeats cannot be nested.
Use a single target family (power, HR or pace) per workout.
Check parsed_steps in the result: 0 means the text was stored but not parsed into steps.`;

export function pick(source: ApiRecord, fields: readonly string[]): ApiRecord {
  return Object.fromEntries(
    fields.filter((field) => field in source).map((field) => [field, source[field]]),
  );
}

export function todayIn(timezone: string | undefined, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function respond(action: () => Promise<unknown>) {
  try {
    const result = await action();
    return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { ok: true }) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }
}

export function createServer(client: IntervalsClient): McpServer {
  const server = new McpServer(
    { name: "intervals-icu", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "get_athlete",
    {
      description:
        "Get today's date in the athlete's timezone, plus the athlete's thresholds and zones per sport. threshold_pace is in meters per second.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () =>
      respond(async () => {
        const athlete = await client.request<ApiRecord>("GET", client.athletePath());
        const sports = (athlete.sportSettings ?? []) as ApiRecord[];
        return {
          today: todayIn(athlete.timezone as string | undefined),
          ...pick(athlete, ATHLETE_FIELDS),
          sports: sports.map((sport) => pick(sport, SPORT_FIELDS)),
        };
      }),
  );

  server.registerTool(
    "list_activities",
    {
      description:
        "List completed activities in a date range, newest first. compliance and paired_event_id link an activity to its planned workout.",
      inputSchema: z.object({
        oldest: isoDate,
        newest: isoDate.optional(),
        limit: z.number().int().positive().max(500).default(DEFAULT_ACTIVITY_LIMIT),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ oldest, newest, limit }) =>
      respond(() =>
        client.request("GET", client.athletePath("/activities"), {
          query: { oldest, newest, limit, fields: ACTIVITY_SUMMARY_FIELDS.join(",") },
        }),
      ),
  );

  server.registerTool(
    "get_activity",
    {
      description: "Get one completed activity, optionally with its intervals.",
      inputSchema: z.object({
        activity_id: z.string().min(1),
        include_intervals: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ activity_id, include_intervals }) =>
      respond(async () => {
        const path = `/activity/${encodeURIComponent(activity_id)}`;
        const activity = await client.request<ApiRecord>("GET", path);
        const details = pick(activity, ACTIVITY_DETAIL_FIELDS);
        if (!include_intervals) {
          return details;
        }
        const intervals = await client.request<ApiRecord>("GET", `${path}/intervals`);
        const rows = (intervals.icu_intervals ?? []) as ApiRecord[];
        return { ...details, intervals: rows.map((row) => pick(row, INTERVAL_FIELDS)) };
      }),
  );

  server.registerTool(
    "list_wellness",
    {
      description:
        "List daily wellness records: fitness (ctl), fatigue (atl), ramp rate, HRV, resting HR, sleep and subjective scores.",
      inputSchema: z.object({ oldest: isoDate, newest: isoDate }),
      annotations: { readOnlyHint: true },
    },
    async ({ oldest, newest }) =>
      respond(() =>
        client.request("GET", client.athletePath("/wellness"), {
          query: { oldest, newest, fields: WELLNESS_FIELDS.join(",") },
        }),
      ),
  );

  server.registerTool(
    "list_events",
    {
      description: "List calendar entries in a date range: planned workouts, races, notes.",
      inputSchema: z.object({
        oldest: isoDate,
        newest: isoDate,
        categories: z
          .array(z.string())
          .optional()
          .describe("Filter such as WORKOUT, NOTE, RACE_A, RACE_B, RACE_C."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ oldest, newest, categories }) =>
      respond(async () => {
        const events = await client.request<ApiRecord[]>("GET", client.athletePath("/events"), {
          query: { oldest, newest, category: categories?.join(",") },
        });
        return events.map(summarizeEvent);
      }),
  );

  server.registerTool(
    "create_events",
    {
      description: `Create calendar entries, usually a whole week at once.\n\n${WORKOUT_SYNTAX}`,
      inputSchema: z.object({
        events: z.array(newEventSchema).min(1).max(MAX_EVENTS_PER_CALL),
      }),
      annotations: { idempotentHint: false },
    },
    async ({ events }) =>
      respond(async () => {
        const upsert = events.some((event) => event.external_id !== undefined);
        const created = await client.request<ApiRecord[]>(
          "POST",
          client.athletePath("/events/bulk"),
          {
            query: { upsert, upsertOnUid: false, updatePlanApplied: false },
            body: events.map(toEventPayload),
          },
        );
        return created.map(summarizeEvent);
      }),
  );

  server.registerTool(
    "update_event",
    {
      description: `Change a calendar entry. Only the fields you send are changed.\n\n${WORKOUT_SYNTAX}`,
      inputSchema: z.object({
        event_id: z.number().int().positive(),
        ...eventPatchSchema.shape,
      }),
      annotations: { idempotentHint: true },
    },
    async ({ event_id, ...patch }) =>
      respond(async () => {
        const payload = toEventPayload(patch);
        if (Object.keys(payload).length === 0) {
          throw new Error("Nothing to update");
        }
        const updated = await client.request<ApiRecord>(
          "PUT",
          client.athletePath(`/events/${event_id}`),
          { body: payload },
        );
        return summarizeEvent(updated);
      }),
  );

  server.registerTool(
    "delete_events",
    {
      description: "Delete calendar entries by id. Take the ids from list_events.",
      inputSchema: z.object({
        event_ids: z.array(z.number().int().positive()).min(1).max(MAX_EVENTS_PER_CALL),
      }),
      annotations: { destructiveHint: true },
    },
    async ({ event_ids }) =>
      respond(() =>
        client.request("PUT", client.athletePath("/events/bulk-delete"), {
          body: event_ids.map((id) => ({ id })),
        }),
      ),
  );

  return server;
}
