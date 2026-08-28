import { describe, expect, it } from "vitest";
import { createVaultItemSchema, updateVaultItemSchema } from "./vault-item";

const base = {
  title: "노트북 구매",
  category: "online_purchase" as const,
  purchaseOrStartDate: "2026-08-28",
};

describe("VaultItem input contracts", () => {
  it("allows merchantName to be omitted on create", () => {
    expect(createVaultItemSchema.parse(base).merchantName).toBeUndefined();
  });

  it("normalizes blank optional merchant name to absence", () => {
    expect(createVaultItemSchema.parse({ ...base, merchantName: "   " }).merchantName).toBeUndefined();
  });

  it("allows nullable optional fields on update", () => {
    expect(updateVaultItemSchema.parse({ merchantName: null, amount: null, description: null }))
      .toEqual({ merchantName: null, amount: null, description: null });
  });

  it("rejects an empty update", () => {
    expect(updateVaultItemSchema.safeParse({}).success).toBe(false);
  });
});
