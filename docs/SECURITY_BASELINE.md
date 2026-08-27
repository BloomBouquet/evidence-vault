# Security baseline

The migrated baseline preserves these non-negotiable boundaries:

- Evidence Vault does not store project-owned email/password credentials.
- OAuth uses PKCE S256 and independent state values.
- OAuth login-attempt state is short-lived and encrypted before cookie storage.
- External `returnTo` targets are rejected.
- User-owned resource repository reads require both `ownerUserId` and resource `id`.
- Deleted evidence files are excluded from normal evidence reads.
- Evidence is private by default; public object URLs are not part of the baseline.
- SHA-256 is an integrity fingerprint only, not a legal-authenticity claim.
- Medical/health dispute category is intentionally absent from the MVP domain enum.

The baseline does not yet implement the complete OAuth callback, private object storage, signed download, deletion reconciliation, or cross-user E2E tests. Those remain mandatory downstream tasks before release.
