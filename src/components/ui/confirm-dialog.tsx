
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  busy?: boolean;
  cancelLabel: string;
  closeLabel: string;
  confirmLabel: string;
  description: string;
  feedback?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
};

export function ConfirmDialog({
  busy = false,
  cancelLabel,
  closeLabel,
  confirmLabel,
  description,
  feedback,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  const cancel = () => {
    if (!busy) {
      onCancel();
    }
  };

  return (
    <Dialog
      closeLabel={closeLabel}
      footer={
        <>
          <Button
            disabled={busy}
            variant="secondary"
            onClick={cancel}
          >
            {cancelLabel}
          </Button>
          <Button disabled={busy} variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
      onClose={cancel}
      open={open}
      title={title}
    >
      <p className="ui-dialog-description">{description}</p>
      {feedback ? <p className="ui-dialog-feedback" role="alert">{feedback}</p> : null}
    </Dialog>
  );
}
