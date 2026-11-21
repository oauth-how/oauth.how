import { flowSchema, type HttpResponse } from "../schema";

const client = "https://reading.example";
const authorizationServer = "https://login.example";
const api = "https://library-api.example";
const redirectUri = `${client}/oauth/callback`;
const scope = "books:read";
const appSession = { Cookie: "__Host-reading_session=demo_session_X4Am" };
const state = "cUsDG5DE726VtAghyw3Dzw";
const code = "demo_ac_6GKoZgZq4m";
const verifier = "Jwmkro0pqtyWTbkt8AqNdlKXNeO6I6bj94bG37g_Pes";
const challenge = "cuP8PtQCuYvuX1Q8SvpKqsZx96-n56TR_nk4jGiG6QA";
const accessToken = "demo_at_TVW6gksBwL4M";
const authorizationQuery = {
  response_type: "code",
  client_id: "reading-list",
  redirect_uri: redirectUri,
  scope,
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
};
const callbackQuery = { code, state };
const withQuery = (url: string, query: Record<string, string>) =>
  `${url}?${new URLSearchParams(query)}`;
const redirect = (location: string, status: 302 | 303): HttpResponse => ({
  status,
  reason: status === 302 ? "Found" : "See Other",
  headers: { Location: location, "Cache-Control": "no-store" },
});
const json = (value: unknown) => JSON.stringify(value, null, 2);
const rfc = (number: number, section: string) => ({
  label: `RFC ${number} §${section}`,
  url: `https://www.rfc-editor.org/rfc/rfc${number}.html#section-${section}`,
});

