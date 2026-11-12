import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getText } from "@/i18n/get-text";

export function TranslationDeleteConfirmation({ source, busy, feedback, onCancel, onConfirm }: {
  source: "local" | "cloud" | "conversation";
  busy: boolean;
  feedback?: string;
  onCancel(): void;
  onConfirm(): void;
}) {
  return <ConfirmDialog open busy={busy} feedback={feedback}
    title={getText(source === "cloud" ? "translation.deleteCloudTitle" : source === "conversation" ? "translation.deleteConversationTitle" : "translation.deleteLocalTitle")}
    description={getText(source === "cloud" ? "translation.deleteCloudDescription" : source === "conversation" ? "translation.deleteConversationDescription" : "translation.deleteLocalDescription")}
    closeLabel={getText("common.close")} cancelLabel={getText("common.cancel")} confirmLabel={getText("translation.delete")}
    onCancel={onCancel} onConfirm={onConfirm} />;
}
