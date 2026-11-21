import { z } from "zod";

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const text = z.string().min(1);

export const referenceSchema = z.strictObject({
  label: text,
  url: z.url({ protocol: /^https$/ }),
});

const httpFields = z.record(z.string(), z.string());
const requestSchema = z.strictObject({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  url: z.url({ protocol: /^https$/ }),
  query: httpFields.optional(),
  headers: httpFields.optional(),
  body: z.string().optional(),
});

const responseSchema = z.strictObject({
  status: z.number().int().min(100).max(599),
  reason: text,
  headers: httpFields.optional(),
  body: z.string().optional(),
});

const participantSchema = z.strictObject({ id, label: text, shortLabel: text });
const eventSchema = z.strictObject({
  id,
  from: id,
  to: id,
  kind: z.enum([
    "http-request",
    "http-response",
    "redirect",
    "authentication",
    "consent",
    "token-issuance",
    "token-validation",
    "token-refresh",
    "token-revocation",
    "error",
  ]),
  channel: z.enum(["browser", "back-channel", "local"]),
  title: text,
  explanation: text,
  security: text.optional(),
  references: z.array(referenceSchema).min(1),
  request: requestSchema.optional(),
  response: responseSchema.optional(),
});

export const flowSchema = z
  .strictObject({
    id,
    title: text,
    participants: z.array(participantSchema).min(2),
    events: z.array(eventSchema).min(1),
  })
  .superRefine((flow, context) => {
    const participantIds = new Set<string>();
    const eventIds = new Set<string>();
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    flow.participants.forEach((participant, index) => {
      if (participantIds.has(participant.id))
        issue(["participants", index, "id"], "Duplicate participant ID.");
      participantIds.add(participant.id);
    });

    flow.events.forEach((event, index) => {
      if (eventIds.has(event.id))
        issue(["events", index, "id"], "Duplicate event ID.");
      eventIds.add(event.id);
      for (const endpoint of ["from", "to"] as const) {
        if (!participantIds.has(event[endpoint]))
          issue(["events", index, endpoint], "Unknown participant.");
      }
      if (event.kind === "http-request" && !event.request) {
        issue(
          ["events", index, "request"],
          "An HTTP request event needs a request.",
        );
      }
      if (event.kind === "http-response" && !event.response) {
        issue(
          ["events", index, "response"],
          "An HTTP response event needs a response.",
        );
      }
      if (
        event.kind === "redirect" &&
        (!event.response ||
          event.response.status < 300 ||
          event.response.status >= 400 ||
          !Object.entries(event.response.headers ?? {}).some(
            ([name, value]) =>
              name.toLowerCase() === "location" && value.length > 0,
          ))
      ) {
        issue(
          ["events", index, "response"],
          "A redirect needs a 3xx response with a Location header.",
        );
      }
    });
  });

export type Flow = z.infer<typeof flowSchema>;
export type FlowEvent = z.infer<typeof eventSchema>;
export type HttpRequest = z.infer<typeof requestSchema>;
export type HttpResponse = z.infer<typeof responseSchema>;
