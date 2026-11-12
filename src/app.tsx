import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExternalLink, Star, UserRound, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { SelectField } from "@/components/ui/select-field";
import { FloatingEntry } from "@/features/shell/floating-entry";
import { WindowControls } from "@/features/shell/window-controls";
import { RequestError } from "@/features/shell/request-error";
import { Workspace } from "@/features/shell/workspace";
import { AccountPanel } from "@/features/auth/account-panel";
import { restoreSession, useSession } from "@/features/auth/session-store";
import { getText } from "@/i18n/get-text";
import { getStoredAppLanguage, setAppLanguagePreference, subscribeAppLanguagePreference, type AppLanguagePreference } from "@/i18n/app-language";
import { readWindowState, setWindowMode, setWindowPinned, type WindowState } from "@/platform/window";
import type { TranslationChange } from "@/features/translation/translation-change";
import appIcon from "../src-tauri/icons/128x128.png";

const CollectionsPanel = lazy(() => import("@/features/shell/collections-panel").then(module => ({ default: module.CollectionsPanel })));

export function App() {
  const [windowState, setState] = useState<WindowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"account" | "collections" | null>(null);
  const [translationChange, setTranslationChange] = useState<TranslationChange>();
  const changing = useRef(false);
  const session = useSession();
  const language = useSyncExternalStore(subscribeAppLanguagePreference, getStoredAppLanguage);
  const credential = session.credential;

  useEffect(() => {
    setAppLanguagePreference(getStoredAppLanguage());
    void restoreSession();
    let active = true;
    void readWindowState().then(state => { if (active) setState(state); })
      .catch(() => { if (active) setError(getText("app.startupError")); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!credential) { setDrawer(null); setTranslationChange(undefined); return; }
    let timer: number;
    const scheduleExpiration = () => {
      const remaining = credential.expiresAt - Date.now();
      if (remaining <= 0) {
        window.dispatchEvent(new Event("jotpoc:authorization-required"));
        return;
      }
      timer = window.setTimeout(scheduleExpiration, Math.min(remaining, 2_147_000_000));
    };
    scheduleExpiration();
    return () => clearTimeout(timer);
  }, [credential]);

  const updateWindow = async (operation: () => Promise<WindowState>) => {
    if (changing.current) return;
    changing.current = true; setBusy(true); setError(null);
    try { setState(await operation()); }
    catch {
      setError(getText("app.windowError"));
      // Re-read native state when an operating-system operation failed partway.
      try { setState(await readWindowState()); } catch { /* Keep the last known state visible. */ }
    } finally { changing.current = false; setBusy(false); }
  };

  const collapsed = windowState?.mode === "collapsed";
  return <div className="app-shell" data-mode={windowState?.mode ?? "full"} data-language={language}>
    <div className="expanded-shell" hidden={collapsed}>
      <header className="app-header">
        <div className="app-identity"><img src={appIcon} alt="" width={32} height={32} /><strong>{getText("app.name")}</strong></div>
        <div className="app-header-actions">
          {credential && <>
            <Button variant="ghost" size="icon" aria-label={getText("client.collections")} title={getText("client.collections")} onClick={() => setDrawer("collections")}><Star size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label={getText("client.account")} title={getText("client.account")} onClick={() => setDrawer("account")}><UserRound size={18} /></Button>
          </>}
          <Button variant="ghost" size="icon" aria-label={getText("app.openMainSite")} title={getText("app.openMainSite")}
            onClick={() => void openUrl("https://twist-balance.pages.dev/").catch(() => setError(getText("app.mainSiteError")))}><ExternalLink size={17} /></Button>
          {windowState && <WindowControls busy={busy} state={windowState}
            onModeChange={mode => void updateWindow(() => setWindowMode(mode))}
            onPinChange={pinned => void updateWindow(() => setWindowPinned(pinned))} />}
        </div>
      </header>
      {error && <p className="client-error" role="alert">{error}</p>}
      {credential && <RequestError code={session.error} />}
      <main className="app-content custom-scrollbar">
        {credential ? <Workspace key={credential.accountId} accountId={credential.accountId} onTranslationChange={setTranslationChange} /> : <AccountPanel />}
      </main>
    </div>
    {collapsed && <FloatingEntry busy={busy} onExpand={() => void updateWindow(() => setWindowMode("mini"))} onError={() => setError(getText("app.windowError"))} />}
    {collapsed && error && <span className="visually-hidden" role="alert">{error}</span>}
    {drawer && credential && !collapsed && <Drawer ariaLabel={getText(drawer === "account" ? "client.account" : "client.collections")}
      className="client-drawer" contentClassName="custom-scrollbar" onClose={() => setDrawer(null)}
      header={<div className="client-drawer-heading"><h2>{getText(drawer === "account" ? "client.account" : "client.collections")}</h2>
        <Button variant="ghost" size="icon" aria-label={getText("common.close")} onClick={() => setDrawer(null)}><X size={18} /></Button></div>}>
      {drawer === "account" ? <>
        <AccountPanel />
        <SelectField label={getText("client.language")} value={language}
          onChange={event => setAppLanguagePreference(event.target.value as AppLanguagePreference)}>
          <option value="zh">{getText("client.languageZh")}</option>
          <option value="en">{getText("client.languageEn")}</option>
          <option value="system">{getText("client.languageSystem")}</option>
        </SelectField>
      </> : <Suspense fallback={<p role="status">{getText("client.load")}</p>}><CollectionsPanel accountId={credential.accountId} change={translationChange} onChange={setTranslationChange} /></Suspense>}
    </Drawer>}
  </div>;
}
