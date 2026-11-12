import { useSyncExternalStore } from "react";
import { nanoid } from "nanoid";
import { cloudApi } from "@/data/cloud-api";
import { getDatabase, type MemoDraft } from "@/data/database";
import type { MemoSaveInput, VersionedMemo } from "@/data/contracts";
import { getActiveCredential } from "@/platform/credential";
import { ApiError } from "@/platform/http";
import { publishDataChange } from "@/data/change-bus";

type MemoState = {
  ready: boolean;
  title: string;
  content: string;
  baseVersion: number;
  dirty: boolean;
  saving: boolean;
  editable: boolean;
  error: string | null;
  conflict: { memo: VersionedMemo | null } | null;
  pending?: MemoSaveInput;
};

export class MemoController {
  private state: MemoState = {
    ready: false, title: "", content: "", baseVersion: 0, dirty: false,
    saving: false, editable: false, error: null, conflict: null,
  };
  private listeners = new Set<() => void>();
  private database = getDatabase();
  private writeQueue: Promise<unknown> = Promise.resolve();
  private initialization: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private composing = false;

  constructor(readonly accountId: string, readonly dateKey: string) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(patch: Partial<MemoState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private assertAccount() {
    if (getActiveCredential()?.accountId !== this.accountId) {
      throw new DOMException("Account changed", "AbortError");
    }
  }

  private persist() {
    const snapshot = this.state;
    const draft: MemoDraft = {
      key: this.dateKey, dateKey: this.dateKey, editable: snapshot.editable,
      title: snapshot.title, content: snapshot.content, baseVersion: snapshot.baseVersion,
      dirty: snapshot.dirty, pending: snapshot.pending, updatedAt: Date.now(),
    };
    // Serialize local writes so a delayed earlier edit cannot replace a later one.
    const operation = this.writeQueue.catch(() => undefined).then(() => this.database.memoDrafts.put(draft));
    this.writeQueue = operation;
    return operation;
  }

  load = (): Promise<void> => {
    if (this.state.ready) return this.refresh();
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        const draft = await this.database.memoDrafts.get(this.dateKey);
        if (draft) this.publish({ title: draft.title, content: draft.content, baseVersion: draft.baseVersion,
          dirty: draft.dirty, pending: draft.pending, editable: draft.editable === true });
        this.assertAccount();
        const result = await cloudApi.memo.read(this.dateKey);
        const remote = result.memo;
        const version = remote?.version ?? 0;
        if (draft?.dirty) {
          const acknowledged = draft.pending && remote &&
            remote.record.title === draft.pending.title && remote.record.content === draft.pending.content;
          const editedAfterSubmission = draft.pending &&
            (draft.title !== draft.pending.title || draft.content !== draft.pending.content);
          this.publish({
            ready: true, editable: result.dailyMemoEditable,
            ...(acknowledged ? { baseVersion: version, pending: undefined, dirty: Boolean(editedAfterSubmission) } : {}),
            conflict: !acknowledged && version !== draft.baseVersion ? { memo: remote } : null,
            error: !acknowledged && version !== draft.baseVersion ? "conflict" : null,
          });
        } else {
          this.publish({ ready: true, editable: result.dailyMemoEditable,
            title: remote?.record.title ?? "", content: remote?.record.content ?? "",
            baseVersion: version, dirty: false, pending: undefined, error: null });
        }
        if (remote) await this.database.memoSnapshots.put({ ...remote, dateKey: this.dateKey });
        await this.persist();
        if (this.state.dirty && !this.state.conflict) this.scheduleSave();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!this.state.dirty && !this.state.content && !this.state.title) {
          const cached = await this.database.memoSnapshots.get(this.dateKey).catch(() => undefined);
          if (cached) this.publish({ title: cached.record.title, content: cached.record.content, baseVersion: cached.version });
        }
        this.publish({ ready: true, error: error instanceof ApiError ? error.code : "storage_failed" });
      }
    })().finally(() => { this.initialization = null; });
    return this.initialization;
  };

  update = (patch: { title?: string; content?: string }) => {
    if (!this.state.editable) return;
    this.publish({ ...patch, dirty: true, error: this.state.conflict ? "conflict" : null });
    void this.persist().then(() => this.scheduleSave()).catch(() => this.publish({ error: "storage_failed" }));
  };

  setComposing = (value: boolean) => {
    this.composing = value;
    if (value) clearTimeout(this.timer);
    else this.scheduleSave();
  };

  private scheduleSave() {
    clearTimeout(this.timer);
    if (!this.state.dirty || this.composing || this.state.conflict || !this.state.editable) return;
    this.timer = setTimeout(() => { void this.save(); }, 1000);
  }

  save = async () => {
    clearTimeout(this.timer);
    if (this.state.saving || !this.state.dirty || this.composing || this.state.conflict || !this.state.editable) return;
    this.publish({ saving: true, error: null });
    try {
      while (this.state.dirty && !this.composing) {
        this.assertAccount();
        const pending = this.state.pending ?? {
          operationId: nanoid(32), dateKey: this.dateKey, expectedVersion: this.state.baseVersion,
          title: this.state.title, content: this.state.content,
        };
        this.publish({ pending });
        await this.persist();
        this.assertAccount();
        const { memo } = await cloudApi.memo.save(pending);
        this.assertAccount();
        // An idempotent retry may return a newer cloud edit. Keep it for explicit conflict resolution.
        if (memo.record.title !== pending.title || memo.record.content !== pending.content) {
          this.publish({ conflict: { memo }, error: "conflict" });
          break;
        }
        const dirty = this.state.title !== pending.title || this.state.content !== pending.content;
        this.publish({ baseVersion: memo.version, pending: undefined, dirty });
        await this.database.memoSnapshots.put({ ...memo, dateKey: this.dateKey });
        await this.persist();
        publishDataChange({ entity: "dailyMemos", id: memo.record.id });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const code = error instanceof ApiError ? error.code : "storage_failed";
      this.publish({ error: code });
      if (code === "conflict") {
        try {
          const result = await cloudApi.memo.read(this.dateKey);
          this.publish({ conflict: { memo: result.memo }, editable: result.dailyMemoEditable });
        } catch { /* Keep the local draft until the cloud version can be read. */ }
      }
      if (error instanceof ApiError && error.status === 403) this.publish({ editable: false });
    } finally {
      this.publish({ saving: false });
    }
  };

  refresh = async () => {
    if (this.state.saving) return;
    try {
      this.assertAccount();
      const result = await cloudApi.memo.read(this.dateKey);
      const remote = result.memo;
      const version = remote?.version ?? 0;
      this.publish({ editable: result.dailyMemoEditable });
      if (this.state.dirty) {
        const pending = this.state.pending;
        const acknowledged = pending && remote &&
          remote.record.title === pending.title && remote.record.content === pending.content;
        if (acknowledged) {
          const dirty = this.state.title !== pending.title || this.state.content !== pending.content;
          this.publish({ baseVersion: version, pending: undefined, dirty, conflict: null, error: null });
          await this.persist();
          this.scheduleSave();
        } else if (version !== this.state.baseVersion) {
          this.publish({ conflict: { memo: remote }, error: "conflict" });
        } else {
          this.publish({ error: null });
          await this.persist();
          this.scheduleSave();
        }
      } else {
        this.publish({ title: remote?.record.title ?? "", content: remote?.record.content ?? "",
          baseVersion: version, pending: undefined, conflict: null, error: null });
        await this.persist();
      }
    } catch (error) {
      this.publish({ error: error instanceof ApiError ? error.code : "network_error" });
    }
  };

  useCloud = async () => {
    if (!this.state.conflict) return;
    const remote = this.state.conflict.memo;
    this.publish({ title: remote?.record.title ?? "", content: remote?.record.content ?? "", baseVersion: remote?.version ?? 0,
      dirty: false, pending: undefined, conflict: null, error: null });
    await this.persist();
  };

  keepLocal = async () => {
    if (!this.state.conflict) return;
    const remote = this.state.conflict.memo;
    this.publish({ baseVersion: remote?.version ?? 0, pending: undefined, conflict: null, error: null });
    await this.persist();
    await this.save();
  };

  stop() {
    clearTimeout(this.timer);
  }
}

const controllers = new Map<string, MemoController>();
export function memoController(accountId: string, dateKey: string) {
  const key = `${accountId}:${dateKey}`;
  let controller = controllers.get(key);
  if (!controller) {
    controller = new MemoController(accountId, dateKey);
    controllers.set(key, controller);
  }
  return controller;
}

export function stopMemoControllers() {
  for (const controller of controllers.values()) controller.stop();
}

export function useMemoController(controller: MemoController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}
