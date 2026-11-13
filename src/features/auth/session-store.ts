import { useSyncExternalStore } from "react";
import { z } from "zod";
import { nanoid } from "nanoid";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import packageInfo from "../../../package.json";
import { getActiveCredential, setActiveCredential, type Credential } from "@/platform/credential";
import { readStoredCredential, removeStoredCredential, removeMatchingCredential, storeCredential } from "@/platform/secure-storage";
import { ApiError, publicFetch, readJson, jsonRequest, TWIST_BALANCE_ORIGIN } from "@/platform/http";

const sessionSchema = z.object({
  authorizationNumber: z.string().optional(),
  lastUsedAt: z.number().int().nonnegative().optional(),
  user: z.object({ id: z.string().min(1), email: z.string().email(), emailVerified: z.literal(true) }),
  scopes: z.array(z.string()),
  expiresAt: z.number().int().positive(),
});
const credentialSchema = z.object({
  authorizationNumber: z.string().optional(),
  lastUsedAt: z.number().int().nonnegative().optional(),
  accessToken: z.string().regex(/^[A-Za-z0-9_-]{48}$/),
  accountId: z.string().min(1),
  email: z.string().email(),
  expiresAt: z.number().int().positive(),
  scopes: z.array(z.string()),
});
const pendingSchema = z.object({
  deviceCode: z.string().regex(/^[A-Za-z0-9_-]{48}$/),
  userCode: z.string(),
  expiresAt: z.number().int().positive(),
  interval: z.number().positive(),
  verificationUriComplete: z.string().url(),
});
const tokenSchema = z.object({
  accessToken: z.string().regex(/^[A-Za-z0-9_-]{48}$/),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().positive(),
  scopes: z.array(z.string()),
});

type Pending = z.infer<typeof pendingSchema>;
type SessionState = {
  phase: "credentialUnreadable" | "reauthorize" | "restoring" | "disconnected" | "authorizing" | "connected";
  credential: Credential | null;
  pending: Pending | null;
  error: string | null;
  busy: boolean;
};

let state: SessionState = {
  phase: "restoring", credential: null, pending: null, error: null, busy: false,
};
const listeners = new Set<() => void>();
let revision = 0;
let authorization: AbortController | null = null;
const offlineRestorations = new WeakSet<Credential>();
let restoration: Promise<void> | null = null;

function reportFailure(stage: string, error: unknown) {
  const code = error instanceof ApiError && /^[a-z_]{1,48}$/.test(error.code)
    ? error.code : error instanceof z.ZodError ? "invalid_response" : "operation_failed";
  const status = error instanceof ApiError ? error.status : 0;
  void invoke("log_auth_failure", { stage, code, status }).catch(() => console.warn("[JotPoc auth]", stage, status, code));
}

