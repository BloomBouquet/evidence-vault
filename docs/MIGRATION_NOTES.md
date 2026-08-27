# Legacy baseline migration

The standalone Evidence Vault repository was bootstrapped from the approved legacy product subtree only.

Source snapshot:
- Repository: `sunwoo162/Playground`
- Branch: `evidence-vault/backend`
- Commit: `101198ba3e367f7d8e21027cacd263e9ad866264`
- Source directory: `evidence-vault/`

Excluded from migration:
- `.foundation-complete`
- any file outside the Evidence Vault subtree
- `.env` / `.env.local`
- local `.data/` evidence files
- dependency/build/test output
- credentials, tokens, signed URLs

The migrated `app/` and `src/` trees were compared against the source snapshot before opening the migration PR. Install, unit-test, and production-build verification is owned by GitHub Actions because the ChatGPT execution sandbox cannot resolve the public npm/GitHub package endpoints in this session.
