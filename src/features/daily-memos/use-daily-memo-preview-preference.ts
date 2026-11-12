
import { useSyncExternalStore } from "react";

const storageKey = "jotpoc.daily-memo-preview";
const changeEvent = "jotpoc:daily-memo-preview";

function getSnapshot() {
  return window.localStorage.getItem(storageKey) === "true";
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, listener);
  };
}

function setPreview(preview: boolean) {
  window.localStorage.setItem(storageKey, String(preview));
  window.dispatchEvent(new Event(changeEvent));
}

export function useDailyMemoPreviewPreference() {
  const preview = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return { preview, setPreview };
}
