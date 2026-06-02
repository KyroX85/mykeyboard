package com.example.mykeyboard.personal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log

class JarvisNotificationCenter(private val context: Context) {
    private val appContext = context.applicationContext

    fun showReleaseAlert(signal: JarvisReleaseSignal, openIntent: PendingIntent?) {
        ensureChannel()
        val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = notificationBuilder()
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(signal.title)
            .setContentText(signal.message)
            .setStyle(Notification.BigTextStyle().bigText(signal.message))
            .setAutoCancel(true)
            .setPriority(Notification.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_STATUS)
            .setContentIntent(openIntent ?: notificationSettingsIntent())
            .addAction(
                android.R.drawable.ic_menu_view,
                "Open",
                openIntent ?: notificationSettingsIntent()
            )
            .addAction(
                android.R.drawable.ic_popup_reminder,
                "Remind me",
                reminderIntent(signal)
            )
            .build()
        try {
            manager.notify(PersonalJarvisConfig.ALERT_NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Jarvis alert notification permission missing", e)
        }
    }

    fun showBrainAnswer(answer: JarvisBrainAnswer) {
        ensureChannel()
        val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val message = answer.summary.ifBlank { answer.voiceSummary }
        val notification = notificationBuilder()
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Founder Brain")
            .setContentText(message)
            .setStyle(Notification.BigTextStyle().bigText(message))
            .setAutoCancel(true)
            .setPriority(Notification.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setContentIntent(notificationSettingsIntent())
            .build()
        try {
            manager.notify(PersonalJarvisConfig.BRAIN_ANSWER_NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Jarvis brain answer notification permission missing", e)
        }
    }

    fun showReminder(title: String, message: String) {
        ensureChannel()
        val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = notificationBuilder()
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title.ifBlank { "Aritenis reminder" })
            .setContentText(message.ifBlank { "Check your latest Aritenis build." })
            .setStyle(Notification.BigTextStyle().bigText(message))
            .setAutoCancel(true)
            .setPriority(Notification.PRIORITY_DEFAULT)
            .setContentIntent(notificationSettingsIntent())
            .build()
        try {
            manager.notify(PersonalJarvisConfig.REMINDER_NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Jarvis reminder notification permission missing", e)
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            PersonalJarvisConfig.ALERT_CHANNEL_ID,
            "Aritenis Jarvis alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Personal build and release alerts for Aritenis."
        }
        manager.createNotificationChannel(channel)
    }

    private fun reminderIntent(signal: JarvisReleaseSignal): PendingIntent {
        val intent = Intent(appContext, JarvisReminderReceiver::class.java).apply {
            action = PersonalJarvisConfig.REMINDER_ACTION
            putExtra(PersonalJarvisConfig.EXTRA_SPEECH, signal.speech)
            putExtra(PersonalJarvisConfig.EXTRA_TITLE, signal.title)
            putExtra(PersonalJarvisConfig.EXTRA_MESSAGE, signal.message)
        }
        return PendingIntent.getBroadcast(
            appContext,
            PersonalJarvisConfig.REMINDER_NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun notificationSettingsIntent(): PendingIntent {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return PendingIntent.getActivity(
            appContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun notificationBuilder(): Notification.Builder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(appContext, PersonalJarvisConfig.ALERT_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(appContext)
        }

    private companion object {
        const val TAG = "AritenisJarvis"
    }
}
