package com.example.mykeyboard.personal

import android.content.Context
import android.util.Log
import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineException
import ai.picovoice.porcupine.PorcupineManager
import ai.picovoice.porcupine.PorcupineManagerCallback

class JarvisPorcupineWakeEngine(
    private val context: Context,
    private val onWakeDetected: () -> Unit
) {
    private var manager: PorcupineManager? = null
    private var isStarted = false

    val isConfigured: Boolean
        get() = PersonalJarvisConfig.picovoiceAccessKey().isNotBlank()

    fun start(): Boolean {
        if (!isConfigured) {
            Log.i(TAG, "Porcupine wake unavailable: missing Picovoice access key")
            return false
        }
        if (isStarted) {
            Log.d(TAG, "Porcupine wake start ignored: already started")
            return true
        }
        return try {
            val activeManager = manager ?: buildManager().also { manager = it }
            activeManager.start()
            isStarted = true
            Log.i(TAG, "Porcupine wake started: keyword=JARVIS")
            true
        } catch (e: PorcupineException) {
            Log.w(TAG, "Porcupine wake start failed", e)
            false
        } catch (e: RuntimeException) {
            Log.w(TAG, "Porcupine wake runtime failure", e)
            false
        }
    }

    fun stop(reason: String) {
        if (!isStarted) return
        try {
            manager?.stop()
            Log.i(TAG, "Porcupine wake stopped: $reason")
        } catch (e: PorcupineException) {
            Log.w(TAG, "Porcupine wake stop failed", e)
        } catch (e: RuntimeException) {
            Log.w(TAG, "Porcupine wake stop runtime failure", e)
        } finally {
            isStarted = false
        }
    }

    fun shutdown() {
        stop("shutdown")
        try {
            manager?.delete()
        } catch (e: RuntimeException) {
            Log.w(TAG, "Porcupine wake delete failed", e)
        } finally {
            manager = null
        }
    }

    private fun buildManager(): PorcupineManager {
        val callback = PorcupineManagerCallback { keywordIndex ->
            Log.i(TAG, "Porcupine wake metric: REAL_WAKE; phrase=\"jarvis\"; confidence=unknown; source=porcupine; audioSource=unknown; reason=porcupine keyword match")
            Log.i(TAG, "Porcupine wake detected: keywordIndex=$keywordIndex")
            onWakeDetected()
        }
        return PorcupineManager.Builder()
            .setAccessKey(PersonalJarvisConfig.picovoiceAccessKey())
            .setKeyword(Porcupine.BuiltInKeyword.JARVIS)
            .build(context.applicationContext, callback)
    }

    private companion object {
        const val TAG = "AritenisJarvisWake"
    }
}
