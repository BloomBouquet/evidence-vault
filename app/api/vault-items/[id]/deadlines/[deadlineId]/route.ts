import { updateDeadlineSchema } from "@/src/domain/deadline";
import {
  deleteDeadline,
  updateDeadline,
  type DeadlineRecord,
} from "@/src/repositories/deadline-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore, parseJsonBody } from "@/src/server/api-response";

export type DeadlineDetailContext = { params: Promise<{ id: string; deadlineId: string }> };
export type DeadlineDetailDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  update(input: {
    ownerUserId: string;
    vaultItemId: string;
    deadlineId: string;
    input: ReturnType<typeof updateDeadlineSchema.parse>;
  }): Promise<DeadlineRecord | null>;
  delete(input: { ownerUserId: string; vaultItemId: string; deadlineId: string }): Promise<boolean | null>;
};

const productionDependencies: DeadlineDetailDependencies = {
  resolveUser: resolveApiUser,
  update: updateDeadline,
  delete: deleteDeadline,
};

function validationIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
}

export async function createDeadlineDetailResponse(
  request: Request,
  context: DeadlineDetailContext,
  dependencies: DeadlineDetailDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);
    const { id: vaultItemId, deadlineId } = await context.params;

    if (request.method === "DELETE") {
      const deleted = await dependencies.delete({ ownerUserId: user.id, vaultItemId, deadlineId });
      if (!deleted) return apiError("not_found", 404);
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }

    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const parsed = updateDeadlineSchema.safeParse(parsedBody.value);
    if (!parsed.success) return apiError("validation_failed", 422, validationIssues(parsed.error));

    const deadline = await dependencies.update({
      ownerUserId: user.id,
      vaultItemId,
      deadlineId,
      input: parsed.data,
    });
    if (!deadline) return apiError("not_found", 404);
    return jsonNoStore({ deadline });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function PATCH(request: Request, context: DeadlineDetailContext) {
  return createDeadlineDetailResponse(request, context);
}

export function DELETE(request: Request, context: DeadlineDetailContext) {
  return createDeadlineDetailResponse(request, context);
}
