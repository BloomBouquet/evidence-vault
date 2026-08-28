import { updateEvidenceEventSchema } from "@/src/domain/evidence";
import {
  deleteEvidenceEvent,
  updateEvidenceEvent,
  type EvidenceEventRecord,
} from "@/src/repositories/event-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore, parseJsonBody } from "@/src/server/api-response";

export type EventDetailContext = { params: Promise<{ id: string; eventId: string }> };
export type EventDetailDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  update(input: {
    ownerUserId: string;
    vaultItemId: string;
    eventId: string;
    input: ReturnType<typeof updateEvidenceEventSchema.parse>;
  }): Promise<EvidenceEventRecord | null>;
  delete(input: { ownerUserId: string; vaultItemId: string; eventId: string }): Promise<boolean | null>;
};

const productionDependencies: EventDetailDependencies = {
  resolveUser: resolveApiUser,
  update: updateEvidenceEvent,
  delete: deleteEvidenceEvent,
};

function validationIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message }));
}

function toEventDto(event: EvidenceEventRecord) {
  const { createdByUserId: _createdByUserId, ...safeEvent } = event;
  return safeEvent;
}

export async function createEventDetailResponse(
  request: Request,
  context: EventDetailContext,
  dependencies: EventDetailDependencies = productionDependencies,
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);
    const { id: vaultItemId, eventId } = await context.params;

    if (request.method === "DELETE") {
      const deleted = await dependencies.delete({ ownerUserId: user.id, vaultItemId, eventId });
      if (!deleted) return apiError("not_found", 404);
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }

    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const parsed = updateEvidenceEventSchema.safeParse(parsedBody.value);
    if (!parsed.success) return apiError("validation_failed", 422, validationIssues(parsed.error));

    const event = await dependencies.update({
      ownerUserId: user.id,
      vaultItemId,
      eventId,
      input: parsed.data,
    });
    if (!event) return apiError("not_found", 404);
    return jsonNoStore({ event: toEventDto(event) });
  } catch {
    return apiError("internal_error", 500);
  }
}

export function PATCH(request: Request, context: EventDetailContext) {
  return createEventDetailResponse(request, context);
}

export function DELETE(request: Request, context: EventDetailContext) {
  return createEventDetailResponse(request, context);
}
