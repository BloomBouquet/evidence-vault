import { expectTypeOf, test } from "vitest";
import { getCase } from "./case-repository";
import { getDashboardProjection } from "./dashboard-repository";
import { updateDeadline } from "./deadline-repository";
import { getEvidenceFile } from "./evidence-repository";
import { updateEvidenceEvent } from "./event-repository";
import { getExportPacket } from "./export-repository";
import { archiveVaultItem, getVaultItem, updateVaultItem } from "./vault-repository";

test("user-owned repository reads require ownerUserId and resource id together", () => {
  expectTypeOf(getVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
  expectTypeOf(getEvidenceFile).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
  expectTypeOf(getCase).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
  expectTypeOf(getExportPacket).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
});

test("BE-003 mutations and dashboard reads keep ownership in their public contracts", () => {
  expectTypeOf(updateVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
  expectTypeOf(archiveVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
  expectTypeOf(updateDeadline).parameter(0).toMatchTypeOf<{
    ownerUserId: string;
    vaultItemId: string;
    deadlineId: string;
  }>();
  expectTypeOf(updateEvidenceEvent).parameter(0).toMatchTypeOf<{
    ownerUserId: string;
    vaultItemId: string;
    eventId: string;
  }>();
  expectTypeOf(getDashboardProjection).parameter(0).toMatchTypeOf<{ ownerUserId: string; today: string }>();
});
