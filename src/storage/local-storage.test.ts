import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalEvidenceStorage } from "./local-storage";

const roots: string[] = [];

async function createStorage() {
  const root = await mkdtemp(join(tmpdir(), "evidence-vault-storage-"));
  roots.push(root);
  return { root, storage: new LocalEvidenceStorage(root) };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalEvidenceStorage", () => {
  it("writes private bytes under the configured root and reads bytes back", async () => {
    const { root, storage } = await createStorage();
    const bytes = new TextEncoder().encode("private evidence");
    const storageKey = "users/user-a/evidence/file-a";

    await storage.putObject({ storageKey, bytes, mimeType: "application/pdf" });

    expect(new Uint8Array(await readFile(join(root, storageKey)))).toEqual(bytes);
    await expect(storage.getDownloadTarget({ storageKey, expiresInSeconds: 300 })).resolves.toEqual({
      kind: "bytes",
      bytes,
    });
  });

  it("rejects storage keys that escape the configured root", async () => {
    const { storage } = await createStorage();
    await expect(
      storage.putObject({
        storageKey: "../escape",
        bytes: new Uint8Array([1]),
        mimeType: "image/png",
      }),
    ).rejects.toThrow("storage_key_invalid");
  });

  it("treats deleting a missing object as success", async () => {
    const { storage } = await createStorage();
    await expect(storage.deleteObject("users/user-a/evidence/missing")).resolves.toBeUndefined();
  });
});
