package com.example.mykeyboard.personal

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale
import java.util.UUID

class JarvisSpeaker(context: Context) : TextToSpeech.OnInitListener {
    private val appContext = context.applicationContext
    private var tts: TextToSpeech? = TextToSpeech(appContext, this)
    private var ready = false
    private var pendingSpeech: String? = null

    override fun onInit(status: Int) {
        val engine = tts ?: return
        if (status == TextToSpeech.SUCCESS) {
            engine.language = Locale.getDefault()
            engine.setSpeechRate(0.96f)
            engine.setPitch(0.92f)
            ready = true
            pendingSpeech?.let { speak(it) }
            pendingSpeech = null
        } else {
            Log.w(TAG, "TextToSpeech init failed: $status")
        }
    }

    @Synchronized
    fun speak(text: String) {
        if (!PersonalJarvisConfig.isEnabled) return
        val clean = text.trim()
        if (clean.isEmpty()) return
        val engine = tts
        if (!ready || engine == null) {
            pendingSpeech = clean
            return
        }
        engine.stop()
        engine.speak(clean, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
    }

    @Synchronized
    fun shutdown() {
        pendingSpeech = null
        ready = false
        tts?.stop()
        tts?.shutdown()
        tts = null
    }

    private companion object {
        const val TAG = "AritenisJarvis"
    }
}
