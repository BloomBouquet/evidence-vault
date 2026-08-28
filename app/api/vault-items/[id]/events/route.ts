import { createEvidenceEventSchema } from "@/src/domain/evidence";
import {
  createEvidenceEvent,
  listEvidenceEvents,
  type EvidenceEventRecord,
} from "@/src/repositories/event-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore, parseJsonBody } from "@/src/server/api-response";

export type EventCollectionContext = { params: Promise<{ id: string }> };
export type EventCollectionDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  list(input: { ownerUserId: string; vaultItemId: string }): Promise<EvidenceEventRecord[] | null>;
  create(input: {
    ownerUserId: string;
    vaultItemId: string;
    input: ReturnType<typeof createEvidenceEventSchema.parse>;
  }): Promise<EvidenceEventRecord | null>;
};

const productionDependencies: EventCollectionDependencies = {
  resolveUser: resolveApiUser,
  list: listEvidenceEvents,
  create: createEvidenceEvent,
};

function validationIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
}

function toEventDto(event: EvidenceEventRecord) {
  const { createdByUserId: _createdByUserId, ...safeEvent } = event;
  return safeEvent;
}

export async function createEventCollectionResponse(
  request: Request,
  context: EventCollectionContext,
  dependencies: EventCollectionDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);
    const { id: vaultItemId } = await context.params;

    if (request.method === "POST") {
      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const parsed = createEvidenceEventSchema.safeParse(parsedBody.value);
      if (!parsed.success) return apiError("validation_failed", 422, validationIssues(parsed.error));

      const event = await dependencies.create({ ownerUserId: user.id, vaultItemId, input: parsed.data });
      if (!event) return apiError("not_found", 404);
      return jsonNoStore({ event: toEventDto(event) }, { status: 201 });
    }

    const events = await dependencies.list({ ownerUserId: user.id, vaultItemId });
    if (!events) return apiError("not_found", 404);
    return jsonNoStore({ events: events.map(toEventDto) });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function GET(request: Request, context: EventCollectionContext) {
  return createEventCollectionResponse(request, context);
}

export function POST(request: Request, context: EventCollectionContext) {
  return createEventCollectionResponse(request, context);
}