export const pkceFlow = flowSchema.parse({
  id: "authorization-code-pkce",
  title: "Authorization Code + PKCE",
  participants: [
    { id: "browser", label: "User’s browser", shortLabel: "Browser" },
    { id: "client", label: "Client application", shortLabel: "Client" },
    {
      id: "authorization-server",
      label: "Authorization server",
      shortLabel: "Auth server",
    },
    { id: "api", label: "Resource server (API)", shortLabel: "API" },
  ],
  events: [
    {
      id: "start",
      from: "browser",
      to: "client",
      kind: "http-request",
      channel: "browser",
      title: "Start connecting the library",
      explanation:
        "Mina chooses Connect library in Reading List. The client creates a fresh verifier, derives its S256 challenge, and stores the verifier and a random state value with this browser’s pending authorization attempt.",
      security:
        "Generate a new verifier from at least 32 bytes of cryptographic randomness for each attempt. These fixed values make the example reproducible.",
      request: {
        method: "GET",
        url: `${client}/connect/library`,
        headers: appSession,
      },
      references: [rfc(7636, "4.1"), rfc(7636, "4.2"), rfc(6749, "10.12")],
    },
    {
      id: "start-redirect",
      from: "client",
      to: "browser",
      kind: "redirect",
      channel: "browser",
      title: "Redirect the browser to the authorization server",
      explanation:
        "The client returns a Location URL with the authorization parameters. The browser follows it in the next step.",
      security:
        "The URL carries the challenge and method. The verifier stays on the client until token exchange.",
      response: redirect(
        withQuery(`${authorizationServer}/authorize`, authorizationQuery),
        302,
      ),
      references: [rfc(6749, "4.1.1"), rfc(7636, "4.3")],
    },
    {
      id: "authorize",
      from: "browser",
      to: "authorization-server",
      kind: "http-request",
      channel: "browser",
      title: "Request authorization with the challenge",
      explanation:
        "The browser visits the authorization endpoint. The client asks for books:read and requests an authorization code.",
      security:
        "The authorization server validates the client and requires an exact match against this web client’s registered redirect URI.",
      request: {
        method: "GET",
        url: `${authorizationServer}/authorize`,
        query: authorizationQuery,
      },
      references: [rfc(6749, "4.1.1"), rfc(7636, "4.4"), rfc(9700, "2.1")],
    },
    {
      id: "sign-in",
      from: "browser",
      to: "authorization-server",
      kind: "authentication",
      channel: "browser",
      title: "Authenticate at the authorization server",
      explanation:
        "The authorization server establishes which library account is active. It might use an existing session or prompt Mina to sign in. The sign-in interaction is specific to the authorization server.",
      security:
        "Mina authenticates with the authorization server. The client has no access to her library credentials.",
      references: [rfc(6749, "3.1")],
    },
    {
      id: "consent",
      from: "browser",
      to: "authorization-server",
      kind: "consent",
      channel: "browser",
      title: "Approve read access",
      explanation:
        "Mina grants Reading List permission to read her saved books. This example shows an approval screen. OAuth leaves the details of the interaction to the authorization server.",
      security:
        "Request only the permissions the feature needs. Here the client asks for read access to saved books.",
      references: [rfc(6749, "4.1.1"), rfc(9700, "2.3")],
    },
    {
      id: "code-redirect",
      from: "authorization-server",
      to: "browser",
      kind: "redirect",
      channel: "browser",
      title: "Redirect back with an authorization code",
      explanation:
        "The authorization server issues a short-lived, single-use code associated with the client, redirect URI, and PKCE challenge. It returns the original state value in the redirect.",
      security:
        "The browser carries a code. Access tokens are returned at the token endpoint.",
      response: redirect(withQuery(redirectUri, callbackQuery), 303),
      references: [rfc(6749, "4.1.2"), rfc(7636, "4.4")],
    },
    {
      id: "callback",
      from: "browser",
      to: "client",
      kind: "http-request",
      channel: "browser",
      title: "Deliver the code to the client callback",
      explanation:
        "The browser follows the second redirect. The client checks state against the pending attempt for this browser, then retrieves the verifier for that same attempt.",
      security:
        "Reject a missing or mismatched state value when this client uses state for callback correlation and CSRF protection.",
      request: {
        method: "GET",
        url: redirectUri,
        query: callbackQuery,
        headers: appSession,
      },
      references: [rfc(6749, "4.1.2"), rfc(6749, "10.12"), rfc(9700, "2.1")],
    },
    {
      id: "exchange",
      from: "client",
      to: "authorization-server",
      kind: "http-request",
      channel: "back-channel",
      title: "Exchange the code and verifier",
      explanation:
        "The confidential web client authenticates to the token endpoint and sends the code, matching redirect URI, and original verifier over TLS. This request originates from the client backend.",
      security:
        "PKCE binds the exchange to the initiating attempt. The confidential client also authenticates independently. The Basic credentials shown here are fictional.",
      request: {
        method: "POST",
        url: `${authorizationServer}/token`,
        headers: {
          Authorization: "Basic cmVhZGluZy1saXN0OmRlbW8tY2xpZW50LXNlY3JldA==",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }).toString(),
      },
      references: [rfc(6749, "2.3.1"), rfc(6749, "4.1.3"), rfc(7636, "4.5")],
    },
    {
      id: "issue",
      from: "authorization-server",
      to: "client",
      kind: "token-issuance",
      channel: "back-channel",
      title: "Verify the challenge and issue an access token",
      explanation:
        "The authorization server validates the client, code, and redirect URI. It hashes and base64url-encodes the verifier, compares the result to the stored challenge, consumes the code, and returns an access token.",
      security:
        "A mismatched verifier fails the exchange with invalid_grant. Token responses carrying credentials must include no-store and no-cache directives in their respective headers.",
      response: {
        status: 200,
        reason: "OK",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        body: json({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: 600,
          scope,
        }),
      },
      references: [rfc(7636, "4.6"), rfc(6749, "4.1.4"), rfc(6749, "5.1")],
    },
    {
      id: "api-request",
      from: "client",
      to: "api",
      kind: "http-request",
      channel: "back-channel",
      title: "Request the saved books",
      explanation:
        "Reading List calls the library API with the access token in the Authorization header.",
      security:
        "Anyone holding a bearer token can present it. Protect it in transit and storage.",
      request: {
        method: "GET",
        url: `${api}/v1/saved-books`,
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      references: [rfc(6750, "2.1"), rfc(6750, "5")],
    },
    {
      id: "validate",
      from: "api",
      to: "api",
      kind: "token-validation",
      channel: "local",
      title: "Check whether the API can accept the token",
      explanation:
        "The resource server looks up the opaque token in its trusted token data and checks that it is active, unexpired, intended for this API, and grants books:read for the requested resource.",
      security:
        "An opaque token has no client-readable claims. This example assumes an internal lookup. A separately deployed API might use authenticated introspection.",
      references: [rfc(6750, "5.2"), rfc(7662, "2.2"), rfc(9700, "2.3")],
    },
    {
      id: "api-response",
      from: "api",
      to: "client",
      kind: "http-response",
      channel: "back-channel",
      title: "Return the saved books",
      explanation:
        "The API returns Mina’s saved titles to the client. The client can render the result for Mina in its own UI.",
      response: {
        status: 200,
        reason: "OK",
        headers: { "Content-Type": "application/json" },
        body: json({
          books: [{ id: "bk_17", title: "Maps of the Tidelands" }],
        }),
      },
      references: [rfc(6749, "7"), rfc(6750, "2.1")],
    },
    {
      id: "clean-redirect",
      from: "client",
      to: "browser",
      kind: "redirect",
      channel: "browser",
      title: "Send the browser to a clean URL",
      explanation:
        "The backend finishes the pending callback by redirecting to its own saved-books page. The new URL carries no authorization parameters.",
      security:
        "Avoid third-party resources on the callback page. The clean redirect and restrictive Referrer-Policy limit further exposure of the code through referrers.",
      response: {
        ...redirect(`${client}/saved-books`, 303),
        headers: {
          Location: `${client}/saved-books`,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
      references: [rfc(9700, "4.2.4")],
    },
    {
      id: "finish",
      from: "browser",
      to: "client",
      kind: "http-request",
      channel: "browser",
      title: "Open the saved-books page",
      explanation:
        "The browser loads the client’s page. The client renders the book list and keeps the library access token on the backend.",
      request: {
        method: "GET",
        url: `${client}/saved-books`,
        headers: appSession,
      },
      response: {
        status: 200,
        reason: "OK",
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: "<h1>Saved books</h1><ul><li>Maps of the Tidelands</li></ul>",
      },
      references: [rfc(6749, "4.1")],
    },
  ],
} satisfies import("../schema").Flow);
