import { updateVaultItemSchema } from "@/src/domain/vault-item";
import {
  getVaultItem,
  updateVaultItem,
  type VaultItemRecord,
} from "@/src/repositories/vault-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore, parseJsonBody } from "@/src/server/api-response";
import { toVaultItemDto } from "@/src/server/vault-dto";

export type VaultRouteContext = { params: Promise<{ id: string }> };
export type VaultDetailDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  get(input: { ownerUserId: string; id: string }): Promise<VaultItemRecord | null>;
  update(input: {
    ownerUserId: string;
    id: string;
    input: ReturnType<typeof updateVaultItemSchema.parse>;
  }): Promise<VaultItemRecord | null>;
};

const productionDependencies: VaultDetailDependencies = {
  resolveUser: resolveApiUser,
  get: getVaultItem,
  update: updateVaultItem,
};

function validationIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
}

export async function createVaultDetailResponse(
  request: Request,
  context: VaultRouteContext,
  dependencies: VaultDetailDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);

    const { id } = await context.params;

    if (request.method === "PATCH") {
      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;

      const parsed = updateVaultItemSchema.safeParse(parsedBody.value);
      if (!parsed.success) {
        return apiError("validation_failed", 422, validationIssues(parsed.error));
      }

      const item = await dependencies.update({ ownerUserId: user.id, id, input: parsed.data });
      if (!item) return apiError("not_found", 404);
      return jsonNoStore({ item: toVaultItemDto(item) });
    }

    const item = await dependencies.get({ ownerUserId: user.id, id });
    if (!item) return apiError("not_found", 404);
    return jsonNoStore({ item: toVaultItemDto(item) });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function GET(request: Request, context: VaultRouteContext) {
  return createVaultDetailResponse(request, context);
}

export function PATCH(request: Request, context: VaultRouteContext) {
  return createVaultDetailResponse(request, context);
}
