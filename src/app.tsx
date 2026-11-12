import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExternalLink, Settings, Star, UserRound, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { SettingsPage } from "@/features/shell/settings-page";
import { FloatingEntry } from "@/features/shell/floating-entry";
import { WindowControls } from "@/features/shell/window-controls";
import { RequestError } from "@/features/shell/request-error";
import { Workspace } from "@/features/shell/workspace";
import { AccountPanel } from "@/features/auth/account-panel";
import { restoreSession, useSession } from "@/features/auth/session-store";
import { getText } from "@/i18n/get-text";
import { getStoredAppLanguage, setAppLanguagePreference, subscribeAppLanguagePreference } from "@/i18n/app-language";
import { readWindowState, setWindowMode, setWindowPinned, type WindowState } from "@/platform/window";
import type { TranslationChange } from "@/features/translation/translation-change";

const CollectionsPanel = lazy(() => import("@/features/shell/collections-panel").then(module => ({ default: module.CollectionsPanel })));

export function App() {
  const [windowState, setState] = useState<WindowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"account" | "collections" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translationChange, setTranslationChange] = useState<TranslationChange>();
  const [autoHide, setAutoHide] = useState(() => localStorage.getItem("jotpoc.floating.autoHide") !== "false");
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

  const changePin = (pinned: boolean) => void updateWindow(() => setWindowPinned(pinned));
  const drawerTitle = getText(drawer === "account" ? "client.account" : "client.collections");
  const openMainSite = () => void openUrl("https://twist-balance.pages.dev/").catch(() => setError(getText("app.mainSiteError")));
  const collapsed = windowState?.mode === "collapsed";
  return <div className="app-shell" data-mode={windowState?.mode ?? "full"} data-language={language}>
    <div className="expanded-shell" hidden={collapsed}>
      <header className="app-header" data-macos={windowState?.macos || undefined} data-tauri-drag-region>
        <div className="app-header-actions">
          {credential && <>
            <Button variant="ghost" size="icon" aria-label={getText("client.collections")} title={getText("client.collections")} onClick={() => setDrawer("collections")}><Star size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label={getText("client.account")} title={getText("client.account")} onClick={() => setDrawer("account")}><UserRound size={18} /></Button>
          </>}
          <Button variant="ghost" size="icon" aria-label={getText("app.openMainSite")} title={getText("app.openMainSite")}
            onClick={openMainSite}><ExternalLink size={18} /></Button>
          <Button variant="ghost" size="icon" aria-label={getText("settings.shortLabel")} title={getText("settings.shortLabel")}
            aria-pressed={settingsOpen} onClick={() => setSettingsOpen(open => !open)}><Settings size={18} aria-hidden="true" /></Button>
          {windowState && <WindowControls busy={busy} state={windowState}
            onModeChange={mode => void updateWindow(() => setWindowMode(mode))}
            onPinChange={changePin} />}
        </div>
      </header>
      {error && <p className="client-error" role="alert">{error}</p>}
      {credential && <RequestError code={session.error} />}
      <main hidden={settingsOpen} className={credential ? "workspace-host" : "app-content custom-scrollbar"} data-connection={!credential || undefined}>
        {credential ? <Workspace key={credential.accountId} accountId={credential.accountId} onTranslationChange={setTranslationChange} /> : <AccountPanel platform={windowState?.macos ? "macos" : windowState?.windows ? "windows" : "other"} />}
      </main>
      {settingsOpen && <SettingsPage language={language} desktop={Boolean(windowState?.desktop)} autoHide={autoHide}
        onAutoHideChange={value => {
          localStorage.setItem("jotpoc.floating.autoHide", String(value));
          setAutoHide(value);
        }} onBack={() => setSettingsOpen(false)} />}
    </div>
    {collapsed && <FloatingEntry autoHide={autoHide} busy={busy} pinned={windowState.pinned} onPinChange={changePin}
      onSettings={() => void updateWindow(async () => {
        const restored = await setWindowMode(windowState.resume_mode);
        setDrawer(null);
        setSettingsOpen(true);
        return restored;
      })} onExpand={() => void updateWindow(() => setWindowMode(windowState.resume_mode))} onError={() => setError(getText("app.windowError"))} />}
    {collapsed && error && <span className="visually-hidden" role="alert">{error}</span>}
    {drawer && credential && !collapsed && <Drawer ariaLabel={drawerTitle}
      className="client-drawer" contentClassName="custom-scrollbar" onClose={() => setDrawer(null)}
      header={<div className="client-drawer-heading"><h2>{drawerTitle}</h2>
        <Button variant="ghost" size="icon" aria-label={getText("common.close")} onClick={() => setDrawer(null)}><X size={18} /></Button></div>}>
      {drawer === "account" ? <AccountPanel /> : <Suspense fallback={<p role="status">{getText("client.load")}</p>}><CollectionsPanel accountId={credential.accountId} change={translationChange} onChange={setTranslationChange} /></Suspense>}
    </Drawer>}
  </div>;
}
