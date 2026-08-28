import { createDeadlineSchema } from "@/src/domain/deadline";
import {
  createDeadline,
  listDeadlines,
  type DeadlineRecord,
} from "@/src/repositories/deadline-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore, parseJsonBody } from "@/src/server/api-response";

export type DeadlineCollectionContext = { params: Promise<{ id: string }> };
export type DeadlineCollectionDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  list(input: { ownerUserId: string; vaultItemId: string }): Promise<DeadlineRecord[] | null>;
  create(input: {
    ownerUserId: string;
    vaultItemId: string;
    input: ReturnType<typeof createDeadlineSchema.parse>;
  }): Promise<DeadlineRecord | null>;
};

const productionDependencies: DeadlineCollectionDependencies = {
  resolveUser: resolveApiUser,
  list: listDeadlines,
  create: createDeadline,
};

function validationIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
}

export async function createDeadlineCollectionResponse(
  request: Request,
  context: DeadlineCollectionContext,
  dependencies: DeadlineCollectionDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);
    const { id: vaultItemId } = await context.params;

    if (request.method === "POST") {
      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const parsed = createDeadlineSchema.safeParse(parsedBody.value);
      if (!parsed.success) return apiError("validation_failed", 422, validationIssues(parsed.error));

      const deadline = await dependencies.create({ ownerUserId: user.id, vaultItemId, input: parsed.data });
      if (!deadline) return apiError("not_found", 404);
      return jsonNoStore({ deadline }, { status: 201 });
    }

    const deadlines = await dependencies.list({ ownerUserId: user.id, vaultItemId });
    if (!deadlines) return apiError("not_found", 404);
    return jsonNoStore({ deadlines });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function GET(request: Request, context: DeadlineCollectionContext) {
  return createDeadlineCollectionResponse(request, context);
}

export function POST(request: Request, context: DeadlineCollectionContext) {
  return createDeadlineCollectionResponse(request, context);
}
