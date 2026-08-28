import { describe, expect, it } from "vitest";
import { parseStorageConfig } from "./config";

describe("parseStorageConfig", () => {
  it("accepts local storage in development", () => {
    expect(
      parseStorageConfig({
        NODE_ENV: "development",
        STORAGE_DRIVER: "local",
        LOCAL_STORAGE_PATH: ".data/evidence",
      }),
    ).toEqual({
      driver: "local",
      rootPath: ".data/evidence",
    });
  });

  it("rejects local storage in production", () => {
    expect(() =>
      parseStorageConfig({
        NODE_ENV: "production",
        STORAGE_DRIVER: "local",
        LOCAL_STORAGE_PATH: ".data/evidence",
      }),
    ).toThrow("storage_local_not_allowed_in_production");
  });

  it("accepts complete S3-compatible config", () => {
    expect(
      parseStorageConfig({
        NODE_ENV: "production",
        STORAGE_DRIVER: "s3",
        S3_ENDPOINT: "https://objects.example.test",
        S3_REGION: "ap-northeast-2",
        S3_BUCKET: "private-evidence",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        S3_FORCE_PATH_STYLE: "true",
      }),
    ).toEqual({
      driver: "s3",
      endpoint: "https://objects.example.test",
      region: "ap-northeast-2",
      bucket: "private-evidence",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      forcePathStyle: true,
    });
  });

  it("fails closed when required S3 values are missing", () => {
    expect(() =>
      parseStorageConfig({
        NODE_ENV: "production",
        STORAGE_DRIVER: "s3",
        S3_REGION: "ap-northeast-2",
        S3_BUCKET: "private-evidence",
        S3_ACCESS_KEY_ID: "access-key",
      }),
    ).toThrow("storage_s3_configuration_incomplete");
  });
});
