import { createVaultItemSchema } from "@/src/domain/vault-item";
import {
  createVaultItem,
  listVaultItems,
  type VaultItemRecord,
} from "@/src/repositories/vault-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore, parseJsonBody } from "@/src/server/api-response";
import { toVaultItemDto } from "@/src/server/vault-dto";

export type ApiUser = { id: string; displayName: string };

export type VaultCollectionDependencies = {
  resolveUser(request: Request): Promise<ApiUser | null>;
  list(input: { ownerUserId: string }): Promise<VaultItemRecord[]>;
  create(input: { ownerUserId: string; input: ReturnType<typeof createVaultItemSchema.parse> }): Promise<VaultItemRecord>;
};

const productionDependencies: VaultCollectionDependencies = {
  resolveUser: resolveApiUser,
  list: listVaultItems,
  create: createVaultItem,
};

function validationIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
}

export async function createVaultCollectionResponse(
  request: Request,
  dependencies: VaultCollectionDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);

    if (request.method === "POST") {
      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;

      const parsed = createVaultItemSchema.safeParse(parsedBody.value);
      if (!parsed.success) {
        return apiError("validation_failed", 422, validationIssues(parsed.error));
      }

      const item = await dependencies.create({ ownerUserId: user.id, input: parsed.data });
      return jsonNoStore({ item: toVaultItemDto(item) }, { status: 201 });
    }

    const items = await dependencies.list({ ownerUserId: user.id });
    return jsonNoStore({ items: items.map(toVaultItemDto) });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function GET(request: Request) {
  return createVaultCollectionResponse(request);
}

export function POST(request: Request) {
  return createVaultCollectionResponse(request);
}
