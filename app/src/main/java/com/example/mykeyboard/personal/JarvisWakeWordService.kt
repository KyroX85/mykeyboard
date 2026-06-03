package com.example.mykeyboard.personal

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.mykeyboard.MainActivity
import com.example.mykeyboard.R
import java.util.Locale
import java.util.UUID

class JarvisWakeWordService : Service(), RecognitionListener {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val restartListeningRunnable = Runnable { startListeningLoop() }
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var speaker: JarvisSpeaker? = null
    private var brainConnector: JarvisBrainConnector? = null
    private var listeningMode = ListeningMode.WAKE_WORD
    private var awaitingBrainResponse = false
    private var activeSession: JarvisVoiceSession? = null
    private var lastWakeAcceptedAtMs = 0L
    private val responseGate = JarvisWakeResponseGate()

    override fun onCreate() {
        super.onCreate()
        speaker = JarvisSpeaker(this)
        brainConnector = JarvisBrainConnector()
        createNotificationChannel()
        startForeground(
            PersonalJarvisConfig.WAKE_WORD_NOTIFICATION_ID,
            buildNotification("Listening for Hey Jarvis")
        )
        acquireWakeLock()
        startListeningLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            else -> startListeningLoop()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        listening = false
        activeSession = null
        awaitingBrainResponse = false
        mainHandler.removeCallbacksAndMessages(null)
        recognizer?.destroy()
        recognizer = null
        speaker?.shutdown()
        speaker = null
        brainConnector?.shutdown()
        brainConnector = null
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startListeningLoop() {
        if (listening) return
        if (!hasMicrophonePermission()) {
            Log.w(TAG, "Wake word service missing RECORD_AUDIO permission")
            stopSelf()
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w(TAG, "Wake word service unavailable: SpeechRecognizer not available")
            stopSelf()
            return
        }

        listening = true
        ensureRecognizer()
        recognizer?.startListening(buildRecognizerIntent())
        Log.d(TAG, "Jarvis listener started: $listeningMode")
    }

    private fun restartListening(delayMs: Long = RESTART_DELAY_MS) {
        listening = false
        mainHandler.removeCallbacks(restartListeningRunnable)
        mainHandler.postDelayed(restartListeningRunnable, delayMs)
    }

    private fun ensureRecognizer() {
        if (recognizer != null) return
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).also {
            it.setRecognitionListener(this)
        }
    }

