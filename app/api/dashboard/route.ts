import {
  getDashboardProjection,
  type DashboardProjection,
} from "@/src/repositories/dashboard-repository";
import { resolveApiUser } from "@/src/server/api-auth";
import { apiError, jsonNoStore } from "@/src/server/api-response";

export type DashboardDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  getProjection(input: { ownerUserId: string; today: string }): Promise<DashboardProjection>;
};

const productionDependencies: DashboardDependencies = {
  resolveUser: resolveApiUser,
  getProjection: getDashboardProjection,
};

function serverDateOnly(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function createDashboardResponse(
  request: Request,
  dependencies: DashboardDependencies = productionDependencies,
  today = serverDateOnly(),
) {
  try {
    const user = await dependencies.resolveUser(request);
    if (!user) return apiError("authentication_required", 401);

    const projection = await dependencies.getProjection({ ownerUserId: user.id, today });
    return jsonNoStore(projection);
  } catch {
    return apiError("internal_error", 500);
  }
}

export function GET(request: Request) {
  return createDashboardResponse(request);
}
