import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Globe, Languages, NotebookPen, Settings, Star, UserRound, X } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { SettingsPage } from "@/features/shell/settings-page";
import { FloatingEntry } from "@/features/shell/floating-entry";
import { WindowControls } from "@/features/shell/window-controls";
import { RequestError } from "@/features/shell/request-error";
import { Workspace, type WorkspaceTab } from "@/features/shell/workspace";
import { AccountPanel } from "@/features/auth/account-panel";
import { restoreSession, useSession } from "@/features/auth/session-store";
import { getText } from "@/i18n/get-text";
import { getStoredAppLanguage, setAppLanguagePreference, subscribeAppLanguagePreference } from "@/i18n/app-language";
import { readWindowState, setWindowMode, setWindowPinned, type WindowState } from "@/platform/window";


export function App() {
  const [windowState, setState] = useState<WindowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("memos");
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    if (!credential) { setTab("memos"); setAccountOpen(false); return; }
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
  const drawerTitle = getText("client.account");
  const collapsed = windowState?.mode === "collapsed";
  return <div className="app-shell" data-mode={windowState?.mode ?? "full"} data-language={language}>
    <div className="expanded-shell" hidden={collapsed}>
      <header className="app-header" data-macos={windowState?.macos || undefined} data-tauri-drag-region>
        <div className="header-window" data-tauri-drag-region>
          {windowState && <WindowControls busy={busy} state={windowState}
            onModeChange={mode => void updateWindow(() => setWindowMode(mode))}
            onPinChange={changePin} />}
        </div>
        <div className="header-pages">
          {credential && <Tabs<WorkspaceTab> labelOnSelection className="workspace-tabs" id="workspace"
            ariaLabel={getText("client.tabs")} value={settingsOpen ? null : tab}
            onValueChange={next => { setTab(next); setSettingsOpen(false); }}
            items={[
              { value: "memos", label: getText("client.memos"), icon: <NotebookPen size={17} aria-hidden="true" /> },
              { value: "notes", label: getText("client.notes"), icon: <Globe size={17} aria-hidden="true" /> },
              { value: "collections", label: getText("client.collections"), icon: <Star size={17} aria-hidden="true" /> },
              { value: "translation", label: getText("client.translation"), icon: <Languages size={17} aria-hidden="true" /> },
            ]} />}
          <div className="header-utilities workspace-tabs">
            {credential && <Button variant="ghost" size="icon" aria-label={getText("client.account")} title={getText("client.account")} onClick={() => setAccountOpen(true)}><UserRound size={18} /></Button>}
            <button type="button" className="ui-tab settings-tab" data-selected={settingsOpen}
              aria-label={getText("settings.shortLabel")} title={getText("settings.shortLabel")}
              aria-pressed={settingsOpen} onClick={() => setSettingsOpen(open => !open)}>
              <Settings size={17} aria-hidden="true" />{settingsOpen && getText("settings.shortLabel")}
            </button>
          </div>
        </div>
      </header>
      {error && <p className="client-error" role="alert">{error}</p>}
      {credential && <RequestError code={session.error} />}
      <main hidden={settingsOpen} className={credential ? "workspace-host" : "app-content custom-scrollbar"} data-connection={!credential || undefined}>
        {credential ? <Workspace tab={tab} setTab={setTab} key={credential.accountId} accountId={credential.accountId} /> : <AccountPanel platform={windowState?.macos ? "macos" : windowState?.windows ? "windows" : "other"} />}
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
        setAccountOpen(false);
        setSettingsOpen(true);
        return restored;
      })} onExpand={() => void updateWindow(() => setWindowMode(windowState.resume_mode))} onError={() => setError(getText("app.windowError"))} />}
    {collapsed && error && <span className="visually-hidden" role="alert">{error}</span>}
    {accountOpen && credential && !collapsed && <Drawer ariaLabel={drawerTitle}
      className="client-drawer" contentClassName="custom-scrollbar" onClose={() => setAccountOpen(false)}
      header={<div className="client-drawer-heading"><h2>{drawerTitle}</h2>
        <Button variant="ghost" size="icon" aria-label={getText("common.close")} onClick={() => setAccountOpen(false)}><X size={18} /></Button></div>}>
      <AccountPanel />
    </Drawer>}
  </div>;
}
