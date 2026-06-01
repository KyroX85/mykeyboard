package com.example.mykeyboard.personal

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper

class JarvisReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!PersonalJarvisConfig.isEnabled || intent.action != PersonalJarvisConfig.REMINDER_ACTION) return
        val speech = intent.getStringExtra(PersonalJarvisConfig.EXTRA_SPEECH)
            ?: "Sir, this is your Aritenis build reminder."
        val title = intent.getStringExtra(PersonalJarvisConfig.EXTRA_TITLE)
            ?: "Aritenis build reminder"
        val message = intent.getStringExtra(PersonalJarvisConfig.EXTRA_MESSAGE)
            ?: "Check your latest Aritenis build."

        JarvisNotificationCenter(context).showReminder(title, message)
        val speaker = JarvisSpeaker(context)
        speaker.speak(speech)
        Handler(Looper.getMainLooper()).postDelayed({ speaker.shutdown() }, SPEAKER_SHUTDOWN_DELAY_MS)
    }

    private companion object {
        const val SPEAKER_SHUTDOWN_DELAY_MS = 5_000L
    }
}
