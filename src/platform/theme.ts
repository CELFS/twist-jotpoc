export type ThemePreference = "system" | "light" | "dark";

const storageKey = "jotpoc.theme";
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function parsePreference(value: string | null): ThemePreference {
  return value === "dark" || value === "light" ? value : "system";
}

function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(storageKey));
  } catch {
    return "system";
  }
}

let preference = readPreference();

function applyTheme() {
  document.documentElement.dataset.theme = preference === "system"
    ? (systemTheme.matches ? "dark" : "light")
    : preference;
}

function updatePreference(value: ThemePreference) {
  preference = value;
  applyTheme();
  for (const listener of listeners) listener();
}

export function initializeTheme() {
  applyTheme();
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) {
      updatePreference(readPreference());
    }
  };
  systemTheme.addEventListener("change", applyTheme);
  window.addEventListener("storage", onStorage);
  return () => {
    systemTheme.removeEventListener("change", applyTheme);
    window.removeEventListener("storage", onStorage);
  };
}

export function getThemePreference() {
  return preference;
}

export function subscribeThemePreference(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setThemePreference(value: string) {
  const next = parsePreference(value);
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Keep the selected appearance for this session when storage is unavailable.
  }
  updatePreference(next);
}
