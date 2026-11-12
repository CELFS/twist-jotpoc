import { nanoid } from "nanoid";
import { getActiveCredential } from "@/platform/credential";
import { authenticatedFetch } from "@/platform/http";
import { generationFailure } from '@/translation/generation-error';
import { activityResponse } from '@/assistant/activity-timeout';
import { saveTranslationVersion, translationVersions } from "./translation-versions-store";
import { getDatabase } from "@/data/database";
import { z } from "zod";
import { readSse } from "@/assistant/sse";
import { ANALYSIS_PROMPT_VERSION, TRANSLATION_PROMPT_VERSION, translationAnalysisInputSchema, translationAnalysisSchema, translationDictionarySchema, translationInputSchema, translationLearningSchema, translationRecordSchema, translationStreamEventSchema, type LocalTranslation, type TranslationInput, type TranslationRecord, type TranslationDictionary, type TranslationAnalysisInput, type TranslationAnalysis, type TranslationLearning } from "@/translation/contracts";
import { cachedTranslationRequest, type TranslationRequestOptions } from "./translation-cache";

export type TranslationGeneration = TranslationInput & TranslationSource & { previousVersionId?: string };
export type TranslationSource = { originalText: string; sourceUrl?: string; pageTitle: string };
export type LocalCursor = Pick<TranslationRecord, "createdAt" | "id">;
export type TranslationClient = {
  history(before?: LocalCursor): Promise<LocalTranslation[]>;
  versions(id: string, before?: number): Promise<LocalTranslation[]>;
  generate(input: TranslationGeneration, options?: TranslationRequestOptions): Promise<LocalTranslation>;
  dictionary(text: string, signal?: AbortSignal): Promise<TranslationDictionary>;
  analyze(input: TranslationAnalysisInput, signal?: AbortSignal, onText?: (text: string) => void, fresh?: boolean): Promise<TranslationAnalysis>;
  enrich(record: LocalTranslation, learning: Partial<TranslationLearning>, signal?: AbortSignal): Promise<LocalTranslation>;
  collect(record: LocalTranslation): Promise<LocalTranslation>;
  remove(id: string): Promise<void>;
};
async function requestResponse(path: string, body?: unknown, signal?: AbortSignal, stream = false) {
  const response = await activityResponse(requestSignal => authenticatedFetch(`/api/extension/translations${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json", ...(stream ? { Accept: "text/event-stream" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: requestSignal,
  }), signal);
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "signedOut" : response.status === 429 ? "rateLimited" : "failed");
  return response;
}
export async function translationRequest(path: string, body?: unknown, signal?: AbortSignal) {
  return (await requestResponse(path, body, signal)).json();
}
export async function saveCollectedAnalysis(id: string, accountId: string, analysis: TranslationAnalysis, signal: AbortSignal): Promise<LocalTranslation> {
  const result = await translationRequest("/analysis/save", { id, accountId, analysis }, signal);
  if (result.accountId !== accountId) throw new Error("signedOut");
  const record = translationRecordSchema.parse(result.record);
  if (record.id !== id) throw new Error("saveFailed");
  const saved = { ...record, savedBy: accountId };
  try {
    const database = getDatabase();
    // Sync only a matching local collection, preserving newer dictionary data and local deletions.
    await database.transaction("rw", database.localTranslations, async () => {
      const current = await database.localTranslations.get(id);
      if (current?.savedBy !== accountId) return;
      await database.localTranslations.update(id, { learning: {
        dictionary: { status: "notRequested" }, ...current.learning, analysis,
      } });
    });
    return saved;
  } catch { return { ...saved, localSaveFailed: true }; }
}
export async function localHistory(before?: LocalCursor) {
  const table = getDatabase().localTranslations;
  return before === undefined ? table.orderBy("[createdAt+id]").reverse().limit(25).toArray()
    : table.where("[createdAt+id]").below([before.createdAt, before.id]).reverse().limit(25).toArray();
}

const WEEK = 7 * 86400000;
export const websiteTranslationClient: TranslationClient = {
  history: localHistory,
  versions: translationVersions,
  async generate(input, options = {}) {
    const owner = getActiveCredential();
    const database = getDatabase();
    const checkOwner = () => {
      const active = getActiveCredential();
      if (!owner || active?.accountId !== owner.accountId || active.accessToken !== owner.accessToken) {
        throw new DOMException("Account changed", "AbortError");
      }
    };
    const { originalText, sourceUrl, pageTitle, previousVersionId, ...raw } = input;
    const parsed = translationInputSchema.parse(raw);
    if (previousVersionId && !await database.localTranslations.get(previousVersionId)) throw new Error("readFailed");
    const { text, model, sourceLanguage, targetLanguage } = parsed;
    const resultSchema = z.object({ translatedText: z.string().trim().min(1).max(30000), model: z.literal(model) });
    const key = JSON.stringify(["translation", TRANSLATION_PROMPT_VERSION, text, sourceLanguage, targetLanguage, model]);
    const result = await cachedTranslationRequest(key, resultSchema, async (signal, progress) => {
      const response = await requestResponse("/stream", parsed, signal);
      let text = "";
      for await (const data of readSse(response)) {
        signal.throwIfAborted();
        const event = translationStreamEventSchema.parse(JSON.parse(data));
        if (event.type === "error") throw generationFailure(event.code);
        if (event.type === "translation_done") return resultSchema.parse(event);
        text += event.text;
        if (text.length > 30000) throw new Error("failed");
        progress(text);
        signal.throwIfAborted();
      }
      throw new Error("responseInterrupted");
    }, WEEK, { ...options, fresh: previousVersionId !== undefined });
    options.signal?.throwIfAborted();
    checkOwner();
    const record = translationRecordSchema.parse({ id: nanoid(), schemaVersion: 1, text, model, sourceLanguage, targetLanguage,
      originalText, sourceUrl, pageTitle, translatedText: result.translatedText, createdAt: Date.now() });
    try { return await saveTranslationVersion(record, previousVersionId, database); } catch { return { ...record, localSaveFailed: true }; }
  },
  async dictionary(text, signal) {
    const word = text.trim().replaceAll("’", "'");
    if (word.length > 80 || !/^[a-z]+(?:['’-][a-z]+)*$/i.test(word)) return { status: "unsupported" };
    const key = JSON.stringify(["dictionary", 1, word.toLowerCase()]);
    return cachedTranslationRequest(key, translationDictionarySchema, async requestSignal =>
      translationDictionarySchema.parse(await translationRequest("/dictionary", { text: word }, requestSignal)),
    value => value.status === "available" ? 86400000 : value.status === "notFound" ? 3600000 : 0, { signal });
  },
  async analyze(input, signal, onText, fresh = false) {
    const parsed = translationAnalysisInputSchema.parse({ ...input, ...(input.sourceLanguage === "zh" ? { bilingual: true } : {}) });
    const key = JSON.stringify(["analysis", ANALYSIS_PROMPT_VERSION, parsed.text, parsed.translatedText, parsed.sourceLanguage, parsed.targetLanguage, parsed.model]);
    const schema = z.object({ model: z.literal(parsed.model), content: translationAnalysisSchema }).strict();
    const result = await cachedTranslationRequest(key, schema, async (requestSignal, progress) => {
      const response = await requestResponse("/analysis", parsed, requestSignal, true);
      for await (const data of readSse(response)) {
        requestSignal.throwIfAborted();
        const event = JSON.parse(data);
        if (event.type === "error") throw generationFailure(event.code);
        if (event.type === "analysis_done") return schema.parse({ model: event.model, content: event.content });
        if (event.type !== "analysis_delta" || typeof event.text !== "string" || event.text.length > 30000) throw new Error("failed");
        progress(event.text);
      }
      throw new Error("responseInterrupted");
    }, WEEK, { signal, onText, fresh });
    return { status: "available", ...result };
  },
  async enrich(record, learning, signal) {
    signal?.throwIfAborted();
    if (record.savedBy && learning.analysis?.status === "available") {
      await saveCollectedAnalysis(record.id, record.savedBy, learning.analysis, signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000));
    }
    const merge = (current: LocalTranslation) => ({ ...current, learning: translationLearningSchema.parse({
      dictionary: { status: "notRequested" }, analysis: { status: "notRequested", model: "qwen" }, ...current.learning, ...learning,
    }) });
    signal?.throwIfAborted();
    const next = merge(record);
    if (record.localSaveFailed) return next;
    try {
      // Update only an existing record: a late enrichment must never resurrect a deleted item.
      const db = getDatabase();
      return await db.transaction("rw", db.localTranslations, async () => {
        const current = await db.localTranslations.get(record.id);
        if (!current) return next;
        signal?.throwIfAborted();
        const merged = merge(current);
        await db.localTranslations.update(record.id, { learning: merged.learning });
        return merged;
      });
    } catch { return { ...next, localSaveFailed: true }; }
  },
  async collect(local) {
    const db = getDatabase();
    const owner = getActiveCredential();
    const record: TranslationRecord = translationRecordSchema.strip().parse(local);
    const result = await translationRequest("/save", record);
    if (!owner || result.accountId !== owner.accountId || getActiveCredential()?.accountId !== owner.accountId ||
      translationRecordSchema.parse(result.record).id !== local.id) throw new Error("saveFailed");
    const saved = { ...record, savedBy: result.accountId as string };
    return db.transaction("rw", db.localTranslations, async () => {
      const current = await db.localTranslations.get(record.id);
      await db.localTranslations.update(record.id, { savedBy: saved.savedBy });
      return { ...(current ?? saved), savedBy: saved.savedBy };
    });
  },
  async remove(id) { await getDatabase().localTranslations.delete(id); },
};
