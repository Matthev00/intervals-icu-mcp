import { createMcpHandler } from "agents/mcp/server";
import { isAuthorized, toMcpRoute } from "./auth";
import { IntervalsClient } from "./intervals";
import { createServer } from "./tools";

interface Env {
  INTERVALS_API_KEY: string;
  MCP_AUTH_TOKEN: string;
  INTERVALS_API_BASE?: string;
}

export default {
  async fetch(request, env, ctx) {
    if (!(await isAuthorized(request, env.MCP_AUTH_TOKEN))) {
      return new Response("Not found", { status: 404 });
    }
    const client = new IntervalsClient(env.INTERVALS_API_KEY, env.INTERVALS_API_BASE);
    const handler = createMcpHandler(() => createServer(client));
    return handler(toMcpRoute(request), env, ctx);
  },
} satisfies ExportedHandler<Env>;
