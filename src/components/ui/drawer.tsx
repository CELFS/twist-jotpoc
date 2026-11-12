
import {
  useEffect,
  useRef,
  type MouseEventHandler,
  type ReactNode,
} from "react";

export type DrawerProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  header?: ReactNode;
  onClose: () => void;
  onContentClickCapture?: MouseEventHandler<HTMLDivElement>;
  open?: boolean;
  persistent?: boolean;
  topOverlay?: ReactNode;
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function Drawer({
  ariaLabel,
  children,
  className,
  contentClassName,
  footer,
  footerClassName,
  header,
  onClose,
  onContentClickCapture,
  open = true,
  persistent = false,
  topOverlay,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const persistentDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (persistent) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, persistent]);

  useEffect(() => {
    if (!persistent || !open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const animationFrame = window.requestAnimationFrame(() => {
      persistentDrawerRef.current?.focus({ preventScroll: true });
    });

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, persistent]);

  const drawerContent = (
    <>
      {topOverlay}
      <div className="ui-drawer-handle" aria-hidden="true" />
      {header}
      <div
        className={joinClassNames(
          "ui-drawer-content",
          contentClassName,
        )}
        onClickCapture={onContentClickCapture}
      >
        {children}
      </div>
      {footer ? (
        <footer
          className={joinClassNames(
            "ui-drawer-footer",
            footerClassName,
          )}
        >
          {footer}
        </footer>
      ) : null}
    </>
  );

  if (persistent) {
    return (
      <div
        aria-hidden={!open}
        className="ui-drawer-layer"
        data-open={open}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          ref={persistentDrawerRef}
          aria-label={ariaLabel}
          aria-modal="true"
          className={joinClassNames(
            "ui-drawer",
            "ui-drawer--persistent",
            topOverlay ? "ui-drawer--top-overlay" : undefined,
            className,
          )}
          role="dialog"
          tabIndex={-1}
          onWheel={(event) => event.stopPropagation()}
        >
          {drawerContent}
        </div>
      </div>
    );
  }

  return (
    <dialog
      aria-label={ariaLabel}
      className={joinClassNames(
        "ui-drawer",
        topOverlay ? "ui-drawer--top-overlay" : undefined,
        className,
      )}
      ref={dialogRef}
      onWheel={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {drawerContent}
    </dialog>
  );
}
