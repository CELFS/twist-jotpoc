import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Globe, Languages, NotebookPen, PanelRight, Star } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { SidebarContext, WorkspaceSidebar } from "@/features/shell/workspace-sidebar";
import { SettingsPage, type ManagementTab } from "@/features/shell/settings-page";
import { SidebarResizer } from "@/features/shell/sidebar-resizer";
import { FloatingEntry } from "@/features/shell/floating-entry";
import { WindowControls } from "@/features/shell/window-controls";
import { ErrorNotice, NotificationCenter } from "@/features/shell/notification-center";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTarget, setSidebarTarget] = useState<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("memos");
  const [managementTab, setManagementTab] = useState<ManagementTab | null>(null);
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
    if (!credential) { setTab("memos"); return; }
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
  const openPage = (next: WorkspaceTab) => { setTab(next); setManagementTab(null); };
  const items = [
    { value: "memos", label: getText("client.memos"), icon: <NotebookPen size={17} aria-hidden="true" /> },
    { value: "notes", label: getText("client.notes"), icon: <Globe size={17} aria-hidden="true" /> },
    { value: "collections", label: getText("client.collections"), icon: <Star size={17} aria-hidden="true" /> },
    { value: "translation", label: getText("client.translation"), icon: <Languages size={17} aria-hidden="true" /> },
  ] as const;
  const sidebarTitle = getText(({
    memos: "client.history", notes: "client.notes",
    collections: "collections.title", translation: "translation.library",
  } as const)[tab]);
  const platform = windowState?.macos ? "macos" : windowState?.windows ? "windows" : "other";
  const collapsed = windowState?.mode === "collapsed";
  return <div className="app-shell" data-mode={windowState?.mode ?? "full"} data-language={language}>
    <div className="expanded-shell" data-sidebar-open={sidebarOpen} hidden={collapsed}>
      <header className="app-header" data-macos={windowState?.macos || undefined} data-tauri-drag-region>
        <div className="header-window" data-tauri-drag-region>
          {windowState && <WindowControls busy={busy} state={windowState}
            onModeChange={mode => void updateWindow(() => setWindowMode(mode))}
            onPinChange={changePin} />}
        </div>
        <div className="header-pages" data-tauri-drag-region>
          {credential && <Tabs<WorkspaceTab> labelOnSelection className="workspace-tabs" id="workspace"
            ariaLabel={getText("client.tabs")} value={managementTab ? null : tab}
            onValueChange={openPage} items={items} />}
        </div>
        {credential && sidebarOpen && <h2 className="header-sidebar-title" title={sidebarTitle} data-tauri-drag-region>{sidebarTitle}</h2>}
        <button type="button" className="sidebar-toggle"
            title={getText("client.sidebar")} aria-label={getText("client.sidebar")}
            aria-expanded={sidebarOpen} aria-controls="workspace-sidebar"
            onClick={() => setSidebarOpen(open => !open)}><PanelRight size={17} aria-hidden="true" /></button>
      </header>
      <NotificationCenter />
      <ErrorNotice text={error} />
      {credential && <RequestError code={session.error} />}
      <div className="shell-body">
        <div className="shell-page">
          <SidebarContext.Provider value={{ target: sidebarOpen ? sidebarTarget : null, tab, onSelect: () => openPage(tab) }}>
            <main hidden={Boolean(managementTab)} className={credential ? "workspace-host" : "app-content custom-scrollbar"} data-connection={!credential || undefined}>
              {credential ? <Workspace tab={tab} setTab={setTab} key={credential.accountId} accountId={credential.accountId} /> : <AccountPanel platform={platform} />}
            </main>
          </SidebarContext.Provider>
          {managementTab && <SettingsPage tab={managementTab} setTab={setManagementTab} platform={platform} language={language} desktop={Boolean(windowState?.desktop)} autoHide={autoHide}
            onAutoHideChange={value => {
              localStorage.setItem("jotpoc.floating.autoHide", String(value));
              setAutoHide(value);
            }} onBack={() => setManagementTab(null)} />}
        </div>
        <WorkspaceSidebar open={sidebarOpen} setTarget={setSidebarTarget} onManage={setManagementTab} current={managementTab}>
          {!collapsed && <SidebarResizer key={windowState?.mode ?? "full"} mode={windowState?.mode === "mini" ? "mini" : "full"} open={sidebarOpen} />}
        </WorkspaceSidebar>
      </div>
    </div>
    {collapsed && <FloatingEntry autoHide={autoHide} busy={busy} pinned={windowState.pinned} onPinChange={changePin}
      onSettings={() => void updateWindow(async () => {
        const restored = await setWindowMode(windowState.resume_mode);
        setManagementTab("settings");
        return restored;
      })} onExpand={() => void updateWindow(() => setWindowMode(windowState.resume_mode))} onError={() => setError(getText("app.windowError"))} />}
    {collapsed && error && <span className="visually-hidden" role="alert">{error}</span>}
  </div>;
}
