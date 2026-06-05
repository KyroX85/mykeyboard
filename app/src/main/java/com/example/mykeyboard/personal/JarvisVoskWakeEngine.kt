package com.example.mykeyboard.personal

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import org.vosk.android.StorageService
import java.io.IOException

class JarvisVoskWakeEngine(
    private val context: Context,
    private val onWakeDetected: () -> Unit,
    private val onUnavailable: () -> Unit
) : RecognitionListener {
    private var model: Model? = null
    private var speechService: SpeechService? = null
    private var isPreparing = false
    private var isStarted = false
    private var permanentlyUnavailable = false
    private var wakeDelivered = false

    fun start(): Boolean {
        if (permanentlyUnavailable) {
            Log.i(TAG, "Vosk wake unavailable: model asset missing or failed")
            return false
        }
        if (isStarted || isPreparing) {
            Log.d(TAG, "Vosk wake start ignored: already active")
            return true
        }
        val activeModel = model
        return if (activeModel == null) {
            prepareModel()
            true
        } else {
            startListening(activeModel)
        }
    }

    fun stop(reason: String) {
        val service = speechService ?: return
        try {
            service.stop()
            service.shutdown()
            Log.i(TAG, "Vosk wake stopped: $reason")
        } catch (e: RuntimeException) {
            Log.w(TAG, "Vosk wake stop failed", e)
        } finally {
            speechService = null
            isStarted = false
            wakeDelivered = false
        }
    }

    fun shutdown() {
        stop("shutdown")
        try {
            model?.close()
        } catch (e: RuntimeException) {
            Log.w(TAG, "Vosk wake model close failed", e)
        } finally {
            model = null
            isPreparing = false
        }
    }

    override fun onPartialResult(hypothesis: String?) {
        inspectHypothesis(hypothesis, "partial")
    }

    override fun onResult(hypothesis: String?) {
        inspectHypothesis(hypothesis, "result")
    }

    override fun onFinalResult(hypothesis: String?) {
        inspectHypothesis(hypothesis, "final")
    }

    override fun onError(exception: Exception?) {
        Log.w(TAG, "Vosk wake recognition error", exception)
        stop("recognition error")
        onUnavailable()
    }

    override fun onTimeout() {
        Log.i(TAG, "Vosk wake timeout")
    }

    private fun prepareModel() {
        isPreparing = true
        Log.i(TAG, "Vosk wake model prepare started: asset=$MODEL_ASSET_DIR")
        StorageService.unpack(
            context.applicationContext,
            MODEL_ASSET_DIR,
            MODEL_STORAGE_DIR,
            { unpackedModel ->
                model = unpackedModel
                isPreparing = false
                Log.i(TAG, "Vosk wake model ready: asset=$MODEL_ASSET_DIR")
                startListening(unpackedModel)
            },
            { exception ->
                isPreparing = false
                permanentlyUnavailable = true
                Log.w(TAG, "Vosk wake model unavailable: add assets/$MODEL_ASSET_DIR", exception)
                onUnavailable()
            }
        )
    }

    private fun startListening(activeModel: Model): Boolean =
        try {
            val recognizer = Recognizer(activeModel, SAMPLE_RATE, WAKE_GRAMMAR)
            speechService = SpeechService(recognizer, SAMPLE_RATE).also {
                it.startListening(this)
            }
            isStarted = true
            wakeDelivered = false
            Log.i(TAG, "Vosk wake started: grammar=hey jarvis")
            true
        } catch (e: IOException) {
            Log.w(TAG, "Vosk wake start failed", e)
            false
        } catch (e: RuntimeException) {
            Log.w(TAG, "Vosk wake runtime failure", e)
            false
        }

    private fun inspectHypothesis(hypothesis: String?, source: String) {
        if (!isStarted || wakeDelivered) return
        val text = extractText(hypothesis).trim()
        if (text.isBlank()) return
        if (text == UNKNOWN_TOKEN) return
        val decision = JarvisWakeWordDetector.evaluate(text)
        Log.i(TAG, "Vosk wake metric: ${if (decision.accepted) "REAL_WAKE" else "FALSE_WAKE"}; phrase=\"${text.forLog()}\"; confidence=${decision.confidence.toConfidenceText()}; source=$source; audioSource=unknown; reason=${decision.reason}")
        if (decision.accepted) {
            wakeDelivered = true
            Log.i(TAG, "Vosk wake detected: phrase=\"${text.forLog()}\"; confidence=${decision.confidence.toConfidenceText()}")
            onWakeDetected()
        }
    }

    private fun String.forLog(): String =
        replace("\\", "\\\\").replace("\"", "\\\"")

    private fun Float.toConfidenceText(): String =
        String.format(java.util.Locale.US, "%.2f", this)

    private fun extractText(hypothesis: String?): String {
        if (hypothesis.isNullOrBlank()) return ""
        return runCatching {
            val json = JSONObject(hypothesis)
            json.optString("partial")
                .ifBlank { json.optString("text") }
        }.getOrDefault(hypothesis)
    }

    private companion object {
        const val TAG = "AritenisJarvisWake"
        const val MODEL_ASSET_DIR = "vosk-model-small-en-us-0.15"
        const val MODEL_STORAGE_DIR = "jarvis-vosk-wake-model"
        const val SAMPLE_RATE = 16000.0f
        const val WAKE_GRAMMAR =
            "[\"hey jarvis\", \"[unk]\"]"
        const val UNKNOWN_TOKEN = "[unk]"
    }
}
