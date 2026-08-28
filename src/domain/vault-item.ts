import { z } from "zod";
import { dateOnlySchema } from "./date";

export const VAULT_CATEGORIES = [
  "online_purchase",
  "subscription",
  "rental",
  "membership",
  "used_goods",
  "warranty_service",
  "other",
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

const optionalMerchantNameSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).max(120).optional(),
);

export const createVaultItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(VAULT_CATEGORIES),
  merchantName: optionalMerchantNameSchema,
  purchaseOrStartDate: dateOnlySchema,
  amount: z.number().int().nonnegative().max(9_999_999_999).optional(),
  currency: z.literal("KRW").default("KRW"),
  description: z.string().trim().max(2000).optional(),
});

export const updateVaultItemSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  category: z.enum(VAULT_CATEGORIES).optional(),
  merchantName: z.string().trim().min(1).max(120).nullable().optional(),
  purchaseOrStartDate: dateOnlySchema.optional(),
  amount: z.number().int().nonnegative().max(9_999_999_999).nullable().optional(),
  currency: z.literal("KRW").optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "empty_update");

export type CreateVaultItemInput = z.infer<typeof createVaultItemSchema>;
export type UpdateVaultItemInput = z.infer<typeof updateVaultItemSchema>;
