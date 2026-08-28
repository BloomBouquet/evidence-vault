import { expect, it } from "vitest";
import { apiError, jsonNoStore, parseJsonBody } from "./api-response";

it("adds no-store to authenticated JSON", async () => {
  const response = jsonNoStore({ ok: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("normalizes malformed JSON", async () => {
  const result = await parseJsonBody(new Request("https://vault.example.com/api/vault-items", {
    method: "POST",
    body: "{",
  }));
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({ error: "invalid_json" });
  }
});

it("does not echo arbitrary details in generic errors", async () => {
  const response = apiError("internal_error", 500);
  expect(await response.text()).toBe('{"error":"internal_error"}');
});
