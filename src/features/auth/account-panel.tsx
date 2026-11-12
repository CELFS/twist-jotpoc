import { Cable, Unplug } from "lucide-react";
import { TWIST_BALANCE_ORIGIN } from "@/platform/http";
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { getText } from "@/i18n/get-text";
import { RequestError } from "@/features/shell/request-error";
import { useSession, connectAccount, disconnectAccount, cancelAuthorization, reopenAuthorization, restoreSession } from "./session-store";

export function AccountPanel() {
  const state = useSession();
  const [confirming, setConfirming] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const connected = state.phase === "connected";
  const pending = state.phase === "authorizing";
  const disconnectLabel = getText(confirming ? "client.cancel" : "client.disconnect");

  return <section className="account-panel" data-connected={connected || undefined}>
    <div className="connection-heading">
      <a className="connection-site" href={TWIST_BALANCE_ORIGIN} target="_blank" rel="noopener noreferrer"
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
        <div>{getText(pending ? "client.waitingApproval" : state.phase === "restoring" ? "client.restoring" : "client.readyToConnect")}
          {pending && <>
            <p>{getText("client.authorizationPending")}</p>
            <div className="authorization-code"><span>{getText("client.authorizationCode")}</span><strong>{state.pending?.userCode}</strong></div>
          </>}
        </div>
      </div>
      {pending ? <>
        <Button onClick={() => void reopenAuthorization().catch(() => setOpenError("unavailable"))}>{getText("client.openAuthorization")}</Button>
        <Button variant="secondary" onClick={() => void cancelAuthorization()}>{getText("client.cancelAuthorization")}</Button>
      </> : state.phase !== "restoring" && <>
        <Button disabled={state.busy} onClick={() => void connectAccount()}><Cable size={16} aria-hidden="true" />
          {getText(state.busy ? "client.connecting" : "client.connect")}</Button>
        {state.error && <Button variant="secondary" onClick={() => void restoreSession()}>{getText("client.retry")}</Button>}
      </>}
    </>}
    <RequestError code={state.error ?? openError} />
  </section>;
}
