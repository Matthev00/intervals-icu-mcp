const SECRET_PATH = /^\/s\/([^/]+)\/mcp$/;

export const MCP_ROUTE = "/mcp";

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function tokensMatch(given: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(given), digest(expected)]);
  return left.reduce((difference, byte, index) => difference | (byte ^ right[index]!), 0) === 0;
}

function presentedToken(request: Request): string | undefined {
  const { pathname } = new URL(request.url);
  const fromPath = SECRET_PATH.exec(pathname)?.[1];
  if (fromPath !== undefined) {
    return decodeURIComponent(fromPath);
  }
  if (pathname !== MCP_ROUTE) {
    return undefined;
  }
  const header = request.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

export async function isAuthorized(request: Request, expected: string | undefined): Promise<boolean> {
  const given = presentedToken(request);
  if (!expected || given === undefined) {
    return false;
  }
  return tokensMatch(given, expected);
}

export function toMcpRoute(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = MCP_ROUTE;
  return new Request(url, request);
}
