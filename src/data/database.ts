import Dexie, { type Table } from "dexie";
import type { LocalTranslation, TranslationCacheEntry } from "@/translation/contracts";
import type { MemoSaveInput, NoteSaveInput, VersionedMemo } from "./contracts";
import type { SettingRecord } from "./models";
import { getActiveCredential } from "@/platform/credential";

export type MemoDraft = {
  editable?: boolean;
  key: string;
  dateKey: string;
  title: string;
  content: string;
  baseVersion: number;
  dirty: boolean;
  pending?: MemoSaveInput;
  updatedAt: number;
};
export type NoteDraft = {
  pending?: NoteSaveInput;
  key: string;
  url: string;
  pageTitle: string;
  dateKey: string;
  noteId: string;
  sourcePresetId: string | null;
  content: string;
  expectedNoteVersion: number;
  expectedResourceVersion: number;
  updatedAt: number;
};

class AccountDatabase extends Dexie {
  localTranslations!: Table<LocalTranslation, string>;
  translationCache!: Table<TranslationCacheEntry, string>;
  settings!: Table<SettingRecord, string>;
  memoDrafts!: Table<MemoDraft, string>;
  memoSnapshots!: Table<VersionedMemo & { dateKey: string }, string>;
  noteDrafts!: Table<NoteDraft, string>;

  constructor(accountId: string) {
    super(`jotpoc.account.${accountId}`);
    this.version(1).stores({
      localTranslations: "id, [createdAt+id], [versionRootId+version]",
      translationCache: "key, expiresAt",
      settings: "key",
      memoDrafts: "key, dateKey",
      memoSnapshots: "dateKey",
      noteDrafts: "key, dateKey",
    });
  }
}

const databases = new Map<string, AccountDatabase>();

export function getDatabase() {
  const accountId = getActiveCredential()?.accountId;
  if (!accountId) throw new Error("authorization_required");
  let database = databases.get(accountId);
  if (!database) {
    database = new AccountDatabase(accountId);
    databases.set(accountId, database);
  }
  return database;
}
