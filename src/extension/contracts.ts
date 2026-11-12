import { z } from "zod";

export const extensionInstallationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export const extensionDeviceCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{48}$/);
export const extensionUserCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);

export const extensionStartRequestSchema = z.object({
  installationId: extensionInstallationIdSchema,
  clientName: z.enum(["Twill", "JotPoc"]),
  clientVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
}).strict();

export const extensionTokenRequestSchema = z.object({
  deviceCode: extensionDeviceCodeSchema,
}).strict();

export const extensionAuthorizationRequestSchema = z.object({
  userCode: extensionUserCodeSchema,
}).strict();

export const extensionDeviceRevokeRequestSchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
}).strict();

export const extensionDevicePermissionsRequestSchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  dailyMemoEditEnabled: z.boolean(),
}).strict();

const extensionWebUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  });
const extensionDateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const extensionSourceNoteIdSchema = z.string().regex(/^[A-Za-z0-9_-]{21}$/);
const extensionInkLineStyleSchema = z.enum(["highlight", "underline", "wavy"]);
const extensionInkColorSchema = z.enum(["red", "purple", "blue", "green", "yellow"]);

export const extensionInkAnchorSchema = z.object({
  exact: z.string().min(1).max(10000),
  prefix: z.string().max(128),
  suffix: z.string().max(128),
  textStart: z.number().int().nonnegative().max(10000000),
  textEnd: z.number().int().positive().max(10000000),
  startPath: z.array(z.number().int().nonnegative().max(1000000)).max(64),
  startOffset: z.number().int().nonnegative().max(10000000),
  endPath: z.array(z.number().int().nonnegative().max(1000000)).max(64),
  endOffset: z.number().int().nonnegative().max(10000000),
}).strict().refine((anchor) => anchor.textEnd > anchor.textStart, {
  message: "ink_anchor_range_is_invalid",
});

export const extensionInkAnnotationContextRequestSchema = z.object({
  url: extensionWebUrlSchema,
}).strict();

export const extensionInkAnnotationPutRequestSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  annotation: z.object({
    id: extensionSourceNoteIdSchema,
    url: extensionWebUrlSchema,
    pageTitle: z.string().trim().max(500),
    anchor: extensionInkAnchorSchema,
    lineStyle: extensionInkLineStyleSchema,
    color: extensionInkColorSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  }).strict().refine((annotation) => annotation.updatedAt >= annotation.createdAt, {
    message: "ink_annotation_timestamps_are_invalid",
  }),
}).strict();

export const extensionInkAnnotationDeleteRequestSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  annotationId: extensionSourceNoteIdSchema,
  url: extensionWebUrlSchema,
  updatedAt: z.number().int().nonnegative(),
}).strict();

export const extensionSourceNoteContextRequestSchema = z.object({
  notesCursor: z.string().max(200).optional(),
  dailyNotesCursor: z.string().max(200).optional(),
  url: extensionWebUrlSchema,
  dateKey: extensionDateKeySchema,
}).strict();

export const extensionSourceNoteSaveRequestSchema = z.object({
  inkStyle: z.object({ lineStyle: extensionInkLineStyleSchema, color: extensionInkColorSchema }).strict().optional(),
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  noteId: extensionSourceNoteIdSchema,
  url: extensionWebUrlSchema,
  pageTitle: z.string().trim().max(500),
  dateKey: extensionDateKeySchema,
  content: z.string().max(100000).refine((value) => value.trim().length > 0),
  sourcePresetId: z.string().uuid().nullable(),
  expectedResourceVersion: z.number().int().nonnegative(),
  expectedNoteVersion: z.number().int().nonnegative(),
  // Accepted for existing Twill clients; saving a note no longer writes a memo.
  expectedDailyMemoVersion: z.number().int().nonnegative().optional(),
}).strict();

export const extensionSourceNoteDeleteRequestSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  noteId: extensionSourceNoteIdSchema,
  url: extensionWebUrlSchema,
  dateKey: extensionDateKeySchema,
  expectedNoteVersion: z.number().int().nonnegative(),
}).strict();

export const extensionSourceNoteAppendRequestSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  noteId: extensionSourceNoteIdSchema,
  url: extensionWebUrlSchema,
  pageTitle: z.string().trim().max(500),
  dateKey: extensionDateKeySchema,
  content: z.string().max(100000).refine((value) => value.trim().length > 0),
}).strict();

export const extensionDailyMemoSaveRequestSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  dateKey: extensionDateKeySchema,
  title: z.string().max(120),
  content: z.string().max(100000),
  expectedVersion: z.number().int().nonnegative(),
}).strict();

export const extensionErrorSchema = z.enum([
  "invalid_request",
  "authorization_pending",
  "authorization_denied",
  "authorization_expired",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "conflict",
  "unavailable",
]);
export type ExtensionErrorCode = z.infer<typeof extensionErrorSchema>;

export class ExtensionError extends Error {
  constructor(readonly code: ExtensionErrorCode, readonly retryAfter = 0) {
    super(code);
    this.name = "ExtensionError";
  }
}
