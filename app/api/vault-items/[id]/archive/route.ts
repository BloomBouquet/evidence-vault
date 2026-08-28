import {
  archiveVaultItem,
  type VaultItemRecord,
} from "@/src/repositories/vault-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore } from "@/src/server/api-response";
import { toVaultItemDto } from "@/src/server/vault-dto";

export type VaultArchiveContext = { params: Promise<{ id: string }> };
export type VaultArchiveDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  archive(input: { ownerUserId: string; id: string }): Promise<VaultItemRecord | null>;
};

const productionDependencies: VaultArchiveDependencies = {
  resolveUser: resolveApiUser,
  archive: archiveVaultItem,
};

export async function createVaultArchiveResponse(
  request: Request,
  context: VaultArchiveContext,
  dependencies: VaultArchiveDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);

    const { id } = await context.params;
    const item = await dependencies.archive({ ownerUserId: user.id, id });
    if (!item) return apiError("not_found", 404);

    return jsonNoStore({ item: toVaultItemDto(item) });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function POST(request: Request, context: VaultArchiveContext) {
  return createVaultArchiveResponse(request, context);
}
