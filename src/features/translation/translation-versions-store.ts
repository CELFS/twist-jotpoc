import { getDatabase } from "@/data/database";
import type { LocalTranslation } from "@/translation/contracts";

export async function saveTranslationVersion(record: LocalTranslation, previousVersionId?: string, db = getDatabase()): Promise<LocalTranslation> {
  return db.transaction("rw", db.localTranslations, async () => {
    const parent = previousVersionId ? await db.localTranslations.get(previousVersionId) : undefined;
    if (previousVersionId && !parent) throw new Error("readFailed");
    const root = parent?.versionRootId ?? parent?.id ?? record.id;
    const latest = await db.localTranslations.where("[versionRootId+version]").between([root, 0], [root, Number.MAX_SAFE_INTEGER], true, true).last();
    const next = { ...record, versionRootId: root, version: Math.max(latest?.version ?? 0, parent?.version ?? 0) + 1, ...(previousVersionId ? { previousVersionId } : {}) };
    await db.localTranslations.add(next);
    return next;
  });
}

export async function translationVersions(id: string, before?: number) {
  const table = getDatabase().localTranslations;
  const parent = await table.get(id);
  if (!parent) return [];
  const root = parent.versionRootId ?? parent.id;
  return table.where("[versionRootId+version]").between([root, 0], [root, before ?? Number.MAX_SAFE_INTEGER], true, before === undefined).reverse().limit(25).toArray();
}
