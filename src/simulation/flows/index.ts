import { pkceFlow } from "./authorization-code-pkce";

export const flows = { "authorization-code-pkce": pkceFlow } as const;

export function isFlowId(value: unknown): value is keyof typeof flows {
  return typeof value === "string" && Object.hasOwn(flows, value);
}
