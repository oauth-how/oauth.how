# oauth.how

**OAuth explained. One flow at a time.**

oauth.how teaches OAuth, OpenID Connect, and identity through short lessons,
original diagrams, inspectable HTTP exchanges, and browser-local token
experiments. All examples use fictional data. The project is vendor-neutral
and open source under the [BSD 3-Clause License](LICENSE).

## Develop locally

Use the Node.js version in [`.nvmrc`](.nvmrc), then run:

```sh
npm ci
npm run dev
```

With Just installed, run `just` to list the local recipes.
`just check` runs type, lint, and formatting checks. `just test` runs unit
tests. `just ci` also builds the site and runs browser tests. To use an
existing Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its
path. `just preview` builds the production site and listens on all network
interfaces. From another machine, open `http://<vm-ip>:4322`.

## How it fits together

- `src/content/lessons/` holds the MDX lessons and their citations.
- `src/pages/` and `src/layouts/` build the site, curriculum, and individual lessons.
- `src/simulation/` holds validated flow data, the pure playback reducer, and an HTTP formatter.
- `src/components/` contains the SVG player, static transcripts, and JWT inspector.
- `test/` contains Vitest and Playwright checks for fixture invariants and browser behavior.

Read the [architecture](docs/architecture.md), [contribution guide](CONTRIBUTING.md), and
[agent instructions](AGENTS.md) before adding features or lessons.
