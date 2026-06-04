package com.example.mykeyboard.personal

import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale
import java.util.UUID

class JarvisSpeaker(context: Context) : TextToSpeech.OnInitListener {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null
    private var audioFocusAttached = false
    private var tts: TextToSpeech? = createTextToSpeech()
    private var ready = false
    private var pendingSpeech: PendingSpeech? = null
    private var activeUtteranceId: String? = null
    private var activeCompletion: (() -> Unit)? = null

    override fun onInit(status: Int) {
        val engine = tts ?: return
        if (status == TextToSpeech.SUCCESS) {
            engine.language = Locale.getDefault()
            engine.setSpeechRate(SPEECH_RATE)
            engine.setPitch(PITCH)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                engine.setAudioAttributes(speechAudioAttributes())
            }
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit
                override fun onDone(utteranceId: String?) {
                    completeUtterance(utteranceId)
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    completeUtterance(utteranceId)
                }
            })
            ready = true
            Log.i(TAG, "TextToSpeech initialized: engine=${engine.defaultEngine}; stream=$SPEECH_STREAM")
            pendingSpeech?.let { speak(it.text, it.onDone) }
            pendingSpeech = null
        } else {
            Log.w(TAG, "TextToSpeech init failed: $status")
        }
    }

    @Synchronized
    fun speak(text: String, onDone: (() -> Unit)? = null) {
        if (!PersonalJarvisConfig.isEnabled) return
        val clean = text.trim()
        if (clean.isEmpty()) return
        val engine = tts
        if (!ready || engine == null) {
            pendingSpeech = PendingSpeech(clean, onDone)
            return
        }
        requestAudioFocus()
        engine.stop()
        engine.setSpeechRate(SPEECH_RATE)
        engine.setPitch(PITCH)
        val utteranceId = UUID.randomUUID().toString()
        activeUtteranceId = utteranceId
        activeCompletion = onDone
        engine.speak(clean, TextToSpeech.QUEUE_FLUSH, speechParams(), utteranceId)
    }

    @Synchronized
    fun shutdown() {
        pendingSpeech = null
        activeUtteranceId = null
        activeCompletion = null
        ready = false
        tts?.stop()
        tts?.shutdown()
        tts = null
        releaseAudioFocus()
    }

    private fun createTextToSpeech(): TextToSpeech {
        val engine = preferredEngine()
        return if (engine != null) {
            Log.i(TAG, "Using preferred TextToSpeech engine: $engine")
            TextToSpeech(appContext, this, engine)
        } else {
            Log.w(TAG, "Preferred TextToSpeech engine unavailable; using system default")
            TextToSpeech(appContext, this)
        }
    }

    @Synchronized
    private fun completeUtterance(utteranceId: String?) {
        val completion = if (utteranceId == activeUtteranceId) activeCompletion else null
        if (utteranceId == activeUtteranceId) {
            activeUtteranceId = null
            activeCompletion = null
        }
        releaseAudioFocus()
        completion?.invoke()
    }

    private fun preferredEngine(): String? =
        if (isPackageInstalled(GOOGLE_TTS_ENGINE)) GOOGLE_TTS_ENGINE else null

    private fun isPackageInstalled(packageName: String): Boolean =
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                appContext.packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                appContext.packageManager.getPackageInfo(packageName, 0)
            }
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }

    @Synchronized
    private fun requestAudioFocus() {
        if (audioFocusAttached) return
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = audioFocusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(speechAudioAttributes())
                .setOnAudioFocusChangeListener { focusChange ->
                    if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
                        focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                    ) {
                        audioFocusAttached = false
                    }
                }
                .build()
                .also { audioFocusRequest = it }
            audioManager.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                null,
                SPEECH_STREAM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            )
        }
        audioFocusAttached = granted == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        if (!audioFocusAttached) {
            Log.w(TAG, "TextToSpeech audio focus not granted: $granted")
        }
    }

    @Synchronized
    private fun releaseAudioFocus() {
        if (!audioFocusAttached && audioFocusRequest == null) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
        audioFocusAttached = false
    }

    private fun speechParams(): Bundle =
        Bundle().apply {
            putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, SPEECH_STREAM)
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, SPEECH_VOLUME)
        }

    private fun speechAudioAttributes(): AudioAttributes =
        AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()

    private companion object {
        const val TAG = "AritenisJarvis"
        const val GOOGLE_TTS_ENGINE = "com.google.android.tts"
        const val SPEECH_STREAM = AudioManager.STREAM_MUSIC
        const val SPEECH_RATE = 1.0f
        const val PITCH = 1.0f
        const val SPEECH_VOLUME = 1.0f
    }

    private data class PendingSpeech(
        val text: String,
        val onDone: (() -> Unit)?
    )
}
