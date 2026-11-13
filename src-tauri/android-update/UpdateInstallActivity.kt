package app.twist.jotpoc

import android.app.Activity
import android.app.DownloadManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import java.security.MessageDigest

private const val CHANNEL = "jotpoc_updates"
private const val NOTICE = 1931

class UpdateCompleteReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
        val task = ApkDownload(context)
        if (task.id < 0 || task.id != intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)) return
        if (task.state().getString("phase") != "ready") return
        val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val label = task.prefs.getString("ready", "") ?: ""
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            notifications.createNotificationChannel(NotificationChannel(CHANNEL, "JotPoc", NotificationManager.IMPORTANCE_DEFAULT))
            Notification.Builder(context, CHANNEL)
        } else Notification.Builder(context)
        val open = Intent(context, UpdateInstallActivity::class.java).putExtra("id", task.id)
        val action = PendingIntent.getActivity(context, NOTICE, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notice = builder.setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("JotPoc v" + task.prefs.getString("version", ""))
            .setContentText(label).setContentIntent(action).setAutoCancel(true).build()
        if (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            notifications.notify(NOTICE, notice)
        }
    }
}

class UpdateInstallActivity : Activity() {
    private val task by lazy { ApkDownload(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        waiting = savedInstanceState?.getBoolean("waiting") == true
        if (waiting) return
        prepare()
    }

    private var waiting = false
    override fun onSaveInstanceState(state: Bundle) {
        state.putBoolean("waiting", waiting)
        super.onSaveInstanceState(state)
    }

    private fun prepare() {
        if (intent.getLongExtra("id", -1) != task.id || task.state().getString("phase") != "ready") {
            finish()
            return
        }
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            waiting = true
            startActivityForResult(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + packageName)), 1)
            return
        }
        val id = task.id
        val expected = task.prefs.getString("hash", "")
        Thread {
            try {
                val uri = requireNotNull(task.manager.getUriForDownloadedFile(id))
                val digest = MessageDigest.getInstance("SHA-256")
                requireNotNull(contentResolver.openInputStream(uri)).use { input ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        digest.update(buffer, 0, n)
                    }
                }
                val valid = digest.digest().joinToString("") { "%02x".format(it) } == expected
                if (!valid && id == task.id) task.manager.remove(id)
                check(valid && task.id == id)
                runOnUiThread {
                    if (!isDestroyed && !isFinishing) {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                            finish()
                        } catch (_: Exception) { failed() }
                    }
                }
            } catch (_: Exception) { runOnUiThread { failed() } }
        }.start()
    }

    private fun failed() {
        if (isDestroyed) return
        Toast.makeText(this, task.prefs.getString("error", ""), Toast.LENGTH_LONG).show()
        finish()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        waiting = false
        if (requestCode == 1 && Build.VERSION.SDK_INT >= 26 && packageManager.canRequestPackageInstalls()) prepare()
        else finish()
    }
}
