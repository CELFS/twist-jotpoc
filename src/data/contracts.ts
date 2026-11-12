import { z } from "zod";

export const memoRecordSchema = z.object({
  id: z.string(), dateKey: z.string(), title: z.string(), content: z.string(),
  createdAt: z.number(), updatedAt: z.number(),
});
export const memoSchema = z.object({ record: memoRecordSchema, version: z.number().int().nonnegative() });
export type VersionedMemo = z.infer<typeof memoSchema>;
export const sourceSchema = z.object({ id: z.string(), name: z.string(), color: z.string() });
export const resourceSchema = z.object({
  id: z.string(), url: z.string(), urlKey: z.string(), pageTitle: z.string(),
  customTitle: z.string().optional(), createdAt: z.number(), updatedAt: z.number(),
});
export const noteRecordSchema = z.object({
  id: z.string(), webResourceId: z.string(), dateKey: z.string(), sourcePresetId: z.string().nullable(),
  sourceNameSnapshot: z.string().nullable(), content: z.string(), createdAt: z.number(), updatedAt: z.number(),
  ink: z.object({
    color: z.enum(["red", "purple", "blue", "green", "yellow"]),
    lineStyle: z.enum(["highlight", "underline", "wavy"]),
  }).passthrough().optional(),
});
export const cloudNoteSchema = z.object({
  record: noteRecordSchema, version: z.number().int().nonnegative(),
  resource: resourceSchema, linkedToDailyMemo: z.boolean(),
});
export type CloudNote = z.infer<typeof cloudNoteSchema>;
export const noteContextSchema = z.object({
  resource: z.object({ record: resourceSchema, version: z.number() }).nullable(),
  notes: z.array(z.object({ record: noteRecordSchema, version: z.number(), linkedToDailyMemo: z.boolean() })),
  dailyMemo: z.object({ id: z.string(), title: z.string(), content: z.string(), version: z.number() }).nullable(),
  dailyNotes: z.array(cloudNoteSchema),
  dailyMemoEditable: z.boolean(), writable: z.boolean(),
  notesNextCursor: z.string().nullable().optional(), dailyNotesNextCursor: z.string().nullable().optional(),
});
export type NoteContext = z.infer<typeof noteContextSchema>;
export type MemoSaveInput = { operationId: string; dateKey: string; title: string; content: string; expectedVersion: number };
export type NoteSaveInput = {
  operationId: string; noteId: string; url: string; pageTitle: string; dateKey: string;
  content: string; sourcePresetId: string | null; expectedResourceVersion: number; expectedNoteVersion: number;
};
