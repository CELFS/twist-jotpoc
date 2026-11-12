import { useState, useSyncExternalStore } from "react";
import { getThemePreference, setThemePreference, subscribeThemePreference } from "@/platform/theme";
import { Tabs } from "@/components/ui/tabs";
import { AccountPanel } from "@/features/auth/account-panel";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { setAppLanguagePreference, type AppLanguagePreference } from "@/i18n/app-language";
import { getText } from "@/i18n/get-text";

export function SettingsPage({ platform, language, desktop, autoHide, onAutoHideChange, onBack }: {
  platform: "macos" | "windows" | "other";
  language: AppLanguagePreference;
  desktop: boolean;
  autoHide: boolean;
  onAutoHideChange: (value: boolean) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"settings" | "account">("settings");
  const theme = useSyncExternalStore(subscribeThemePreference, getThemePreference);
  return (
    <main className="app-content settings-page custom-scrollbar" aria-label={getText("client.management")}>
      <div className="settings-heading">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={getText("common.back")} title={getText("common.back")}>
          <ArrowLeft size={18} />
        </Button>
        <Tabs id="management" className="ui-tabs--compact" ariaLabel={getText("client.management")}
          value={tab} onValueChange={setTab} items={[
            { value: "settings", label: getText("settings.shortLabel") },
            { value: "account", label: getText("client.account") },
          ]} />
      </div>
      <section id="management-panel-settings" role="tabpanel" aria-labelledby="management-tab-settings" hidden={tab !== "settings"}>
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
      </section>
      <section id="management-panel-account" role="tabpanel" aria-labelledby="management-tab-account" hidden={tab !== "account"}>
        <AccountPanel platform={platform} />
      </section>
    </main>
  );
}
