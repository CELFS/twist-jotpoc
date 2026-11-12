
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Drawer } from "@/components/ui/drawer";

export type DialogProps = {
  children: ReactNode;
  closeLabel: string;
  footer?: ReactNode;
  footerClassName?: string;
  mobileHeight?: "auto" | "60dvh" | "72dvh";
  onClose: () => void;
  open: boolean;
  title: string;
  topOverlay?: ReactNode;
};

export function Dialog({
  children,
  closeLabel,
  footer,
  footerClassName,
  mobileHeight = "auto",
  onClose,
  open,
  title,
  topOverlay,
}: DialogProps) {
  return (
    <Drawer
      ariaLabel={title}
      className={`ui-drawer--responsive ui-dialog${
        mobileHeight === "60dvh"
          ? " ui-dialog--mobile-height-60"
          : mobileHeight === "72dvh"
            ? " ui-dialog--mobile-height-72"
          : ""
      }`}
      contentClassName="ui-dialog-content custom-scrollbar"
      footer={footer}
      footerClassName={`ui-dialog-footer${footerClassName ? ` ${footerClassName}` : ""}`}
      header={
        <div className="ui-dialog-header">
          <h2 className="ui-dialog-title">{title}</h2>
          <button
            className="ui-icon-button"
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      topOverlay={topOverlay}
    >
      {children}
    </Drawer>
  );
}
