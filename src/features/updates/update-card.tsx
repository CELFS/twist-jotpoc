import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { Download, RefreshCw } from "lucide-react";
import { z } from "zod";
import packageInfo from "../../../package.json";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { getText, type MessageKey } from "@/i18n/get-text";
import { publicFetch, readJson, TWIST_BALANCE_ORIGIN } from "@/platform/http";

type DownloadState = {
  platform: string;
  installedCode: number;
  installedHash: string;
  targetHash: string;
  targetVersion: string;
  phase: "idle" | "downloading" | "ready" | "failed";
  received: number;
  total: number;
};
const releaseSchema = z.object({
  platform: z.string(), version: z.string(), versionCode: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), url: z.string().startsWith("/downloads/jotpoc/"),
});
const readStatus = () => invoke<DownloadState>("plugin:apk-update|status");

const desktopPackageExtensions = {
  macos: ".dmg",
  windows: ".exe",
  linux: ".deb",
} as const;

type UpdatePlatform = keyof typeof desktopPackageExtensions | "android";

export function supportsUpdates(platform?: string): platform is UpdatePlatform {
  return platform === "android" || (platform !== undefined && Object.hasOwn(desktopPackageExtensions, platform));
}

const desktopReleaseSchema = z.object({
  platform: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  installedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  url: z.string().regex(/^\/downloads\/jotpoc\/[\w.-]+$/),
});

export function UpdateCard({ platform }: { platform: UpdatePlatform }) {
  const [task, setTask] = useState<DownloadState | null>(null);
  const [release, setRelease] = useState<z.infer<typeof releaseSchema> | null>(null);
  const [desktopRelease, setDesktopRelease] = useState<z.infer<typeof desktopReleaseSchema> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    setError(null);
    async function check() {
      if (platform !== "android") {
        const query = new URLSearchParams({ platform, build: import.meta.env.VITE_JOTPOC_BUILD_ID ?? "" });
        const response = await publicFetch("/api/extension/jotpoc-release?" + query, { signal: controller.signal });
        const latest = desktopReleaseSchema.parse(await readJson(response));
        if (latest.platform !== platform || !latest.url.endsWith(desktopPackageExtensions[platform])) {
          throw new Error("platform");
        }
        if (!controller.signal.aborted) setDesktopRelease(latest);
        return;
      }
      const state = await readStatus();
      if (controller.signal.aborted) return;
      setTask(state);
      const response = await publicFetch("/api/extension/jotpoc-release?platform=" + encodeURIComponent(state.platform), { signal: controller.signal });
      const latest = releaseSchema.parse(await readJson(response));
      if (latest.platform !== state.platform) throw new Error("platform");
      if (!controller.signal.aborted) setRelease(latest);
    }
    void check().catch(() => {
      if (!controller.signal.aborted) setError("androidUpdate.checkFailed");
    }).finally(() => {
      if (!controller.signal.aborted) setChecking(false);
    });
    return () => controller.abort();
  }, [attempt, platform]);

  useEffect(() => {
    if (task?.phase !== "downloading") return;
    let active = true;
    let timer: number;
    async function poll() {
      try {
        const state = await readStatus();
        if (active) setTask(state);
      } catch {
        if (active) setError("androidUpdate.checkFailed");
      } finally {
        if (active) timer = window.setTimeout(poll, 1000);
      }
    }
    timer = window.setTimeout(poll, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [task?.phase]);

  async function download() {
    if (!release) return;
    setBusy(true);
    setError(null);
    try {
      await invoke("plugin:apk-update|download", { release: { ...release, readyLabel: getText("androidUpdate.ready"), errorLabel: getText("androidUpdate.installFailed") } });
      setTask(await readStatus());
    } catch { setError("androidUpdate.failed"); }
    finally { setBusy(false); }
  }

  async function install() {
    setBusy(true);
    setError(null);
    try { await invoke("plugin:apk-update|install"); }
    catch { setError("androidUpdate.installFailed"); }
    finally { setBusy(false); }
  }

  const available = release && task && release.sha256 !== task.installedHash && release.versionCode >= task.installedCode;
  const downloading = task?.phase === "downloading";
  const ready = task?.phase === "ready" && (!release || task.targetHash === release.sha256);
  return <section className="account-panel android-update-card">
    <div className="connection-heading"><h2>{getText("androidUpdate.check")}</h2>
      <Button variant="ghost" size="icon" disabled={checking || busy || downloading} aria-label={getText("androidUpdate.check")}
        onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /></Button>
    </div>
    <div>{getText("androidUpdate.installed")} · v{packageInfo.version}</div>
    {desktopRelease && <>
      <div>{getText("androidUpdate.latest")} · v{desktopRelease.version}</div>
      {desktopRelease.sha256 !== desktopRelease.installedSha256
        ? <Button onClick={() => void openUrl(new URL(desktopRelease.url, TWIST_BALANCE_ORIGIN).href)
            .catch(() => setError("androidUpdate.failed"))}><Download size={16} />{getText("androidUpdate.download")}</Button>
        : <span>{getText("androidUpdate.current")}</span>}
    </>}
    {checking && !release && !desktopRelease && <LoadingState compact rows={1} label={getText("androidUpdate.check")} />}
    {release && <div>{getText("androidUpdate.latest")} · v{release.version}</div>}
    {downloading && <div role="status">
      {getText("androidUpdate.downloading")} · v{task.targetVersion}
      {task.total > 0 && " · " + Math.floor(100 * task.received / task.total) + "%"}
      <progress aria-label={getText("androidUpdate.downloading")} max={task.total > 0 ? task.total : 1}
        value={task.total > 0 ? task.received : undefined} />
    </div>}
    {ready && <Button disabled={busy} onClick={() => void install()}>{getText("androidUpdate.install")} · v{task.targetVersion}</Button>}
    {available && !downloading && !ready &&
      <Button disabled={busy} onClick={() => void download()}><Download size={16} />{getText(task.phase === "failed" ? "androidUpdate.retry" : "androidUpdate.download")}</Button>}
    {!available && !checking && !error && release && !ready && !downloading && <span>{getText("androidUpdate.current")}</span>}
    {(error || task?.phase === "failed") && <p role="alert">{getText(error ?? "androidUpdate.failed")}</p>}
  </section>;
}
