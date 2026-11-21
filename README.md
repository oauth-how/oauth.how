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

Deploy the generated `dist/` directory to a static host. See
[Cloudflare Pages and static deployment](docs/deployment.md) for the GitHub
integration, pull-request previews, and nested lesson URLs.

## How it fits together

- `src/content/lessons/` holds the MDX lessons and their citations.
- `src/pages/` and `src/layouts/` build the site, curriculum, and individual lessons.
- `src/simulation/` holds validated flow data, the pure playback reducer, and an HTTP formatter.
- `src/components/` contains the SVG player, static transcripts, and JWT inspector.
- `test/` contains Vitest and Playwright checks for fixture invariants and browser behavior.

Read the [architecture](docs/architecture.md), [contribution guide](CONTRIBUTING.md), and
[agent instructions](AGENTS.md) before adding features or lessons.
