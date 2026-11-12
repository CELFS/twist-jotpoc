import { z } from "zod";
import { extensionInkAnchorSchema } from "./contracts";

export const collectionKindSchema = z.enum(["word", "phrase", "sentence"]);
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{21}$/);
const urlSchema = z.string().max(4096).url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
});
export const collectionItemSchema = z.object({
  id: idSchema,
  url: urlSchema,
  pageTitle: z.string().trim().max(500),
  anchor: extensionInkAnchorSchema,
  domain: z.literal("en"),
  kind: collectionKindSchema,
  text: z.string().trim().min(1).max(10000).optional(),
  note: z.string().max(10000).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict().refine((item) => item.updatedAt >= item.createdAt);
export const collectionContextSchema = z.object({ url: urlSchema }).strict();
export const collectionPutSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  annotation: collectionItemSchema,
}).strict();
export const collectionDeleteSchema = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  annotationId: idSchema,
  url: urlSchema,
  updatedAt: z.number().int().nonnegative(),
}).strict();
export type CollectionItem = z.infer<typeof collectionItemSchema> & { urlKey: string };

export const collectionManageSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("update"), id: idSchema, expectedUpdatedAt: z.number().int().nonnegative(),
    kind: collectionKindSchema, text: z.string().trim().min(1).max(10000), note: z.string().max(10000) }).strict(),
  z.object({ operation: z.literal("delete"), id: idSchema, expectedUpdatedAt: z.number().int().nonnegative() }).strict(),
]);
