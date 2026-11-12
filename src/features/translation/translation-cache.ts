import type { z } from "zod";
import { getDatabase } from "@/data/database";

export type TranslationRequestOptions = { signal?: AbortSignal; fresh?: boolean; onText?: (text: string) => void };
type Subscriber = { onText?: (text: string) => void };
type Pending = { controller: AbortController; subscribers: Set<Subscriber>; text: string; result: Promise<unknown> };
const pending = new Map<string, Pending>();
const MAX_CACHE_ENTRIES = 256;

async function writeCache(db: ReturnType<typeof getDatabase>, key: string, value: unknown, ttl: number, signal: AbortSignal) {
  if (ttl <= 0 || signal.aborted) return;
  await db.transaction("rw", db.translationCache, async () => {
    if (signal.aborted) return;
    await db.translationCache.where("expiresAt").belowOrEqual(Date.now()).delete();
    await db.translationCache.put({ key, value, expiresAt: Date.now() + ttl });
    const excess = await db.translationCache.count() - MAX_CACHE_ENTRIES;
    if (excess > 0) {
      const keys = await db.translationCache.orderBy("expiresAt").limit(excess).primaryKeys();
      await db.translationCache.bulkDelete(keys);
    }
  });
}

// Subscribers share upstream work, but one cancelled view must not cancel another view's request.
export async function cachedTranslationRequest<T>(key: string, schema: z.ZodType<T>,
  load: (signal: AbortSignal, progress: (text: string) => void) => Promise<T>,
  ttl: number | ((value: T) => number), options: TranslationRequestOptions = {}): Promise<T> {
  options.signal?.throwIfAborted();
  const database = getDatabase();
  const pendingKey = database.name + ":" + key;
  let task = options.fresh ? undefined : pending.get(pendingKey);
  if (!task) {
    const controller = new AbortController();
    const next: Pending = { controller, subscribers: new Set(), text: "", result: Promise.resolve() };
    next.result = (async () => {
      // Cache availability never decides whether a successful translation is usable.
      const cached = options.fresh ? undefined : await database.translationCache.get(key).catch(() => undefined);
      controller.signal.throwIfAborted();
      const parsed = schema.safeParse(cached?.value);
      if (cached && cached.expiresAt > Date.now() && parsed.success) return parsed.data;
      const value = schema.parse(await load(controller.signal, text => {
        next.text = text;
        for (const subscriber of next.subscribers) subscriber.onText?.(text);
      }));
      controller.signal.throwIfAborted();
      await writeCache(database, key, value, typeof ttl === "function" ? ttl(value) : ttl, controller.signal).catch(() => undefined);
      return value;
    })().finally(() => { if (pending.get(pendingKey) === next) pending.delete(pendingKey); });
    task = next;
    pending.set(pendingKey, task);
  }
  const active = task;
  const subscriber: Subscriber = { onText: options.onText };
  active.subscribers.add(subscriber);
  if (active.text) options.onText?.(active.text);
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const release = () => {
      finished = true;
      options.signal?.removeEventListener("abort", abort);
      active.subscribers.delete(subscriber);
    };
    const abort = () => {
      if (finished) return;
      release();
      if (!active.subscribers.size) {
        active.controller.abort();
        if (pending.get(pendingKey) === active) pending.delete(pendingKey);
      }
      reject(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    active.result.then(value => { if (!finished) { release(); resolve(value as T); } }, error => { if (!finished) { release(); reject(error); } });
    if (options.signal?.aborted) abort();
  });
}
