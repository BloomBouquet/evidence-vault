import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { StorageOperationError } from "./errors";
import type {
  DownloadTargetInput,
  EvidenceDownloadTarget,
  EvidenceStorage,
  PutEvidenceObjectInput,
} from "./types";

export class LocalEvidenceStorage implements EvidenceStorage {
  private readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  private resolveStoragePath(storageKey: string): string {
    const candidate = resolve(this.rootPath, storageKey);
    if (!candidate.startsWith(`${this.rootPath}${sep}`)) {
      throw new Error("storage_key_invalid");
    }
    return candidate;
  }

  async putObject(input: PutEvidenceObjectInput): Promise<void> {
    const path = this.resolveStoragePath(input.storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.bytes);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const path = this.resolveStoragePath(storageKey);
    await rm(path, { force: true });
  }

  async getDownloadTarget(
    input: DownloadTargetInput,
  ): Promise<EvidenceDownloadTarget> {
    const path = this.resolveStoragePath(input.storageKey);
    try {
      const bytes = await readFile(path);
      return { kind: "bytes", bytes: new Uint8Array(bytes) };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        throw new StorageOperationError("not_found");
      }
      throw error;
    }
  }
}
