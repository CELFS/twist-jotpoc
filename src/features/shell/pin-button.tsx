import { Pin, PinOff } from "lucide-react";
import { getText } from "@/i18n/get-text";

export function PinButton({ busy, pinned, onPinChange }: {
  busy: boolean;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
}) {
  return (
    <button
      aria-label={getText(pinned ? "app.unpin" : "app.pin")}
      aria-pressed={pinned}
      disabled={busy}
      title={getText(pinned ? "app.unpin" : "app.pin")}
      type="button"
      onClick={() => onPinChange(!pinned)}
    >
      {pinned ? <PinOff size={18} /> : <Pin size={18} />}
    </button>
  );
}
