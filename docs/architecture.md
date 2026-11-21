# Architecture

Astro 7 builds the site as directory-index HTML. The site uses Astro's
MDX, SolidJS, and sitemap integrations and the globally shared CSS
tokens in `src/styles/global.css`. The lockfile records the tested
versions. Node 24 LTS is the shared baseline for developer machines,
GitHub Actions, and Cloudflare Pages. The Solid integration uses the
compatible SolidJS 1.9 release line. Native CSS, SVG, timers, and Web
Crypto keep the runtime dependencies focused on hydration and rendering.

## Boundaries

| Layer                         | Responsibility                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Pages and site layout         | Static routes, navigation, canonical metadata, and progressive enhancement                |
| MDX collection and curriculum | Editorial content, track assignments, learning order, and source references               |
| Simulation definitions        | Fictional events, actors, channels, HTTP excerpts, and security notes                     |
| Simulation engine             | Pure playback state transitions given a state, action, and step count                     |
| SolidJS player                | Scheduling, keyboard-operable controls, live step summary, and the HTTP inspector         |
| SVG diagram                   | Lifelines, direction, actor highlighting, and a short Web Animations API packet animation |
| Token experiment              | Browser-local decoding and Web Crypto verification of known samples                       |

Build-time schemas catch missing fields and invalid actor relationships.
The lesson template resolves optional simulation IDs. MDX authors can
write prose without importing UI code. The static transcript and the
interactive player use the same flow data and HTTP formatter. Ordinary
lessons and the homepage preview are static HTML and SVG. Astro
hydrates the interactive areas on visibility.

Playback intentionally advances through a fixed linear trace. A reducer
makes play, pause, stepping, selection, and reset deterministic. The
browser sets a timer using the selected speed; rendering an animation
never changes playback state. Reduced motion removes the packet movement
and keeps the selected row and participants visible. CSS follows the
system color scheme.

## Verification

Unit tests establish control semantics, schema constraints, and wire-level
invariants in the teaching fixture. Tests recompute the PKCE challenge
and compare the browser and back-channel values. Browser checks run
against the built output to exercise navigation, hydration, keyboard
controls, reduced motion, and JavaScript-free reading. A standards review
still matters for choices that code cannot assert, such as the scope of
client authentication and the wording of protocol requirements.

The first trace models one successful grant with a confidential web client
and one issuer. Authentication screens, token storage, and API internals
remain in the narrative. The token exercise uses a pinned demo key and a
fixed clock. It is scoped to the example's claims and has no key discovery.
