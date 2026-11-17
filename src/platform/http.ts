import { invoke } from "@tauri-apps/api/core";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { getActiveCredential, getCredentialSignal } from "./credential";

export const TWIST_BALANCE_ORIGIN = "https://twist-balance.pages.dev";

export class ApiError extends Error {
  constructor(readonly code: string, readonly status = 0) {
    super(code);
    this.name = "ApiError";
  }
}

export function apiUrl(path: string) {
  const url = new URL(path, TWIST_BALANCE_ORIGIN);
  if (url.origin !== TWIST_BALANCE_ORIGIN || !url.pathname.startsWith("/api/extension/")) {
    throw new ApiError("invalid_request");
  }
  return url.href;
}

type RequestContext = { method: string; endpoint: string; started: number; signal?: AbortSignal | null };
const requests = new WeakMap<Response, RequestContext>();
const loggedBodyFailures = new WeakSet<Response>();

function logFailure(context: RequestContext, stage: string, reason: string, status?: number) {
  if (context.signal?.aborted) return;
  // Native errors may include the full URL, including private query parameters.
  const detail = reason.replace(/https?:\/\/[^\s)]+/gi, "[url]");
  const record = JSON.stringify({ method: context.method, endpoint: context.endpoint, stage, status,
    elapsedMs: Math.round(performance.now() - context.started), reason: detail });
  void invoke("log_network_failure", { record }).catch(() => console.error("[JotPoc network]", record));
}

function errorDetail(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function publicFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);
  const context = { method: init.method ?? "GET", endpoint: new URL(url).pathname,
    started: performance.now(), signal: init.signal };
  try {
    const response = await nativeFetch(url, { ...init, credentials: "omit", connectTimeout: 15_000, maxRedirections: 0 });
    requests.set(response, context);
    if (!response.ok) logFailure(context, "http-status", response.statusText, response.status);
    return response;
  } catch (error) {
    if (init.signal?.aborted) throw init.signal.reason;
    logFailure(context, "request", errorDetail(error));
    throw error instanceof ApiError ? error : new ApiError("network_error");
  }
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const credential = getActiveCredential();
  if (!credential || credential.expiresAt <= Date.now()) {
    if (credential) window.dispatchEvent(new Event("jotpoc:authorization-required"));
    throw new ApiError("authorization_required", 401);
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${credential.accessToken}`);
  const accountSignal = getCredentialSignal();
  const controller = new AbortController();
  const abortAccount = () => controller.abort(accountSignal.reason);
  const abortRequest = () => controller.abort(init.signal?.reason);
  accountSignal.addEventListener("abort", abortAccount, { once: true });
  init.signal?.addEventListener("abort", abortRequest, { once: true });
  if (accountSignal.aborted) abortAccount();
  if (init.signal?.aborted) abortRequest();
  const dispose = () => {
    accountSignal.removeEventListener("abort", abortAccount);
    init.signal?.removeEventListener("abort", abortRequest);
  };
  let response: Response;
  try {
    response = await publicFetch(path, { ...init, headers, signal: controller.signal });
  } catch (error) { dispose(); throw error; }
  // Responses belong to the account that started the request.
  if (getActiveCredential() !== credential) {
    void response.body?.cancel();
    dispose();
    throw new DOMException("Account changed", "AbortError");
  }
  if (response.ok) window.dispatchEvent(new Event("jotpoc:authenticated-response"));
  if (response.status === 401) {
    window.dispatchEvent(new Event("jotpoc:authorization-required"));
  }
  if (!response.body) { dispose(); return response; }
  const context = requests.get(response);
  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(output) {
      try {
        if (getActiveCredential() !== credential) throw new DOMException("Account changed", "AbortError");
        const chunk = await reader.read();
        if (getActiveCredential() !== credential) throw new DOMException("Account changed", "AbortError");
        if (chunk.done) { dispose(); reader.releaseLock(); output.close(); }
        else output.enqueue(chunk.value);
      } catch (error) {
        dispose();
        void reader.cancel(error).catch(() => undefined);
        loggedBodyFailures.add(wrapped);
        if (context) logFailure(context, "read-body", errorDetail(error), response.status);
        output.error(error);
      }
    },
    cancel(reason) { dispose(); controller.abort(reason); return reader.cancel(reason); },
  });
  const wrapped = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  if (context) requests.set(wrapped, context);
  return wrapped;
}

export async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch((error: unknown) => {
    const context = requests.get(response);
    if (context && !loggedBodyFailures.has(response)) {
      // JSON parser messages can quote the response body.
      const invalid = error instanceof SyntaxError;
      logFailure(context, invalid ? "decode-json" : "read-body", invalid ? error.name : errorDetail(error), response.status);
    }
    return null;
  });
  if (!response.ok) {
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code : "unavailable";
    throw new ApiError(code, response.status);
  }
  return body;
}

export function jsonRequest(body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  };
}
