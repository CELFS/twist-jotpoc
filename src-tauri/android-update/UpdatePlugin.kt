package app.twist.jotpoc

import android.Manifest
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

internal class ApkDownload(val context: Context) {
    val prefs = context.getSharedPreferences("apk-update", Context.MODE_PRIVATE)
    val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    val id get() = prefs.getLong("id", -1)
    val targetCode get() = prefs.getLong("code", 0)
    val installedCode: Long get() {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
    }
    fun state(): JSObject {
        val result = JSObject()
        result.put("platform", "android-" + installedAbi())
        result.put("installedCode", installedCode)
        result.put("phase", "idle")
        result.put("received", 0)
        result.put("total", 0)
        result.put("targetCode", targetCode)
        result.put("targetVersion", prefs.getString("version", ""))
        if (id < 0) return result
        if (targetCode <= installedCode) {
            manager.remove(id)
            prefs.edit().clear().apply()
            return result
        }
        result.put("phase", "failed")
        manager.query(DownloadManager.Query().setFilterById(id))?.use { row ->
            if (row.moveToFirst()) {
                val status = row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                result.put("phase", when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> "ready"
                    DownloadManager.STATUS_FAILED -> "failed"
                    else -> "downloading"
                })
                result.put("received", row.getLong(row.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)))
                result.put("total", row.getLong(row.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)))
            }
        }
        return result
    }

    // Each release APK contains one ABI. Use the installed library, including 32-bit installs on 64-bit hardware.
    fun installedAbi(): String {
        java.util.zip.ZipFile(context.applicationInfo.sourceDir).use { zip ->
            return Build.SUPPORTED_ABIS.first { zip.getEntry("lib/" + it + "/libjotpoc_lib.so") != null }
        }
    }

    fun start(args: JSObject) {
        val code = args.getLong("versionCode")
        val version = args.getString("version")
        val hash = args.getString("sha256")
        require(code > installedCode && Regex("[0-9]+\\.[0-9]+\\.[0-9]+").matches(version))
        require(Regex("[a-f0-9]{64}").matches(hash))
        val file = "JotPoc-" + version + "-android-" + installedAbi() + "-" + hash.take(16) + ".apk"
        require(args.getString("url") == "/downloads/jotpoc/" + file)
        if (targetCode == code && prefs.getString("hash", "") == hash && state().getString("phase") in listOf("downloading", "ready")) return
        if (id >= 0) manager.remove(id)
        val request = DownloadManager.Request(Uri.parse("https://twist-balance.pages.dev/downloads/jotpoc/" + file))
            .setTitle("JotPoc v" + version)
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, file)
        val next = manager.enqueue(request)
        prefs.edit().putLong("id", next).putLong("code", code).putString("hash", hash)
            .putString("error", args.getString("errorLabel")).putString("version", version).putString("ready", args.getString("readyLabel")).commit()
    }
}

@TauriPlugin(permissions = [Permission(strings = ["android.permission.POST_NOTIFICATIONS"], alias = "notifications")])
class UpdatePlugin(private val host: Activity) : Plugin(host) {
    private val downloadState = ApkDownload(host)

    @Command fun status(invoke: Invoke) {
        try { invoke.resolve(downloadState.state()) } catch (e: Exception) { invoke.reject(e.message) }
    }
    @Command fun download(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= 33 && host.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications", invoke, "beginDownload")
        } else beginDownload(invoke)
    }
    @PermissionCallback fun beginDownload(invoke: Invoke) {
        try { downloadState.start(invoke.getArgs()); invoke.resolve() } catch (e: Exception) { invoke.reject(e.message) }
    }
    @Command fun install(invoke: Invoke) {
        try {
            require(downloadState.state().getString("phase") == "ready")
            host.startActivity(Intent(host, UpdateInstallActivity::class.java).putExtra("id", downloadState.id))
            invoke.resolve()
        } catch (e: Exception) { invoke.reject(e.message) }
    }
}
