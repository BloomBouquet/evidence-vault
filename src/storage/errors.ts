export type StorageErrorCategory = "not_found" | "transient" | "permanent";

export class StorageOperationError extends Error {
  readonly category: StorageErrorCategory;

  constructor(category: StorageErrorCategory) {
    super(`storage_${category}`);
    this.name = "StorageOperationError";
    this.category = category;
  }
}

export function normalizeStorageError(error: unknown): StorageOperationError {
  if (error instanceof StorageOperationError) return error;

  const statusCode =
    typeof error === "object" && error !== null && "$metadata" in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
      : undefined;

  if (statusCode === 404) return new StorageOperationError("not_found");
  if (statusCode && statusCode >= 500) return new StorageOperationError("transient");
  return new StorageOperationError("permanent");
}
