export type LocalStorageConfig = {
  driver: "local";
  rootPath: string;
};

export type S3StorageConfig = {
  driver: "s3";
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type StorageConfig = LocalStorageConfig | S3StorageConfig;

type StorageEnv = Record<string, string | undefined>;

function required(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function parseStorageConfig(env: StorageEnv = process.env): StorageConfig {
  const driver = required(env.STORAGE_DRIVER);

  if (driver === "local") {
    if (env.NODE_ENV === "production") {
      throw new Error("storage_local_not_allowed_in_production");
    }

    const rootPath = required(env.LOCAL_STORAGE_PATH);
    if (!rootPath) throw new Error("storage_local_configuration_incomplete");

    return { driver: "local", rootPath };
  }

  if (driver === "s3") {
    const region = required(env.S3_REGION);
    const bucket = required(env.S3_BUCKET);
    const accessKeyId = required(env.S3_ACCESS_KEY_ID);
    const secretAccessKey = required(env.S3_SECRET_ACCESS_KEY);

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("storage_s3_configuration_incomplete");
    }

    const endpoint = required(env.S3_ENDPOINT) ?? undefined;

    return {
      driver: "s3",
      ...(endpoint ? { endpoint } : {}),
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    };
  }

  throw new Error("storage_driver_invalid");
}
