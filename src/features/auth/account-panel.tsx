import { Cable, Copy, Unplug } from "lucide-react";
import { TWIST_BALANCE_ORIGIN } from "@/platform/http";
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { getIntlLocale } from "@/i18n/app-language";
import { getText, type MessageKey } from "@/i18n/get-text";
import { RequestError } from "@/features/shell/request-error";
import { useSession, connectAccount, disconnectAccount, cancelAuthorization, reopenAuthorization, restoreSession } from "./session-store";

export function AccountPanel({ platform = "other" }: { platform?: "macos" | "windows" | "other" }) {
  const state = useSession();
  const [confirming, setConfirming] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<MessageKey | null>(null);
  const credential = state.credential;
  const connected = state.phase === "connected";
  const pending = state.phase === "authorizing";
  const unreadable = state.phase === "credentialUnreadable";
  const reauthorize = state.phase === "reauthorize";
  const disconnectLabel = getText(confirming ? "client.cancel" : "client.disconnect");

  return <section className="account-panel" data-connected={connected || undefined}>
    <div className="connection-heading">
      <a className="connection-site" href={TWIST_BALANCE_ORIGIN} target="_blank" rel="noopener noreferrer"
        onClick={event => { event.preventDefault(); void openUrl(TWIST_BALANCE_ORIGIN).catch(() => setOpenError("unavailable")); }}
        aria-label={getText("app.openMainSite")} title={getText("app.openMainSite")}>
        <img src="/branding/twist-balance.png" alt="" width={32} height={32} />
      </a>
      <h2>{getText("client.connectionStatus")}</h2>
      {connected && <div className="connection-identity">
        <span className="connection-dot" aria-hidden="true" />
        <strong title={state.credential?.email}>{state.credential?.email}</strong>
        <Button size="icon" variant="ghost" disabled={state.busy} aria-label={disconnectLabel} title={disconnectLabel}
          onClick={() => setConfirming(value => !value)}>
          {confirming ? <Cable size={15} /> : <Unplug size={15} />}
        </Button>
      </div>}
    </div>
    {connected ? <>
      {credential?.authorizationNumber && <div className="connection-details">
        <div className="connection-authorization-number">
          <span>{getText("client.authorizationNumber")}</span><code>{credential.authorizationNumber}</code>
          <Button size="icon" variant="ghost" aria-label={getText("client.copyAuthorizationNumber")} title={getText("client.copyAuthorizationNumber")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(credential.authorizationNumber!);
                setCopyFeedback("translation.copied");
              } catch { setCopyFeedback("translation.copyFailed"); }
            }}><Copy size={15} /></Button>
          {copyFeedback && <span role="status">{getText(copyFeedback)}</span>}
        </div>
        {credential.lastUsedAt && <span>{getText("client.lastUsed")} <time dateTime={new Date(credential.lastUsedAt).toISOString()}>{new Date(credential.lastUsedAt).toLocaleString(getIntlLocale(), { dateStyle: "short", timeStyle: "short" })}</time></span>}
      </div>}
      {confirming && <section className="client-confirmation" aria-label={getText("client.confirmDisconnect")}>
        <p><Unplug size={15} aria-hidden="true" /> {getText("client.disconnectDescription")}</p>
        <div className="connection-confirm-actions">
          <Button variant="secondary" disabled={state.busy} onClick={() => setConfirming(false)}>{getText("client.cancel")}</Button>
          <Button variant="danger" disabled={state.busy} onClick={() => void disconnectAccount()}>{getText("client.disconnect")}</Button>
        </div>
      </section>}
      <Button variant="ghost" onClick={() => {
        setOpenError(null);
        void openUrl(new URL("/extension/devices/", TWIST_BALANCE_ORIGIN).href).catch(() => setOpenError("unavailable"));
      }}>{getText("client.permissions")}</Button>
    </> : <>
      <div className="connection-status" data-pending={pending || undefined} role="status">
        <span className="connection-dot" aria-hidden="true" />
        <div>{getText(pending ? "client.waitingApproval" : state.phase === "restoring" ? "client.restoring" : unreadable ? "client.credentialUnreadable" : reauthorize ? "client.reauthorize" : "client.readyToConnect")}
          {unreadable && <p>{getText(platform === "macos" ? "client.keychainHint" : platform === "windows" ? "client.credentialManagerHint" : "client.credentialStoreHint")}</p>}
          {pending && <>
            <p>{getText("client.authorizationPending")}</p>
            <div className="authorization-code"><span>{getText("client.authorizationCode")}</span><strong>{state.pending?.userCode}</strong></div>
          </>}
        </div>
      </div>
      {pending ? <>
        <Button onClick={() => void reopenAuthorization().catch(() => setOpenError("unavailable"))}>{getText("client.openAuthorization")}</Button>
        <Button variant="secondary" onClick={() => void cancelAuthorization()}>{getText("client.cancelAuthorization")}</Button>
      </> : unreadable ? <Button onClick={() => void restoreSession()}>{getText("client.retryRead")}</Button> : state.phase !== "restoring" && <>
        <Button disabled={state.busy} onClick={() => void connectAccount()}><Cable size={16} aria-hidden="true" />
          {getText(state.busy ? "client.connecting" : reauthorize ? "client.reconnect" : "client.connect")}</Button>
        {state.error && <Button variant="secondary" onClick={() => void restoreSession()}>{getText("client.retry")}</Button>}
      </>}
    </>}
    <RequestError code={state.error ?? openError} />
  </section>;
}
