# Repository instructions

oauth.how is a static, vendor-neutral learning site for OAuth, OpenID
Connect, tokens, and identity. Prioritize technical accuracy, readable
lessons, and accessible protocol traces. Keep provider behavior, accounts,
server-side sessions, databases, external API calls, and generic workflow
systems outside the project.

## Boundaries and conventions

- Build pages at compile time with Astro. Keep explanatory prose in MDX
  and hydrate SolidJS only for interactions. Lessons must remain readable
  with JavaScript disabled.
- Place protocol fixtures under `src/simulation/flows/`. Keep playback
  transitions pure in `src/simulation/engine.ts`. Scheduling belongs in
  the player. Animation and styling belong in the diagram and CSS.
- Use strict TypeScript, existing CSS tokens, native controls, and browser
  capabilities. Justify new dependencies and abstractions in terms of a
  concrete project requirement.
- Preserve keyboard navigation, responsive layouts, text equivalents for
  diagrams, and visible step changes under reduced motion.
- Use plain imperative commit subjects. Do not use conventional commit
  prefixes or scoped variants.

## Add a lesson

Add an MDX file under `src/content/lessons/` with a title, description,
existing curriculum track, unique learning order, and section-specific
references. The filename becomes the route. Use an optional registered
simulation ID to embed a flow. See [content guidelines](docs/content-guidelines.md).

## Add a simulation

Define and parse a trace using the Zod schema, register it in
`src/simulation/flows/index.ts`, and cite the governing specification
sections. Test the wire invariants and check the static transcript and
interactive rendering. See [the simulation guide](docs/simulations.md).

Use reserved fixture hosts and fictional credentials only. The player
displays HTTP rather than sending it. Read applicable RFCs, errata, and
current guidance such as RFC 9700. Keep protocol requirements distinct
from local choices. Clearly label discouraged and historical flows.

## Check changes

Run `npm ci`, then `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm test`, and `npm run build`. Install Chromium
with `npx playwright install chromium` and run `npm run test:browser`
against the build. Update contributing or architecture documentation when
a change alters workflow or boundaries. Report checks actually run and
any verification gaps.