function publish(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function post(path: string, body: unknown, signal?: AbortSignal) {
  return readJson(await publicFetch(`/api/extension/${path}`, jsonRequest(body, signal)));
}

async function inspect(token: string, signal?: AbortSignal) {
  return sessionSchema.parse(await readJson(await publicFetch("/api/extension/session", {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })));
}

function installationId() {
  const key = "jotpoc.installation-id";
  const existing = localStorage.getItem(key);
  if (existing && /^[A-Za-z0-9_-]{32}$/.test(existing)) return existing;
  const next = nanoid(32);
  localStorage.setItem(key, next);
  return next;
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export function restoreSession(): Promise<void> {
  if (restoration) return restoration;
  const current = ++revision;
  publish({ phase: "restoring", error: null });
  restoration = (async () => {
    let cached: Credential | null = null;
    let stored: unknown;
    try {
      stored = await readStoredCredential();
    } catch (error) {
      if (current !== revision) return;
      reportFailure("read-credential", error);
      setActiveCredential(null);
      publish({ phase: "credentialUnreadable", credential: null });
      return;
    }
    try {
      if (current !== revision) return;
      const parsed = credentialSchema.safeParse(stored);
      if (stored === null || !parsed.success || parsed.data.expiresAt <= Date.now()) {
        if (stored !== null) await removeStoredCredential();
        if (current === revision) {
          setActiveCredential(null);
          publish({ phase: stored === null ? "disconnected" : "reauthorize", credential: null });
        }
        return;
      }
      cached = parsed.data;
      const session = await inspect(parsed.data.accessToken);
      if (current !== revision) return;
      const credential = { ...parsed.data, accountId: session.user.id, email: session.user.email,
        authorizationNumber: session.authorizationNumber, lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt, scopes: session.scopes };
      await storeCredential(credential);
      if (current !== revision) return;
      setActiveCredential(credential);
      publish({ phase: "connected", credential, error: null });
    } catch (error) {
      if (current !== revision) return;
      reportFailure("restore-session", error);
      if (cached && error instanceof ApiError && error.code === "network_error") {
        offlineRestorations.add(cached);
        setActiveCredential(cached);
        publish({ phase: "connected", credential: cached, error: error.code });
        return;
      }
      const rejected = error instanceof ApiError && (error.status === 401 || error.status === 403);
      if (rejected) {
        await removeStoredCredential().catch(() => undefined);
      }
      if (current !== revision) return;
      setActiveCredential(null);
      publish({ phase: rejected ? "reauthorize" : "disconnected", credential: null, error: rejected ? null : error instanceof ApiError ? error.code : "storage_failed" });
    }
  })().finally(() => { restoration = null; });
  return restoration;
}

export async function connectAccount() {
  if (state.busy || state.phase === "authorizing") return;
  const current = ++revision;
  authorization?.abort();
  const controller = new AbortController();
  authorization = controller;
  publish({ busy: true, error: null });
  let pending: Pending | null = null;
  let issuedToken: string | null = null;
  let connected = false;
  let stage = "device/start";
  try {
    const deviceInfo = await invoke<{ os?: string; name?: string }>("authorization_device_info");
    pending = pendingSchema.parse(await post("device/start", {
      deviceInfo,
      installationId: installationId(), clientName: "JotPoc", clientVersion: packageInfo.version,
    }, controller.signal));
    if (current !== revision) return;
    stage = "validate-authorization-url";
    const verification = new URL(pending.verificationUriComplete);
    if (verification.origin !== TWIST_BALANCE_ORIGIN || verification.pathname !== "/extension/authorize/") {
      throw new ApiError("invalid_request");
    }
    publish({ phase: "authorizing", pending, busy: false });
    stage = "open-browser";
    await openUrl(verification.href);
    while (!controller.signal.aborted && current === revision) {
      if (Date.now() >= pending.expiresAt) throw new ApiError("authorization_expired");
      await wait(pending.interval * 1000, controller.signal);
      stage = "device/token";
      let token: z.infer<typeof tokenSchema>;
      try {
        token = tokenSchema.parse(await post("device/token", { deviceCode: pending.deviceCode }, controller.signal));
      } catch (error) {
        if (error instanceof ApiError && error.code === "authorization_pending") continue;
        throw error;
      }
      issuedToken = token.accessToken;
      stage = "session";
      const session = await inspect(token.accessToken, controller.signal);
      if (current !== revision) return;
      const credential: Credential = {
        accessToken: token.accessToken, accountId: session.user.id, email: session.user.email,
        authorizationNumber: session.authorizationNumber, lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt, scopes: session.scopes,
      };
      try {
        stage = "store-credential";
        await storeCredential(credential);
      } catch {
        await publicFetch("/api/extension/session/revoke", {
          ...jsonRequest({}), headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.accessToken}` },
        }).catch(() => undefined);
        throw new ApiError("storage_failed");
      }
      if (current !== revision) {
        await removeMatchingCredential(token.accessToken);
        return;
      }
      setActiveCredential(credential);
      connected = true;
      publish({ phase: "connected", credential, pending: null, error: null });
      return;
    }
  } catch (error) {
    if (current !== revision || controller.signal.aborted) return;
    reportFailure(stage, error);
    publish({ phase: "disconnected", pending: null, error: error instanceof ApiError ? error.code : "unavailable" });
  } finally {
    if (!connected && issuedToken) {
      void publicFetch("/api/extension/session/revoke", {
        ...jsonRequest({}),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${issuedToken}` },
      }).catch(() => undefined);
    }
    if (!connected && pending) void post("device/cancel", { deviceCode: pending.deviceCode }).catch(() => undefined);
    if (current === revision) publish({ busy: false });
  }
}

export async function cancelAuthorization() {
  const pending = state.pending;
  ++revision;
  authorization?.abort(new DOMException("Authorization cancelled", "AbortError"));
  authorization = null;
  publish({ phase: "disconnected", pending: null, busy: false, error: null });
  if (pending) {
    try { await post("device/cancel", { deviceCode: pending.deviceCode }); }
    catch (error) { publish({ error: error instanceof ApiError ? error.code : "network_error" }); }
  }
}

export async function reopenAuthorization() {
  if (state.pending) await openUrl(state.pending.verificationUriComplete);
}

export async function disconnectAccount() {
  if (state.busy) return;
  const credential = getActiveCredential();
  if (!credential) return;
  publish({ busy: true, error: null });
  try {
    const response = await publicFetch("/api/extension/session/revoke", {
      ...jsonRequest({}),
      headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json" },
    });
    if (response.status !== 401) await readJson(response);
    await removeStoredCredential();
    ++revision;
    setActiveCredential(null);
    publish({ phase: "disconnected", credential: null, busy: false });
  } catch (error) {
    publish({ busy: false, error: error instanceof ApiError ? error.code : "storage_failed" });
  }
}

window.addEventListener("jotpoc:authorization-required", () => {
  ++revision;
  authorization?.abort();
  setActiveCredential(null);
  publish({ phase: "reauthorize", credential: null, pending: null, error: null, busy: false });
  void removeStoredCredential().catch(() => publish({ error: "storage_failed" }));
});

window.addEventListener("jotpoc:authenticated-response", () => {
  const credential = getActiveCredential();
  if (!credential || !offlineRestorations.delete(credential)) return;
  if (state.error === "network_error") publish({ error: null });
});

export function useSession() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
}
