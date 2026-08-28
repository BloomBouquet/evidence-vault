import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "invalid_json"
  | "authentication_required"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "internal_error";

export function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

export function apiError(
  error: ApiErrorCode,
  status: number,
  issues?: unknown,
) {
  return jsonNoStore(issues === undefined ? { error } : { error, issues }, { status });
}

export async function parseJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() as unknown };
  } catch {
    return { ok: false as const, response: apiError("invalid_json", 400) };
  }
}
