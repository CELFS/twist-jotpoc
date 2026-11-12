export const APP_LANGUAGE_STORAGE_KEY = "jotpoc.app-language";

export const APP_LANGUAGE_CHANGE_EVENT =
  "jotpoc:app-language-change";

export const APP_LANGUAGE_PREFERENCES = [
  "zh",
  "system",
  "en",
] as const;

export type AppLanguagePreference =
  (typeof APP_LANGUAGE_PREFERENCES)[number];

export type ResolvedAppLanguage = "zh" | "en";

export const DEFAULT_APP_LANGUAGE: AppLanguagePreference = "zh";

export function parseAppLanguagePreference(
  value: unknown,
): AppLanguagePreference {
  return APP_LANGUAGE_PREFERENCES.includes(
    value as AppLanguagePreference,
  )
    ? (value as AppLanguagePreference)
    : DEFAULT_APP_LANGUAGE;
}

export function resolveAppLanguage(
  preference: AppLanguagePreference,
  browserLanguages: readonly string[],
): ResolvedAppLanguage {
  if (preference !== "system") {
    return preference;
  }

  return browserLanguages.some((language) =>
    language.toLowerCase().startsWith("zh"),
  )
    ? "zh"
    : "en";
}

export function getStoredAppLanguage(): AppLanguagePreference {
  if (typeof window === "undefined") {
    return DEFAULT_APP_LANGUAGE;
  }

  try {
    return parseAppLanguagePreference(
      window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return parseAppLanguagePreference(
      document.documentElement.dataset.languagePreference,
    );
  }
}

export function getResolvedAppLanguage(): ResolvedAppLanguage {
  if (typeof document === "undefined") {
    return "zh";
  }

  return document.documentElement.dataset.language === "en"
    ? "en"
    : "zh";
}

export function getIntlLocale(): "zh-CN" | "en-US" {
  return getResolvedAppLanguage() === "en" ? "en-US" : "zh-CN";
}

export function applyAppLanguage(
  preference: AppLanguagePreference,
): ResolvedAppLanguage {
  const resolvedLanguage = resolveAppLanguage(
    preference,
    navigator.languages?.length
      ? navigator.languages
      : [navigator.language],
  );
  const root = document.documentElement;

  root.dataset.language = resolvedLanguage;
  root.dataset.languagePreference = preference;
  root.lang = resolvedLanguage === "en" ? "en" : "zh-CN";

  return resolvedLanguage;
}

export function setAppLanguagePreference(
  preference: AppLanguagePreference,
): void {
  try {
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, preference);
  } catch {
    // The selected language still applies for the current page when storage is unavailable.
  }

  applyAppLanguage(preference);
  window.dispatchEvent(new Event(APP_LANGUAGE_CHANGE_EVENT));
}

export function subscribeAppLanguagePreference(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === APP_LANGUAGE_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(APP_LANGUAGE_CHANGE_EVENT, listener);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(APP_LANGUAGE_CHANGE_EVENT, listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}
