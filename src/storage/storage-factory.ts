import type { StorageConfig } from "./config";
import { LocalEvidenceStorage } from "./local-storage";
import { S3EvidenceStorage } from "./s3-storage";
import type { EvidenceStorage } from "./types";

export function createEvidenceStorage(config: StorageConfig): EvidenceStorage {
  return config.driver === "local"
    ? new LocalEvidenceStorage(config.rootPath)
    : new S3EvidenceStorage(config);
}
