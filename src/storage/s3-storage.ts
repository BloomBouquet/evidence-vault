import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3StorageConfig } from "./config";
import { normalizeStorageError } from "./errors";
import type {
  DownloadTargetInput,
  EvidenceDownloadTarget,
  EvidenceStorage,
  PutEvidenceObjectInput,
} from "./types";

export const S3_DOWNLOAD_TTL_SECONDS = 300;

type CommandClient = {
  send(command: unknown): Promise<unknown>;
};

type Signer = (
  client: unknown,
  command: GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

type S3EvidenceStorageDeps = {
  client?: CommandClient;
  signer?: Signer;
  now?: () => Date;
};

export class S3EvidenceStorage implements EvidenceStorage {
  private readonly client: CommandClient;
  private readonly signer: Signer;
  private readonly now: () => Date;

  constructor(
    private readonly config: S3StorageConfig,
    deps: S3EvidenceStorageDeps = {},
  ) {
    this.client =
      deps.client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    this.signer = deps.signer ?? (getSignedUrl as Signer);
    this.now = deps.now ?? (() => new Date());
  }

  async putObject(input: PutEvidenceObjectInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.storageKey,
          Body: input.bytes,
          ContentType: input.mimeType,
        }),
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: storageKey,
        }),
      );
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }

  async getDownloadTarget(
    input: DownloadTargetInput,
  ): Promise<EvidenceDownloadTarget> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: input.storageKey,
      });
      const url = await this.signer(this.client, command, {
        expiresIn: S3_DOWNLOAD_TTL_SECONDS,
      });
      return {
        kind: "redirect",
        url,
        expiresAt: new Date(
          this.now().getTime() + S3_DOWNLOAD_TTL_SECONDS * 1000,
        ),
      };
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}
