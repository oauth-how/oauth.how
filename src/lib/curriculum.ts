export const curriculum = [
  {
    id: "foundations",
    title: "Foundations",
    level: "Beginner",
    topics: [
      "Identity, credentials, and sessions",
      "Permissions and delegated access",
    ],
  },
  {
    id: "oauth",
    title: "OAuth 2.0",
    level: "Beginner to intermediate",
    topics: [
      "Client Credentials and Device Authorization Grant",
      "Refresh tokens",
      "Endpoints, redirects, scopes, and consent",
    ],
  },
  {
    id: "oidc",
    title: "OpenID Connect",
    level: "Intermediate",
    topics: [
      "Authentication with OIDC",
      "ID tokens, claims, and nonce",
      "Discovery, JWKS, and UserInfo",
    ],
  },
  {
    id: "tokens",
    title: "Tokens and cryptography",
    level: "Intermediate",
    topics: [
      "JWS and JWE",
      "Introspection, expiration, and revocation",
      "Key management and signing-key rotation",
    ],
  },
  {
    id: "authorization",
    title: "Authorization models",
    level: "Intermediate",
    topics: [
      "Scopes and resource/action permissions",
      "RBAC and ABAC",
      "Audience restrictions, consent, and least privilege",
    ],
  },
  {
    id: "security",
    title: "Security",
    level: "Intermediate to advanced",
    topics: [
      "State, CSRF, and code interception",
      "Redirect URI validation",
      "Theft, replay, and refresh token rotation",
      "Issuer and audience checks",
      "Deprecated and discouraged flows",
    ],
  },
  {
    id: "advanced",
    title: "Advanced topics",
    level: "Advanced",
    topics: [
      "Token exchange, DPoP, PAR, and mTLS",
      "Federation and multi-tenancy",
      "OAuth metadata and interoperability",
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  level: string;
  topics: readonly string[];
}[];

export const tracks = curriculum.map(({ id }) => id);
