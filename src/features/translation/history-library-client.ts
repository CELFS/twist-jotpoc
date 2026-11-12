import { z } from "zod";
import { getDatabase } from "@/data/database";
import { getActiveCredential } from "@/platform/credential";
import { translationCursorSchema, translationRecordSchema, translationSummarySchema, type LocalTranslation, type TranslationSummary } from "@/translation/contracts";
import { localHistory, translationRequest } from "./translation-client";

export type HistoryRow = TranslationSummary & { savedBy?: string };
export type Cursor = z.infer<typeof translationCursorSchema>;
const pageSchema = z.object({ accountId: z.string(), items: z.array(translationSummarySchema), nextCursor: translationCursorSchema.nullable() });

function checkOwner(accountId: string) {
  if (getActiveCredential()?.accountId !== accountId) throw new Error("signedOut");
}

export async function historyPage(accountId: string, before?: Cursor) {
  checkOwner(accountId);
  const [local, cloud] = await Promise.all([localHistory(before),
    translationRequest(before ? `?cursor=${encodeURIComponent(JSON.stringify(before))}` : "")
      .then(result => pageSchema.parse(result)).catch(() => null)]);
  checkOwner(accountId);
  if (cloud && cloud.accountId !== accountId) throw new Error("signedOut");
  const byId = new Map<string, HistoryRow>();
  for (const row of local) byId.set(row.id, { ...row, savedBy: undefined });
  for (const row of cloud?.items ?? []) byId.set(row.id, { ...row, ...byId.get(row.id), savedBy: accountId });
  const rows = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
  return { rows: rows.slice(0, 25), more: rows.length > 25 || local.length === 25 || Boolean(cloud?.nextCursor), cloudUnavailable: !cloud };
}

export async function historyDetail(accountId: string, row: HistoryRow): Promise<LocalTranslation> {
  checkOwner(accountId);
  if (!row.savedBy) {
    const record = await getDatabase().localTranslations.get(row.id);
    checkOwner(accountId);
    if (!record) throw new Error("readFailed");
    return { ...record, savedBy: undefined };
  }
  const result = await translationRequest(`/detail?id=${encodeURIComponent(row.id)}`);
  checkOwner(accountId);
  const record = translationRecordSchema.parse(result.record);
  if (result.accountId !== accountId || record.id !== row.id) throw new Error("readFailed");
  return { ...record, savedBy: accountId };
}

export async function removeHistoryRow(accountId: string, row: HistoryRow) {
  checkOwner(accountId);
  const database = getDatabase();
  const record = await historyDetail(accountId, row);
  checkOwner(accountId);
  if (!row.savedBy) {
    await database.localTranslations.delete(row.id);
    return record;
  }
  // Preserve the full record locally before removing a cloud-only collection.
  await database.transaction("rw", database.localTranslations, async () => {
    const existing = await database.localTranslations.get(row.id);
    await database.localTranslations.put({ ...record, ...existing, savedBy: accountId });
  });
  checkOwner(accountId);
  const result = await translationRequest("/delete", { id: row.id });
  checkOwner(accountId);
  if (result.accountId !== accountId || result.ok !== true) throw new Error("deleteFailed");
  await database.localTranslations.update(row.id, { savedBy: undefined });
  return { ...record, savedBy: undefined };
}
