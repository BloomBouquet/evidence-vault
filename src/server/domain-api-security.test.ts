import { describe, expect, it, vi } from "vitest";
import {
  createVaultDetailResponse,
  type VaultDetailDependencies,
} from "@/app/api/vault-items/[id]/route";
import {
  createVaultArchiveResponse,
  type VaultArchiveDependencies,
} from "@/app/api/vault-items/[id]/archive/route";
import {
  createDeadlineCollectionResponse,
  type DeadlineCollectionDependencies,
} from "@/app/api/vault-items/[id]/deadlines/route";
import {
  createDeadlineDetailResponse,
  type DeadlineDetailDependencies,
} from "@/app/api/vault-items/[id]/deadlines/[deadlineId]/route";
import {
  createEventCollectionResponse,
  type EventCollectionDependencies,
} from "@/app/api/vault-items/[id]/events/route";
import {
  createEventDetailResponse,
  type EventDetailDependencies,
} from "@/app/api/vault-items/[id]/events/[eventId]/route";

const resolvedUser = { id: "user-a", displayName: "사용자 A" };
const vaultContext = { params: Promise.resolve({ id: "vault-b" }) };
const deadlineDetailContext = { params: Promise.resolve({ id: "vault-b", deadlineId: "deadline-b" }) };
const eventDetailContext = { params: Promise.resolve({ id: "vault-b", eventId: "event-b" }) };

function request(method = "GET", body?: unknown) {
  return new Request("https://vault.example.com/api/security-probe", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectHiddenNotFound(response: Response) {
  const text = await response.text();
  expect(response.status).toBe(404);
  expect(JSON.parse(text)).toEqual({ error: "not_found" });
  expect(text).not.toContain("user-b");
  expect(text).not.toContain("ev_session");
  expect(text).not.toContain("select ");
  expect(text).not.toContain("provider");
}

describe("BE-003 cross-user security gate", () => {
  it("normalizes user-b VaultItem reads, updates, and archive attempts to the same 404", async () => {
    const get = vi.fn(async () => null);
    const update = vi.fn(async () => null);
    const detailDependencies: VaultDetailDependencies = {
      resolveUser: vi.fn(async () => resolvedUser),
      get,
      update,
    };
    const archive = vi.fn(async () => null);
    const archiveDependencies: VaultArchiveDependencies = {
      resolveUser: vi.fn(async () => resolvedUser),
      archive,
    };

    await expectHiddenNotFound(await createVaultDetailResponse(request(), vaultContext, detailDependencies));
    await expectHiddenNotFound(await createVaultDetailResponse(
      request("PATCH", { title: "수정", ownerUserId: "user-b", userId: "user-b" }),
      vaultContext,
      detailDependencies,
    ));
    await expectHiddenNotFound(await createVaultArchiveResponse(request("POST"), vaultContext, archiveDependencies));

    expect(get).toHaveBeenCalledWith({ ownerUserId: "user-a", id: "vault-b" });
    expect(update).toHaveBeenCalledWith({ ownerUserId: "user-a", id: "vault-b", input: { title: "수정" } });
    expect(archive).toHaveBeenCalledWith({ ownerUserId: "user-a", id: "vault-b" });
  });

  it("normalizes user-b Deadline list/create/update/delete attempts and ignores client ownership fields", async () => {
    const list = vi.fn(async () => null);
    const create = vi.fn(async () => null);
    const collectionDependencies: DeadlineCollectionDependencies = {
      resolveUser: vi.fn(async () => resolvedUser),
      list,
      create,
    };
    const update = vi.fn(async () => null);
    const remove = vi.fn(async () => null);
    const detailDependencies: DeadlineDetailDependencies = {
      resolveUser: vi.fn(async () => resolvedUser),
      update,
      delete: remove,
    };

    await expectHiddenNotFound(await createDeadlineCollectionResponse(request(), vaultContext, collectionDependencies));
    await expectHiddenNotFound(await createDeadlineCollectionResponse(
      request("POST", {
        type: "custom",
        dueDate: "2026-08-29",
        sourceType: "user_entered",
        ownerUserId: "user-b",
        userId: "user-b",
      }),
      vaultContext,
      collectionDependencies,
    ));
    await expectHiddenNotFound(await createDeadlineDetailResponse(
      request("PATCH", { sourceNote: "메모", ownerUserId: "user-b", userId: "user-b" }),
      deadlineDetailContext,
      detailDependencies,
    ));
    await expectHiddenNotFound(await createDeadlineDetailResponse(
      request("DELETE"),
      deadlineDetailContext,
      detailDependencies,
    ));

    expect(list).toHaveBeenCalledWith({ ownerUserId: "user-a", vaultItemId: "vault-b" });
    expect(create).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      input: { type: "custom", dueDate: "2026-08-29", sourceType: "user_entered" },
    });
    expect(update).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      deadlineId: "deadline-b",
      input: { sourceNote: "메모" },
    });
    expect(remove).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      deadlineId: "deadline-b",
    });
  });

  it("normalizes user-b Event list/create/update/delete attempts and forces the session owner", async () => {
    const list = vi.fn(async () => null);
    const create = vi.fn(async () => null);
    const collectionDependencies: EventCollectionDependencies = {
      resolveUser: vi.fn(async () => resolvedUser),
      list,
      create,
    };
    const update = vi.fn(async () => null);
    const remove = vi.fn(async () => null);
    const detailDependencies: EventDetailDependencies = {
      resolveUser: vi.fn(async () => resolvedUser),
      update,
      delete: remove,
    };

    await expectHiddenNotFound(await createEventCollectionResponse(request(), vaultContext, collectionDependencies));
    await expectHiddenNotFound(await createEventCollectionResponse(
      request("POST", {
        occurredOn: "2026-08-28",
        eventType: "custom",
        title: "판매자 문의",
        ownerUserId: "user-b",
        userId: "user-b",
        createdByUserId: "user-b",
      }),
      vaultContext,
      collectionDependencies,
    ));
    await expectHiddenNotFound(await createEventDetailResponse(
      request("PATCH", {
        title: "문의 내용 수정",
        ownerUserId: "user-b",
        userId: "user-b",
        createdByUserId: "user-b",
      }),
      eventDetailContext,
      detailDependencies,
    ));
    await expectHiddenNotFound(await createEventDetailResponse(
      request("DELETE"),
      eventDetailContext,
      detailDependencies,
    ));

    expect(list).toHaveBeenCalledWith({ ownerUserId: "user-a", vaultItemId: "vault-b" });
    expect(create).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      input: { occurredOn: "2026-08-28", eventType: "custom", title: "판매자 문의" },
    });
    expect(update).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      eventId: "event-b",
      input: { title: "문의 내용 수정" },
    });
    expect(remove).toHaveBeenCalledWith({
      ownerUserId: "user-a",
      vaultItemId: "vault-b",
      eventId: "event-b",
    });
  });
});
