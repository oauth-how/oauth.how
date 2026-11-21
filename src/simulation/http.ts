import type { HttpRequest, HttpResponse } from "./schema";

export function formatRequest(request: HttpRequest): string {
  const url = new URL(request.url);
  for (const [name, value] of Object.entries(request.query ?? {})) {
    url.searchParams.append(name, value);
  }
  return formatMessage(
    `${request.method} ${url.pathname}${url.search} HTTP/1.1`,
    { Host: url.host, ...request.headers },
    request.body,
  );
}

export function formatResponse(response: HttpResponse): string {
  return formatMessage(
    `HTTP/1.1 ${response.status} ${response.reason}`,
    response.headers,
    response.body,
  );
}

function formatMessage(
  start: string,
  headers: Record<string, string> = {},
  body?: string,
): string {
  const head = [
    start,
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
  ];
  return body === undefined ? head.join("\n") : [...head, "", body].join("\n");
}
