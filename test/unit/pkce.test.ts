import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pkceFlow } from "../../src/simulation/flows/authorization-code-pkce";
import { flowSchema } from "../../src/simulation/schema";
import { formatRequest } from "../../src/simulation/http";

const event = (id: string) => {
  const found = pkceFlow.events.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing fixture event ${id}`);
  return found;
};

describe("Authorization Code + PKCE fixture", () => {
  it("recomputes S256 and keeps the code, state, and redirect URI consistent", () => {
    const authorization = event("authorize").request!;
    const callback = event("callback").request!;
    const exchange = event("exchange").request!;
    const parameters = new URLSearchParams(exchange.body);
    const verifier = parameters.get("code_verifier")!;
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(
      createHash("sha256").update(verifier, "ascii").digest("base64url"),
    ).toBe(authorization.query?.code_challenge);
    expect(authorization.query).toMatchObject({
      response_type: "code",
      code_challenge_method: "S256",
    });
    expect(callback.query?.state).toBe(authorization.query?.state);
    expect(parameters.get("grant_type")).toBe("authorization_code");
    expect(parameters.get("code")).toBe(callback.query?.code);
    expect(parameters.get("redirect_uri")).toBe(
      authorization.query?.redirect_uri,
    );
    expect(parameters.get("redirect_uri")).toBe(callback.url);
    expect(exchange.headers?.["Authorization"]).toMatch(/^Basic /);
    const browserEvents = pkceFlow.events.filter(
      ({ channel }) => channel === "browser",
    );
    expect(JSON.stringify(browserEvents)).not.toContain(verifier);
    expect(JSON.stringify(browserEvents)).not.toContain("code_verifier");
  });

  it("pairs each OAuth Location with the browser's next request", () => {
    for (const [redirect, request] of [
      ["start-redirect", "authorize"],
      ["code-redirect", "callback"],
    ]) {
      const response = event(redirect!).response!;
      const location = new URL(response.headers?.["Location"] ?? "");
      const browserRequest = event(request!).request!;
      expect(location.origin + location.pathname).toBe(browserRequest.url);
      expect(Object.fromEntries(location.searchParams)).toEqual(
        browserRequest.query,
      );
      expect(formatRequest(browserRequest)).toContain(
        `GET ${location.pathname}${location.search} HTTP/1.1`,
      );
    }
  });

  it("correlates the initiating browser and removes authorization parameters from the result URL", () => {
    const cookie = event("start").request?.headers?.["Cookie"];
    expect(cookie).toMatch(/^__Host-reading_session=/);
    expect(event("callback").request?.headers?.["Cookie"]).toBe(cookie);
    expect(event("authorize").request?.headers?.["Cookie"]).toBeUndefined();
    expect(event("clean-redirect").response?.headers).toMatchObject({
      Location: event("finish").request?.url,
      "Referrer-Policy": "no-referrer",
    });
    expect(event("finish").request?.query).toBeUndefined();
  });

  it("confines the bearer token to the token response and API request", () => {
    const response = event("issue").response!;
    const token = JSON.parse(response.body ?? "") as {
      access_token: string;
      token_type: string;
    };
    expect(response.headers).toMatchObject({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    });
    expect(token.token_type).toBe("Bearer");
    expect(event("api-request").request?.headers?.["Authorization"]).toBe(
      `Bearer ${token.access_token}`,
    );
    expect(
      pkceFlow.events
        .filter((entry) => JSON.stringify(entry).includes(token.access_token))
        .map(({ id }) => id),
    ).toEqual(["issue", "api-request"]);
  });

  it("rejects invalid participant, event, and redirect definitions", () => {
    const events = structuredClone(pkceFlow.events);
    const first = events[0]!;
    first.to = "unknown";
    events.push(first);
    delete events[1]!.response;
    const result = flowSchema.safeParse({ ...pkceFlow, events });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map(({ message }) => message)).toEqual([
        "Unknown participant.",
        "A redirect needs a 3xx response with a Location header.",
        "Duplicate event ID.",
        "Unknown participant.",
      ]);
  });
});
