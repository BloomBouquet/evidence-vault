# CI notes

The migration PR intentionally lets CI bootstrap a lockfile when `pnpm-lock.yaml` is absent because the current ChatGPT execution sandbox cannot resolve public package endpoints. The generated lockfile is uploaded as `generated-pnpm-lock` for one day.

Before merge, the lockfile must be committed and CI must be re-run using `pnpm install --frozen-lockfile` through the existing conditional install step.
