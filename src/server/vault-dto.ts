import type { VaultItemRecord } from "@/src/repositories/vault-repository";

export function toVaultItemDto(row: VaultItemRecord) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    merchantName: row.merchantName,
    purchaseOrStartDate: row.purchaseOrStartDate,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
