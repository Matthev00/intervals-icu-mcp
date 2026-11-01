import { describe, expect, it } from "vitest";
import { isAuthorized, toMcpRoute } from "../src/auth";

const TOKEN = "correct-token";

function request(path: string, headers: HeadersInit = {}) {
  return new Request(`https://example.workers.dev${path}`, { headers });
}

describe("isAuthorized", () => {
  it("accepts the token in the path", async () => {
    await expect(isAuthorized(request(`/s/${TOKEN}/mcp`), TOKEN)).resolves.toBe(true);
  });

  it("accepts a bearer header on the plain route", async () => {
    const bearer = request("/mcp", { Authorization: `Bearer ${TOKEN}` });

    await expect(isAuthorized(bearer, TOKEN)).resolves.toBe(true);
  });

  it.each([
    ["no credentials", request("/mcp")],
    ["a wrong path token", request("/s/wrong/mcp")],
    ["a wrong bearer", request("/mcp", { Authorization: "Bearer wrong" })],
    ["another path", request("/", { Authorization: `Bearer ${TOKEN}` })],
  ])("rejects %s", async (_name, candidate) => {
    await expect(isAuthorized(candidate, TOKEN)).resolves.toBe(false);
  });

  it("fails closed when no token is configured", async () => {
    const bearer = request("/mcp", { Authorization: "Bearer " });

    await expect(isAuthorized(bearer, undefined)).resolves.toBe(false);
    await expect(isAuthorized(bearer, "")).resolves.toBe(false);
  });
});

describe("toMcpRoute", () => {
  it("strips the secret from the path", () => {
    expect(new URL(toMcpRoute(request(`/s/${TOKEN}/mcp`)).url).pathname).toBe("/mcp");
  });
});
