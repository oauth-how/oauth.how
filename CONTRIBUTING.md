# Contributing

Use Node.js 24.21.0 (see `.nvmrc`) and npm. Run `npm ci` and use
`npm run dev` to preview changes. Keep each change focused.

## Lessons and simulations

For a lesson, add an MDX file to `src/content/lessons/`. Use a stable
filename, provide metadata and authoritative references, and verify the
generated route. Read the [content guidelines](docs/content-guidelines.md).

For a simulation, add a validated flow definition and reuse the player
and transcript. Read [adding simulations](docs/simulations.md). Review
the exact HTTP excerpts against the linked specifications and test
relationships between the messages.

## Before opening a pull request

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

On a fresh Linux CI runner, use `npx playwright install --with-deps chromium`.
For machines with a compatible Chromium already available, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path.
Playwright starts its own static preview from the current `dist/` build.

Use plain imperative commit subjects. In the pull request, describe how
the change affects readers, link the relevant specification sections for
protocol changes, and report the checks you ran. Include a screenshot for
meaningful diagram or layout changes when it helps reviewers. Keep fixture
data fictional and omit credentials or tokens from production systems.
