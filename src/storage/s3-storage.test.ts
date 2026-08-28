import { describe, expect, it, vi } from "vitest";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3EvidenceStorage } from "./s3-storage";

const config = {
  driver: "s3" as const,
  endpoint: "https://objects.example.test",
  region: "ap-northeast-2",
  bucket: "private-evidence",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key",
  forcePathStyle: true,
};

describe("S3EvidenceStorage", () => {
  it("stores without a public ACL", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3EvidenceStorage(config, { client: { send } });

    await storage.putObject({
      storageKey: "users/user-a/evidence/file-a",
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "application/pdf",
    });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "private-evidence",
      Key: "users/user-a/evidence/file-a",
      ContentType: "application/pdf",
    });
    expect(command.input.ACL).toBeUndefined();
  });

  it("creates exactly 300-second signed download targets", async () => {
    const send = vi.fn().mockResolvedValue({});
    const signer = vi.fn().mockResolvedValue("https://signed.example.test/file");
    const now = () => new Date("2026-08-28T03:00:00.000Z");
    const storage = new S3EvidenceStorage(config, { client: { send }, signer, now });

    await expect(
      storage.getDownloadTarget({
        storageKey: "users/user-a/evidence/file-a",
        expiresInSeconds: 300,
      }),
    ).resolves.toEqual({
      kind: "redirect",
      url: "https://signed.example.test/file",
      expiresAt: new Date("2026-08-28T03:05:00.000Z"),
    });

    const command = signer.mock.calls[0]?.[1];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: "private-evidence",
      Key: "users/user-a/evidence/file-a",
    });
    expect(signer.mock.calls[0]?.[2]).toEqual({ expiresIn: 300 });
  });

  it("uses DeleteObject without exposing provider details", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3EvidenceStorage(config, { client: { send } });

    await storage.deleteObject("users/user-a/evidence/file-a");

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: "private-evidence",
      Key: "users/user-a/evidence/file-a",
    });
  });
});
