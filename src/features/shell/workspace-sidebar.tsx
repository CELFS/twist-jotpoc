import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings, UserRound } from "lucide-react";
import type { ManagementTab } from "./settings-page";
import { getText } from "@/i18n/get-text";
import type { WorkspaceTab } from "./workspace";

type SidebarState = {
  target: HTMLDivElement | null;
  tab: WorkspaceTab;
  onSelect: () => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarHistory({ tab, children }: { tab: WorkspaceTab; children: ReactNode }) {
  const sidebar = useContext(SidebarContext);
  return sidebar?.target && sidebar.tab === tab ? createPortal(children, sidebar.target) : null;
}

export function useSidebarSelection() {
  return useContext(SidebarContext)?.onSelect;
}

export function ManagementButtons({ current, onManage }: {
  current: ManagementTab | null;
  onManage: (tab: ManagementTab) => void;
}) {
  return <>
    <button type="button" aria-label={getText("settings.shortLabel")} title={getText("settings.shortLabel")}
      aria-current={current === "settings" ? "page" : undefined} onClick={() => onManage("settings")}><Settings size={17} aria-hidden="true" /></button>
    <button type="button" aria-label={getText("client.account")} title={getText("client.account")}
      aria-current={current === "account" ? "page" : undefined} onClick={() => onManage("account")}><UserRound size={17} aria-hidden="true" /></button>
  </>;
}

export function WorkspaceSidebar({ open, setTarget, management, children }: {
  open: boolean;
  setTarget: (target: HTMLDivElement | null) => void;
  children: ReactNode;
  management: ReactNode;
}) {
  return <aside id="workspace-sidebar" inert={!open} aria-hidden={!open} className="workspace-sidebar" aria-label={getText("client.sidebar")}>
    {children}
    <div className="sidebar-viewport">
      <div className="sidebar-scroll custom-scrollbar">
        <div ref={setTarget} />
      </div>
    </div>
    {management && <footer className="sidebar-management">{management}</footer>}
  </aside>;
}
