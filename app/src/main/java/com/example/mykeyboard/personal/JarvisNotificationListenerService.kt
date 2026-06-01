package com.example.mykeyboard.personal

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class JarvisNotificationListenerService : NotificationListenerService() {
    private lateinit var speaker: JarvisSpeaker
    private lateinit var notificationCenter: JarvisNotificationCenter
    private var lastAlertKey = ""
    private var lastAlertAtMs = 0L

    override fun onCreate() {
        super.onCreate()
        speaker = JarvisSpeaker(this)
        notificationCenter = JarvisNotificationCenter(this)
    }

    override fun onDestroy() {
        if (::speaker.isInitialized) {
            speaker.shutdown()
        }
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (!PersonalJarvisConfig.isEnabled || sbn == null) return
        val snapshot = sbn.toSnapshot()
        val signal = JarvisReleaseDetector.detect(snapshot) ?: return
        if (isDuplicate(sbn.key)) return

        Log.i(TAG, "Personal Jarvis release signal: ${signal.priority}")
        speaker.speak(signal.speech)
        notificationCenter.showReleaseAlert(signal, sbn.notification.contentIntent)
    }

    private fun isDuplicate(key: String): Boolean {
        val now = System.currentTimeMillis()
        if (key == lastAlertKey && now - lastAlertAtMs < DUPLICATE_SUPPRESSION_MS) {
            return true
        }
        lastAlertKey = key
        lastAlertAtMs = now
        return false
    }

    private fun StatusBarNotification.toSnapshot(): JarvisNotificationSnapshot {
        val extras = notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        return JarvisNotificationSnapshot(
            packageName = packageName.orEmpty(),
            title = title,
            text = text,
            bigText = bigText
        )
    }

    private companion object {
        const val TAG = "AritenisJarvis"
        const val DUPLICATE_SUPPRESSION_MS = 90_000L
    }
}
