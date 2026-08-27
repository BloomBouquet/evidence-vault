# Merge gate

Do not merge the baseline migration PR until:

1. GitHub Actions dependency install succeeds.
2. `pnpm test:run` succeeds.
3. `pnpm build` succeeds.
4. The generated `pnpm-lock.yaml` artifact is committed to the branch.
5. CI re-runs with the committed lockfile.

This file is a temporary merge-gate reminder and may be folded into verification documentation after the gate is satisfied.
