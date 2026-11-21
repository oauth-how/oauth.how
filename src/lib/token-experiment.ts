import { demoPublicKey } from "./token-samples";

type Fields = Record<string, unknown>;

const issuer = "https://login.example";
const audience = "https://library-api.example";

export type ValidationResult =
  | { ok: true; signature: "valid" }
  | { ok: false; signature: "valid" | "invalid" | "unchecked"; reason: string };

function base64url(segment: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(segment))
    throw new Error("Expected a base64url segment.");
  const bytes = atob(segment.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(bytes, (byte) => byte.charCodeAt(0));
}

function decodeObject(segment: string): Fields {
  const data: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(base64url(segment)),
  );
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Expected a JSON object.");
  return data as Fields;
}

export function decodeSample(token: string) {
  const [header, payload, signature, extra] = token.split(".");
  if (!header || !payload || !signature || extra !== undefined)
    throw new Error("Expected a compact JWS.");
  return {
    header: decodeObject(header),
    payload: decodeObject(payload),
    signature: base64url(signature),
    signingInput: new TextEncoder().encode(`${header}.${payload}`),
  };
}

export async function verifySample(
  token: string,
  now: number,
): Promise<ValidationResult> {
  const { header, payload, signature, signingInput } = decodeSample(token);
  if (
    header["alg"] !== "RS256" ||
    header["typ"] !== "at+jwt" ||
    header["kid"] !== "library-demo-1"
  ) {
    return {
      ok: false,
      signature: "unchecked",
      reason: "The header does not match the lab’s key and algorithm policy.",
    };
  }
  const key = await crypto.subtle.importKey(
    "jwk",
    demoPublicKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      signingInput,
    ))
  ) {
    return {
      ok: false,
      signature: "invalid",
      reason: "The signature does not match these header and payload bytes.",
    };
  }

  const recipients = payload["aud"];
  const intendedForLibrary =
    recipients === audience ||
    (Array.isArray(recipients) &&
      recipients.every((recipient) => typeof recipient === "string") &&
      recipients.includes(audience));
  const expiry = payload["exp"];
  const issuedAt = payload["iat"];
  const requiredStrings = ["sub", "client_id", "jti"];
  let reason: string | undefined;
  if (payload["iss"] !== issuer)
    reason = "The issuer does not match the trusted issuer.";
  else if (!intendedForLibrary)
    reason = "The audience does not include the library API.";
  else if (typeof expiry !== "number" || expiry <= now)
    reason = "The token has expired at the lab’s clock time.";
  else if (typeof issuedAt !== "number" || issuedAt > now)
    reason = "The issued-at time is invalid.";
  else if (requiredStrings.some((claim) => typeof payload[claim] !== "string"))
    reason = "A required claim is missing.";
  else if (
    typeof payload["scope"] !== "string" ||
    !payload["scope"].split(" ").includes("books:read")
  ) {
    reason = "The token lacks books:read for the sample request.";
  }

  return reason
    ? { ok: false, signature: "valid", reason }
    : { ok: true, signature: "valid" };
}
