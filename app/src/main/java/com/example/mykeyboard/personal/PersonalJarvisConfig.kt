package com.example.mykeyboard.personal

import com.example.mykeyboard.BuildConfig

object PersonalJarvisConfig {
    val isEnabled: Boolean
        get() = BuildConfig.PERSONAL_JARVIS_ENABLED

    const val ALERT_CHANNEL_ID = "aritenis_personal_jarvis_alerts"
    const val ALERT_NOTIFICATION_ID = 8801
    const val REMINDER_NOTIFICATION_ID = 8802
    const val REMINDER_ACTION = "com.example.mykeyboard.personal.REMIND_RELEASE"
    const val EXTRA_SPEECH = "speech"
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
}
