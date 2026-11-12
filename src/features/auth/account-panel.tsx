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

  return <section className="account-panel">
    {state.phase === "restoring" ? <p role="status">{getText("client.restoring")}</p> :
      state.phase === "connected" ? <>
        <p><bdi>{state.credential?.email}</bdi></p>
        <div className="client-actions">
          <Button variant="secondary" onClick={() => {
            setOpenError(null);
            void openUrl("https://twist-balance.pages.dev/extension/devices/").catch(() => setOpenError("unavailable"));
          }}>{getText("client.permissions")}</Button>
          <Button variant="ghost" disabled={state.busy} onClick={() => setConfirming(true)}>{getText("client.disconnect")}</Button>
        </div>
        {confirming && <section className="client-confirmation" aria-label={getText("client.confirmDisconnect")}>
          <strong>{getText("client.confirmDisconnect")}</strong>
          <p>{getText("client.disconnectDescription")}</p>
          <div className="client-actions">
            <Button disabled={state.busy} onClick={() => {
              void disconnectAccount().then(() => setConfirming(false));
            }}>{getText("client.disconnect")}</Button>
            <Button variant="secondary" disabled={state.busy} onClick={() => setConfirming(false)}>{getText("client.cancel")}</Button>
          </div>
        </section>}
      </> : state.phase === "authorizing" ? <>
        <p>{getText("client.authorizationPending")}</p>
        <div className="authorization-code"><span>{getText("client.authorizationCode")}</span><strong>{state.pending?.userCode}</strong></div>
        <div className="client-actions">
          <Button onClick={() => void reopenAuthorization().catch(() => setOpenError("unavailable"))}>{getText("client.openAuthorization")}</Button>
          <Button variant="secondary" onClick={() => void cancelAuthorization()}>{getText("client.cancelAuthorization")}</Button>
        </div>
      </> : <div className="client-actions">
        <Button disabled={state.busy} onClick={() => void connectAccount()}>
          {getText(state.busy ? "client.connecting" : "client.connect")}
        </Button>
        {state.error && <Button variant="secondary" onClick={() => void restoreSession()}>{getText("client.retry")}</Button>}
      </div>}
    <RequestError code={state.error ?? openError} />
  </section>;
}
