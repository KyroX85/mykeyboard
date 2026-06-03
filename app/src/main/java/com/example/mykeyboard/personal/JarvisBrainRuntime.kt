package com.example.mykeyboard.personal

import android.content.Context
import android.util.Log

object JarvisBrainRuntime {
    @Volatile
    private var sharedConnector: JarvisBrainConnector? = null

    @Synchronized
    fun initialize(context: Context) {
        if (!PersonalJarvisConfig.isEnabled) {
            Log.i(TAG, "Founder Brain runtime skipped: Personal Jarvis disabled")
            return
        }
        if (sharedConnector != null) return
        sharedConnector = JarvisBrainConnector().also { connector ->
            connector.initialize()
            Log.i(TAG, "Founder Brain runtime initialized for ${context.applicationContext.packageName}")
        }
    }

    fun connector(context: Context): JarvisBrainConnector {
        initialize(context.applicationContext)
        return sharedConnector ?: JarvisBrainConnector().also { fallback ->
            fallback.initialize()
            sharedConnector = fallback
        }
    }

    private const val TAG = "AritenisJarvis"
}
