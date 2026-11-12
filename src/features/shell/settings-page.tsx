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
  return (
    <main className="app-content settings-page custom-scrollbar" aria-labelledby="settings-title">
      <div className="settings-heading">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={getText("common.back")} title={getText("common.back")}>
          <ArrowLeft size={18} />
        </Button>
        <h2 id="settings-title">{getText("settings.shortLabel")}</h2>
      </div>
      <SelectField label={getText("client.language")} value={language}
        onChange={event => setAppLanguagePreference(event.target.value as AppLanguagePreference)}>
        <option value="zh">{getText("client.languageZh")}</option>
        <option value="en">{getText("client.languageEn")}</option>
        <option value="system">{getText("client.languageSystem")}</option>
      </SelectField>
      {desktop && <div className="floating-setting">
        <span>{getText("client.floatingAutoHide")}</span>
        <Switch label={getText("client.floatingAutoHide")} checked={autoHide} onCheckedChange={onAutoHideChange} />
      </div>}
    </main>
  );
}
