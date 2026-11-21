# Add a simulation

1. Define a trace under `src/simulation/flows/` using the schema in
   `src/simulation/schema.ts`. Parse the definition at build time.
2. Give each participant and event a stable ID. List events in display
   order. Use the browser channel for front-channel traffic, back channel
   for direct service calls, and local for work inside a participant.
3. Keep request URLs and query parameters structured. Use URL-encoded
   form bodies where specified and JSON only where the exchange calls
   for it. HTTP excerpts describe messages and omit framing headers.
   Provide a short interpretation, security notes where relevant, and
   section-specific links with each event.
4. Register the definition in `src/simulation/flows/index.ts` and set
   the lesson's optional `simulation` field. The route renders the generic
   player and its static transcript.
5. Add invariant tests for what makes the example correct. Check linked
   parameters across events and recompute transformations where possible.
   Review the trace against the cited sections. Run the built site and
   verify that each excerpt stays readable at a narrow viewport.

The reducer runs without browser dependencies. It treats a manual
selection or step as a pause. Reset moves to the first event and keeps
the user's speed. Only the SolidJS player owns the playback timer.
Diagrams read the selected event and animate a presentation detail.
Model alternatives as separate traces when useful.
