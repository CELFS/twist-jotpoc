import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, RefreshCw } from "lucide-react";
import { z } from "zod";
import packageInfo from "../../../package.json";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { getText, type MessageKey } from "@/i18n/get-text";
import { publicFetch, readJson } from "@/platform/http";

type DownloadState = {
  platform: string;
  installedCode: number;
  targetCode: number;
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

export function AndroidUpdateCard() {
  const [task, setTask] = useState<DownloadState | null>(null);
  const [release, setRelease] = useState<z.infer<typeof releaseSchema> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    setError(null);
    async function check() {
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
  }, [attempt]);

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

  const available = release && task && release.versionCode > task.installedCode;
  const downloading = task?.phase === "downloading";
  const ready = task?.phase === "ready";
  return <section className="account-panel android-update-card">
    <div className="connection-heading"><h2>{getText("androidUpdate.check")}</h2>
      <Button variant="ghost" size="icon" disabled={checking || busy || downloading} aria-label={getText("androidUpdate.check")}
        onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /></Button>
    </div>
    <div>{getText("androidUpdate.installed")} · v{packageInfo.version}</div>
    {checking && !release && <LoadingState compact rows={1} label={getText("androidUpdate.check")} />}
    {release && <div>{getText("androidUpdate.latest")} · v{release.version}</div>}
    {downloading && <div role="status">
      {getText("androidUpdate.downloading")} · v{task.targetVersion}
      {task.total > 0 && " · " + Math.floor(100 * task.received / task.total) + "%"}
      <progress aria-label={getText("androidUpdate.downloading")} max={task.total > 0 ? task.total : 1}
        value={task.total > 0 ? task.received : undefined} />
    </div>}
    {ready && <Button disabled={busy} onClick={() => void install()}>{getText("androidUpdate.install")} · v{task.targetVersion}</Button>}
    {available && !downloading && (!ready || release.versionCode > task.targetCode) &&
      <Button disabled={busy} onClick={() => void download()}><Download size={16} />{getText(task.phase === "failed" ? "androidUpdate.retry" : "androidUpdate.download")}</Button>}
    {!available && !checking && !error && release && !ready && !downloading && <span>{getText("androidUpdate.current")}</span>}
    {(error || task?.phase === "failed") && <p role="alert">{getText(error ?? "androidUpdate.failed")}</p>}
  </section>;
}
