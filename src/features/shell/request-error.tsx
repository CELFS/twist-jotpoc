import { ErrorNotice } from "./notification-center";
import { getText, type MessageKey } from "@/i18n/get-text";

const keys: Record<string, MessageKey> = {
  network_error: "client.errors.network_error", unavailable: "client.errors.unavailable",
  invalid_request: "client.errors.invalid_request", authorization_required: "client.errors.authorization_required",
  unauthorized: "client.errors.authorization_required", authorization_expired: "client.errors.authorization_expired",
  authorization_denied: "client.errors.authorization_denied", forbidden: "client.errors.forbidden",
  permission_revoked: "client.errors.permission_revoked", conflict: "client.errors.conflict",
  storage_failed: "client.errors.storage_failed", rate_limited: "client.errors.rate_limited",
  invalid_url: "client.errors.invalid_url", unsaved: "client.errors.unsaved",
};

export function requestErrorText(code: string) {
  return getText(keys[code] ?? "client.errors.unavailable");
}

export function RequestError({ code }: { code: string | null }) {
  return code ? <ErrorNotice text={requestErrorText(code)} /> : null;
}
