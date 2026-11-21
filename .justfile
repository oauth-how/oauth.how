export ASTRO_TELEMETRY_DISABLED := env_var_or_default("ASTRO_TELEMETRY_DISABLED", "1")

[default]
help:
    @just --list

# Install dependencies from the lockfile.
install:
    npm ci

# Start Astro with live reload.
dev port="4321":
    npm run dev -- --host 127.0.0.1 --port {{ quote(port) }} --ignore-lock

# Run TypeScript, ESLint, and Prettier checks.
check:
    npm run typecheck
    npm run lint
    npm run format:check

# Run Vitest unit tests.
test:
    npm test

# Generate the static site in dist/.
build:
    npm run build

# Build the site and run the Playwright tests.
test-browser: build
    npm run test:browser

# Run the local CI checks, including browser tests.
ci: check test test-browser

# Build and serve the production site on all VM interfaces.
preview port="4322": build
    npm run preview -- --host 0.0.0.0 --port {{ quote(port) }} --ignore-lock
