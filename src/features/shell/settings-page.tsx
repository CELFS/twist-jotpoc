import { useSyncExternalStore } from "react";
import { getThemePreference, setThemePreference, subscribeThemePreference } from "@/platform/theme";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { setAppLanguagePreference, type AppLanguagePreference } from "@/i18n/app-language";
import { getText } from "@/i18n/get-text";

export function SettingsPage({ language, desktop, autoHide, onAutoHideChange, onBack }: {
  language: AppLanguagePreference;
  desktop: boolean;
  autoHide: boolean;
  onAutoHideChange: (value: boolean) => void;
  onBack: () => void;
}) {
  const theme = useSyncExternalStore(subscribeThemePreference, getThemePreference);
  return (
    <main className="app-content settings-page custom-scrollbar" aria-label={getText("settings.shortLabel")}>
      <div className="settings-heading">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={getText("common.back")} title={getText("common.back")}>
          <ArrowLeft size={18} />
        </Button>
      </div>
      <SelectField label={getText("client.language")} value={language}
        onChange={event => setAppLanguagePreference(event.target.value as AppLanguagePreference)}>
        <option value="zh">{getText("client.languageZh")}</option>
        <option value="en">{getText("client.languageEn")}</option>
        <option value="system">{getText("client.languageSystem")}</option>
      </SelectField>
      <SelectField label={getText("client.theme")} value={theme}
        onChange={event => setThemePreference(event.target.value)}>
        <option value="system">{getText("client.themeSystem")}</option>
        <option value="light">{getText("client.themeLight")}</option>
        <option value="dark">{getText("client.themeDark")}</option>
      </SelectField>
      {desktop && <div className="floating-setting">
        <span>{getText("client.floatingAutoHide")}</span>
        <Switch label={getText("client.floatingAutoHide")} checked={autoHide} onCheckedChange={onAutoHideChange} />
      </div>}
    </main>
  );
}