    private fun buildRecognizerIntent(): Intent =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, listeningMode == ListeningMode.WAKE_WORD)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        }

    private fun inspectResults(results: Bundle?) {
        if (listeningMode != ListeningMode.WAKE_WORD) return
        val phrases = results
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            .orEmpty()
        phrases.forEach { phrase ->
            Log.d(TAG, "Wake word heard candidate: $phrase")
            if (JarvisWakeWordDetector.containsWakeWord(phrase)) {
                handleWakeWordDetected()
            }
        }
    }

    private fun handleWakeWordDetected() {
        val nowMs = SystemClock.elapsedRealtime()
        Log.i(TAG, "Wake word detected")
        if (activeSession != null || awaitingBrainResponse) {
            Log.i(TAG, "Duplicate wake ignored: active session already running")
            return
        }
        if (nowMs - lastWakeAcceptedAtMs < WAKE_DEBOUNCE_MS) {
            Log.i(TAG, "Duplicate wake ignored by debounce")
            return
        }
        if (responseGate.shouldRespond(nowMs)) {
            val session = beginSession(nowMs)
            speaker?.speak(JarvisWakeResponseGate.RESPONSE_TEXT)
            listeningMode = ListeningMode.COMMAND
            listening = false
            recognizer?.cancel()
            Log.i(TAG, "Jarvis session started: ${session.id}")
            restartListening(COMMAND_LISTEN_DELAY_MS)
        }
    }

    override fun onReadyForSpeech(params: Bundle?) {
        Log.d(TAG, "Wake word ready for speech")
    }

    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit
    override fun onPartialResults(partialResults: Bundle?) = inspectResults(partialResults)
    override fun onResults(results: Bundle?) {
        if (listeningMode == ListeningMode.COMMAND) {
            handleCommandResults(results)
        } else {
            inspectResults(results)
            restartListening()
        }
    }

    override fun onError(error: Int) {
        Log.w(TAG, "Wake word listener error: $error")
        if (listeningMode == ListeningMode.COMMAND) {
            listeningMode = ListeningMode.WAKE_WORD
            releaseSession("speech recognizer error")
        }
        restartListening(if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) BUSY_RESTART_DELAY_MS else RESTART_DELAY_MS)
    }

    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    private fun handleCommandResults(results: Bundle?) {
        val session = activeSession
        val question = results
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            .orEmpty()
            .firstOrNull()
            .orEmpty()
            .trim()

        listening = false
        listeningMode = ListeningMode.WAKE_WORD
        if (session == null) {
            Log.w(TAG, "Command ignored: no active Jarvis session")
            restartListening()
            return
        }
        if (question.isBlank()) {
            releaseSession("blank command")
            restartListening()
            return
        }
        session.commandCaptured = true
        askFounderBrain(session, question)
    }

    private fun askFounderBrain(session: JarvisVoiceSession, question: String) {
        if (awaitingBrainResponse) return
        val connector = brainConnector
        if (connector == null || !connector.isReady()) {
            Log.w(TAG, "Founder Brain not attached for session ${session.id}")
            speaker?.speak("Founder Brain is not connected")
            releaseSession("brain not attached")
            restartListening(BRAIN_RESPONSE_RESTART_DELAY_MS)
            return
        }
        awaitingBrainResponse = true
        session.brainAttached = true
        Log.i(TAG, "Founder Brain question captured")
        connector.askQuestion(
            question = question,
            sessionId = session.id,
            onAnswer = { answer ->
                mainHandler.post {
                    if (activeSession?.id != session.id) {
                        Log.w(TAG, "Stale Founder Brain answer ignored: ${session.id}")
                        return@post
                    }
                    awaitingBrainResponse = false
                    val speech = JarvisBrainSpeechPolicy.speechFor(answer)
                    if (speech.isNotBlank()) {
                        speaker?.speak(speech)
                    }
                    releaseSession("brain response delivered")
                    restartListening(BRAIN_RESPONSE_RESTART_DELAY_MS)
                }
            },
            onFailure = { reason ->
                mainHandler.post {
                    if (activeSession?.id != session.id) {
                        Log.w(TAG, "Stale Founder Brain failure ignored: ${session.id}")
                        return@post
                    }
                    Log.w(TAG, "Founder Brain conversation failed: $reason")
                    awaitingBrainResponse = false
                    speaker?.speak("Founder Brain is not connected")
                    releaseSession("brain failure")
                    restartListening(BRAIN_RESPONSE_RESTART_DELAY_MS)
                }
            }
        )
    }

    private fun beginSession(nowMs: Long): JarvisVoiceSession {
        lastWakeAcceptedAtMs = nowMs
        return JarvisVoiceSession(
            id = UUID.randomUUID().toString(),
            startedAtMs = nowMs
        ).also {
            activeSession = it
        }
    }

    private fun releaseSession(reason: String) {
        activeSession?.let { Log.i(TAG, "Jarvis session released: ${it.id}; reason=$reason") }
        activeSession = null
        awaitingBrainResponse = false
        listeningMode = ListeningMode.WAKE_WORD
    }

    private fun hasMicrophonePermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            PersonalJarvisConfig.WAKE_WORD_CHANNEL_ID,
            "Jarvis wake word",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps Jarvis listening for the wake word"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(content: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, JarvisWakeWordService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, PersonalJarvisConfig.WAKE_WORD_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Aritenis Jarvis")
            .setContentText(content)
            .setOngoing(true)
            .setContentIntent(openIntent)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:JarvisWakeWord").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    companion object {
        const val ACTION_START = "com.example.mykeyboard.personal.START_WAKE_WORD"
        const val ACTION_STOP = "com.example.mykeyboard.personal.STOP_WAKE_WORD"
        private const val TAG = "AritenisJarvisWake"
        private const val RESTART_DELAY_MS = 800L
        private const val BUSY_RESTART_DELAY_MS = 1600L
        private const val COMMAND_LISTEN_DELAY_MS = 900L
        private const val BRAIN_RESPONSE_RESTART_DELAY_MS = 1200L
        private const val WAKE_DEBOUNCE_MS = 2500L
        fun start(context: Context) {
            val intent = Intent(context, JarvisWakeWordService::class.java).setAction(ACTION_START)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.startService(Intent(context, JarvisWakeWordService::class.java).setAction(ACTION_STOP))
        }
    }

    private enum class ListeningMode {
        WAKE_WORD,
        COMMAND
    }

    private data class JarvisVoiceSession(
        val id: String,
        val startedAtMs: Long,
        var commandCaptured: Boolean = false,
        var brainAttached: Boolean = false
    )
}
