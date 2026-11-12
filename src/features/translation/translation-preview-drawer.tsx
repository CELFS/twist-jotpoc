import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { getText } from "@/i18n/get-text";

export function TranslationPreviewDrawer({ title, children, onClose, onBack, open = true }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  open?: boolean;
}) {
  return <Drawer ariaLabel={title} open={open} onClose={onClose} className="translation-drawer" contentClassName="custom-scrollbar"
    header={<header className="translation-drawer-header">
      {onBack && <Button size="icon" variant="ghost" aria-label={getText("translation.back")} onClick={onBack}><ArrowLeft aria-hidden="true" size={19} /></Button>}
      <h2>{title}</h2>
    </header>}>
    {children}
  </Drawer>;
}
