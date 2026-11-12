const storageKey = "jotpoc.textSize";

function normalize(value: string | null) {
  return value === "small" || value === "large" ? value : "standard";
}

export function getTextSize() {
  return normalize(document.documentElement.dataset.textSize ?? null);
}

function apply(value: string | null) {
  document.documentElement.dataset.textSize = normalize(value);
  window.dispatchEvent(new Event("jotpoc:text-size"));
}

export function subscribeTextSize(listener: () => void) {
  window.addEventListener("jotpoc:text-size", listener);
  return () => window.removeEventListener("jotpoc:text-size", listener);
}

export function initializeTextSize() {
  const read = () => {
    try { apply(localStorage.getItem(storageKey)); }
    catch { apply(null); }
  };
  read();
  const sync = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) read();
  };
  window.addEventListener("storage", sync);
  return () => window.removeEventListener("storage", sync);
}

export function setTextSize(value: string) {
  const size = normalize(value);
  try { localStorage.setItem(storageKey, size); }
  catch { /* Apply the preference for this session when storage is unavailable. */ }
  apply(size);
}
