import { afterEach, describe, expect, it, vi } from "vitest";
import { IntervalsClient, IntervalsError } from "../src/intervals";

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IntervalsClient", () => {
  it("authenticates with the API key as basic auth", async () => {
    const fetchMock = stubFetch(new Response("[]"));
    await new IntervalsClient("secret").request("GET", "/athlete/0/events");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://intervals.icu/api/v1/athlete/0/events");
    expect(new Headers(init.headers).get("Authorization")).toBe(`Basic ${btoa("API_KEY:secret")}`);
  });

  it("skips undefined query values", async () => {
    const fetchMock = stubFetch(new Response("[]"));
    await new IntervalsClient("secret").request("GET", "/x", {
      query: { oldest: "2026-11-01", newest: undefined, upsert: false },
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://intervals.icu/api/v1/x?oldest=2026-11-01&upsert=false",
    );
  });

  it("raises the status and body on failure without exposing the key", async () => {
    stubFetch(new Response("bad workout", { status: 422 }));

    const error = await new IntervalsClient("secret")
      .request<IntervalsError>("POST", "/x")
      .catch((e: IntervalsError) => e);

    expect(error).toBeInstanceOf(IntervalsError);
    expect(error.status).toBe(422);
    expect(error.message).toContain("bad workout");
    expect(error.message).not.toContain("secret");
  });

  it("returns null for an empty body", async () => {
    stubFetch(new Response(""));

    await expect(new IntervalsClient("secret").request("PUT", "/x")).resolves.toBeNull();
  });
});
