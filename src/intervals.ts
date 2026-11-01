const DEFAULT_BASE_URL = "https://intervals.icu/api/v1";
const OWN_ATHLETE_ID = "0";
const MAX_ERROR_BODY = 500;

type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export class IntervalsError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Intervals.icu returned ${status}: ${body.slice(0, MAX_ERROR_BODY)}`);
    this.name = "IntervalsError";
  }
}

export class IntervalsClient {
  private readonly authorization: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.authorization = `Basic ${btoa(`API_KEY:${apiKey}`)}`;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  athletePath(suffix = ""): string {
    return `/athlete/${OWN_ATHLETE_ID}${suffix}`;
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(this.buildUrl(path, options.query), {
      method,
      headers: {
        Authorization: this.authorization,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new IntervalsError(response.status, text);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  private buildUrl(path: string, query: Record<string, QueryValue> = {}): string {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}
