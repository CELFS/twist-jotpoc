import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function WorkspaceSidebar({ open, setTarget, onManage, onCollections, collections }: {
  open: boolean;
  setTarget: (target: HTMLDivElement | null) => void;
  onManage: () => void;
  onCollections: () => void;
  collections: boolean;
}) {
  return <aside id="workspace-sidebar" hidden={!open} className="workspace-sidebar" aria-label={getText("client.sidebar")}>
    <div className="sidebar-scroll custom-scrollbar">
      <div ref={setTarget} />
      {collections && <Button variant="ghost" onClick={onCollections}>{getText("client.collections")}</Button>}
    </div>
    <Button className="sidebar-management" variant="ghost" onClick={onManage}>
      <Settings size={16} aria-hidden="true" />{getText("client.management")}
    </Button>
  </aside>;
}
