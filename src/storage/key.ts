export function buildEvidenceStorageKey(
  ownerUserId: string,
  evidenceFileId: string,
): string {
  return `users/${ownerUserId}/evidence/${evidenceFileId}`;
}
