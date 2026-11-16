import { z } from "zod";
import { authenticatedFetch, jsonRequest, readJson, ApiError } from "@/platform/http";
import { getActiveCredential } from "@/platform/credential";
import { memoSchema, sourceSchema, cloudNoteSchema, noteContextSchema, type MemoSaveInput, type NoteSaveInput } from "./contracts";
import type { WebResourceRecord } from "./models";

export async function getApi<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const owner = getActiveCredential();
  const result = schema.parse(await readJson(await authenticatedFetch(`/api/extension/${path}`, { signal })));
  if (getActiveCredential() !== owner) throw new DOMException("Account changed", "AbortError");
  return result;
}

export async function postApi<T>(path: string, body: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const owner = getActiveCredential();
  const result = schema.parse(await readJson(await authenticatedFetch(`/api/extension/${path}`, jsonRequest(body, signal))));
  if (getActiveCredential() !== owner) throw new DOMException("Account changed", "AbortError");
  return result;
}

const resources = new Map<string, WebResourceRecord>();
function resourceKey(id: string) {
  return `${getActiveCredential()?.accountId}:${id}`;
}

export const cloudApi = {
  memo: {
    read: (dateKey: string, signal?: AbortSignal) => getApi(`daily-memos/detail?dateKey=${encodeURIComponent(dateKey)}`,
      z.object({ memo: memoSchema.nullable(), dailyMemoEditable: z.boolean() }), signal),
    history: (signal?: AbortSignal) => getApi("daily-memos", z.object({ memos: z.array(z.object({
      id: z.string(), dateKey: z.string(), title: z.string(), preview: z.string(), updatedAt: z.number(),
    })) }), signal),
    save: (input: MemoSaveInput) => postApi("daily-memos/save", input, z.object({ memo: memoSchema })),
  },
  sources: () => getApi("sources", z.object({ sources: z.array(sourceSchema) })),
  note: {
    async detail(id: string, signal?: AbortSignal) {
      const owner = getActiveCredential();
      const result = await getApi(`source-notes/detail?id=${encodeURIComponent(id)}`,
        z.object({ note: cloudNoteSchema.nullable() }), signal);
      if (getActiveCredential() !== owner) throw new DOMException("Account changed", "AbortError");
      if (result.note) resources.set(resourceKey(result.note.resource.id), result.note.resource);
      return result.note;
    },
    async summaries(cursor?: string, signal?: AbortSignal) {
      const owner = getActiveCredential();
      const query = new URLSearchParams({ view: "summary", limit: "30" });
      if (cursor) query.set("cursor", cursor);
      const response = await authenticatedFetch(`/api/extension/source-notes?${query}`, { signal });
      const page = z.object({ notes: z.array(z.object({
        id: z.string(), url: z.string(), pageTitle: z.string(), customTitle: z.string().nullish(), dateKey: z.string(), summary: z.string(),
      })), nextCursor: z.string().nullable() }).parse(await readJson(response));
      if (getActiveCredential() !== owner) throw new DOMException("Account changed", "AbortError");
      return { ...page, resourceVersion: response.headers.get("X-Resource-Version") };
    },
    list: (cursor?: string, signal?: AbortSignal) => getApi(`source-notes?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      z.object({ notes: z.array(cloudNoteSchema), nextCursor: z.string().nullable() }), signal),
    context: (url: string, dateKey: string, signal?: AbortSignal) => getApi(
      `source-notes/context?${new URLSearchParams({ url, dateKey })}`, noteContextSchema, signal),
    save: (input: NoteSaveInput) => postApi("source-notes/save", input, noteContextSchema),
    remove: (input: { operationId: string; noteId: string; url: string; dateKey: string; expectedNoteVersion: number }) =>
      postApi("source-notes/delete", input, noteContextSchema),
  },
};

export function readCachedResource(id: string) {
  const resource = resources.get(resourceKey(id));
  if (!resource) throw new ApiError("unavailable");
  return resource;
}
