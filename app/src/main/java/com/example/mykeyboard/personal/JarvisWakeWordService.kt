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
    private val stateLock = Any()
    private var recognizer: SpeechRecognizer? = null
    private var state = JarvisConversationState.IDLE
    private var wakeLock: PowerManager.WakeLock? = null
    private var speaker: JarvisSpeaker? = null
    private var brainConnector: JarvisBrainConnector? = null
    private var contactMemory: ContactRelationshipMemory? = null
    private var personalMemory: PersonalAwarenessMemory? = null
    private var realityEventStore: RealityEventStore? = null
    private var porcupineWakeEngine: JarvisPorcupineWakeEngine? = null
    private var voskWakeEngine: JarvisVoskWakeEngine? = null
    private var activeSession: JarvisVoiceSession? = null
    private var lastWakeAcceptedAtMs = 0L
    private var latestCommandPartial = ""
    private var latestCommandPartialResult = RecognizedCommandResult.empty()
    private val responseGate = JarvisWakeResponseGate()

    private val wakeRestartRunnable = Runnable {
        if (currentState() == JarvisConversationState.RETURN_TO_IDLE) {
            transitionTo(JarvisConversationState.IDLE, "return to idle complete")
        }
        startWakeRecognition()
    }

    private val commandStartRunnable = Runnable {
        if (currentState() == JarvisConversationState.WAITING_FOR_FOLLOWUP) {
            transitionTo(JarvisConversationState.COMMAND_CAPTURE, "follow-up listening started")
        }
        startCommandRecognition()
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Foreground service lifecycle: onCreate")
        speaker = JarvisSpeaker(this)
        brainConnector = JarvisBrainRuntime.connector(this)
        contactMemory = SharedPreferencesContactRelationshipMemory(this)
        personalMemory = SharedPreferencesPersonalAwarenessMemory(this)
        realityEventStore = SharedPreferencesRealityEventStore(this)
        porcupineWakeEngine = JarvisPorcupineWakeEngine(this) {
            mainHandler.post { handleWakeWordDetected() }
        }
        voskWakeEngine = JarvisVoskWakeEngine(
            context = this,
            onWakeDetected = {
                mainHandler.post { handleWakeWordDetected() }
            },
            onUnavailable = {
                mainHandler.post { startWakeRecognition() }
            }
        )
        createNotificationChannel()
        startForeground(
            PersonalJarvisConfig.WAKE_WORD_NOTIFICATION_ID,
            buildNotification("Listening for Hey Jarvis")
        )
        acquireWakeLock()
        transitionTo(JarvisConversationState.IDLE, "service created")
        startWakeRecognition()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "Foreground service lifecycle: onStartCommand action=${intent?.action.orEmpty()}")
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                if (currentState() == JarvisConversationState.IDLE) {
                    startWakeRecognition()
                }
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        Log.i(TAG, "Foreground service lifecycle: onDestroy")
        mainHandler.removeCallbacksAndMessages(null)
        activeSession = null
        latestCommandPartial = ""
        latestCommandPartialResult = RecognizedCommandResult.empty()
        transitionTo(JarvisConversationState.RETURN_TO_IDLE, "service destroyed")
        porcupineWakeEngine?.shutdown()
        porcupineWakeEngine = null
        voskWakeEngine?.shutdown()
        voskWakeEngine = null
        destroyRecognizer()
        speaker?.shutdown()
        speaker = null
        brainConnector = null
        contactMemory = null
        personalMemory = null
        realityEventStore = null
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startWakeRecognition() {
        if (currentState() != JarvisConversationState.IDLE) {
            Log.i(TAG, "Wake recognizer start ignored: state=${currentState()}")
            return
        }
        if (!hasMicrophonePermission()) {
            Log.w(TAG, "Jarvis service missing RECORD_AUDIO permission")
            stopSelf()
            return
        }
        if (porcupineWakeEngine?.start() == true) {
            return
        }
        if (voskWakeEngine?.start() == true) {
            return
        }
        if (!canStartRecognition()) return
        try {
            ensureRecognizer()
            Log.i(TAG, "SpeechRecognizer start: state=IDLE; purpose=wake-fallback")
            recognizer?.startListening(buildRecognizerIntent(JarvisConversationState.IDLE))
            Log.i(TAG, "AudioRecord start: SpeechRecognizer owns microphone; purpose=wake-fallback")
        } catch (e: RuntimeException) {
            Log.w(TAG, "Unable to start wake recognizer", e)
            scheduleWakeRestart(BUSY_RESTART_DELAY_MS)
        }
    }

    private fun startCommandRecognition() {
        if (currentState() != JarvisConversationState.COMMAND_CAPTURE) {
            Log.i(TAG, "Command recognizer start ignored: state=${currentState()}")
            return
        }
        if (!canStartRecognition()) return
        try {
            ensureRecognizer()
            Log.i(TAG, "SpeechRecognizer start: state=COMMAND_CAPTURE; purpose=command")
            recognizer?.startListening(buildRecognizerIntent(JarvisConversationState.COMMAND_CAPTURE))
            Log.i(TAG, "AudioRecord start: SpeechRecognizer owns microphone; purpose=command")
        } catch (e: RuntimeException) {
            Log.w(TAG, "Unable to start command recognizer", e)
            failCommandCapture("command recognizer start failed", BUSY_RESTART_DELAY_MS)
        }
    }

    private fun canStartRecognition(): Boolean {
        if (!hasMicrophonePermission()) {
            Log.w(TAG, "Jarvis service missing RECORD_AUDIO permission")
            stopSelf()
            return false
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w(TAG, "Jarvis service unavailable: SpeechRecognizer not available")
            stopSelf()
            return false
        }
        return true
    }

    private fun scheduleWakeRestart(delayMs: Long = RESTART_DELAY_MS) {
        Log.i(TAG, "Wake recognizer restart scheduled: delayMs=$delayMs; state=${currentState()}")
        mainHandler.removeCallbacks(wakeRestartRunnable)
        mainHandler.removeCallbacks(commandStartRunnable)
        mainHandler.postDelayed(wakeRestartRunnable, delayMs)
    }

    private fun scheduleCommandStart(delayMs: Long = COMMAND_LISTEN_DELAY_MS) {
        Log.i(TAG, "Command recognizer start scheduled: delayMs=$delayMs; state=${currentState()}")
        mainHandler.removeCallbacks(commandStartRunnable)
        mainHandler.postDelayed(commandStartRunnable, delayMs)
    }

    private fun cancelRecognizerForTransition(reason: String) {
        Log.i(TAG, "SpeechRecognizer stop: $reason; state=${currentState()}")
        Log.i(TAG, "AudioRecord stop: SpeechRecognizer cancel requested")
        recognizer?.cancel()
    }

    private fun ensureRecognizer() {
        if (recognizer != null) return
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).also {
            it.setRecognitionListener(this)
        }
    }

    private fun buildRecognizerIntent(targetState: JarvisConversationState): Intent {
        val isCommand = targetState == JarvisConversationState.COMMAND_CAPTURE
        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, isCommand || targetState == JarvisConversationState.IDLE)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, if (isCommand) COMMAND_MAX_RESULTS else WAKE_MAX_RESULTS)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
            if (isCommand) {
                putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, COMMAND_MINIMUM_INPUT_MS)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, COMMAND_COMPLETE_SILENCE_MS)
                putExtra(
                    RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
                    COMMAND_POSSIBLY_COMPLETE_SILENCE_MS
                )
            }
        }
    }

    override fun onReadyForSpeech(params: Bundle?) {
        Log.d(TAG, "SpeechRecognizer ready: state=${currentState()}")
    }

    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit

    override fun onPartialResults(partialResults: Bundle?) {
        when (currentState()) {
            JarvisConversationState.IDLE -> inspectWakeResults(partialResults)
            JarvisConversationState.COMMAND_CAPTURE -> {
                latestCommandPartialResult = selectBestCommandResult(partialResults)
                latestCommandPartial = latestCommandPartialResult.primary
                if (latestCommandPartial.isNotBlank()) {
                    Log.d(TAG, "Jarvis command partial captured: ${commandObservationLabel(latestCommandPartialResult)}")
                }
            }
            else -> Log.d(TAG, "Partial results ignored: state=${currentState()}")
        }
    }

    override fun onResults(results: Bundle?) {
        when (currentState()) {
            JarvisConversationState.IDLE -> {
                inspectWakeResults(results)
                if (currentState() == JarvisConversationState.IDLE) {
                    scheduleWakeRestart()
                }
            }
            JarvisConversationState.COMMAND_CAPTURE -> handleCommandResults(results)
            else -> Log.d(TAG, "Final results ignored: state=${currentState()}")
        }
    }

    override fun onError(error: Int) {
        Log.w(TAG, "SpeechRecognizer error: $error; state=${currentState()}")
        when (currentState()) {
            JarvisConversationState.IDLE -> {
                val delayMs = when (error) {
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> BUSY_RESTART_DELAY_MS
                    SpeechRecognizer.ERROR_NO_MATCH -> NO_MATCH_RESTART_DELAY_MS
                    else -> RESTART_DELAY_MS
                }
                scheduleWakeRestart(delayMs)
            }
            JarvisConversationState.COMMAND_CAPTURE -> {
                if (error == SpeechRecognizer.ERROR_NO_MATCH && latestCommandPartial.isNotBlank()) {
                    Log.i(TAG, "Using command partial after no-match: chars=${latestCommandPartial.length}")
                    handleCommandText(latestCommandPartialResult)
                } else if (error == SpeechRecognizer.ERROR_NO_MATCH && activeSession != null) {
                    handleConversationNoMatch()
                } else {
                    failCommandCapture("command recognizer error", RESTART_DELAY_MS)
                }
            }
            else -> Log.d(TAG, "Recognizer error ignored outside listening state: state=${currentState()}")
        }
    }

    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    private fun inspectWakeResults(results: Bundle?) {
        if (currentState() != JarvisConversationState.IDLE) return
        val phrases = results
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            .orEmpty()
        phrases.forEach { phrase ->
            Log.d(TAG, "Wake word heard candidate: $phrase")
            if (JarvisWakeWordEngine.containsWakeWord(phrase)) {
                handleWakeWordDetected()
                return
            }
        }
    }

    private fun handleWakeWordDetected() {
        val nowMs = SystemClock.elapsedRealtime()
        Log.i(TAG, "Wake word detected")
        if (currentState() != JarvisConversationState.IDLE) {
            Log.i(TAG, "Wake ignored outside IDLE: state=${currentState()}")
            return
        }
        if (activeSession != null) {
            Log.i(TAG, "Duplicate wake ignored: active session already running")
            scheduleWakeRestart()
            return
        }
        if (nowMs - lastWakeAcceptedAtMs < WAKE_DEBOUNCE_MS) {
            Log.i(TAG, "Wake metric: FALSE_WAKE; phrase=\"duplicate\"; confidence=unknown; source=debounce; audioSource=unknown; reason=duplicate wake inside debounce")
            Log.i(TAG, "Duplicate wake ignored by debounce")
            scheduleWakeRestart()
            return
        }
        if (!responseGate.shouldRespond(nowMs)) {
            releaseSession("wake response cooldown")
            scheduleWakeRestart()
            return
        }

        val session = beginSession(nowMs)
        latestCommandPartial = ""
        transitionTo(JarvisConversationState.WAKE_CONFIRMED, "wake accepted")
        porcupineWakeEngine?.stop("wake accepted before acknowledgment")
        voskWakeEngine?.stop("wake accepted before acknowledgment")
        cancelRecognizerForTransition("wake confirmed before acknowledgment")
        Log.i(TAG, "Jarvis session started: ${session.id}")
        val afterAcknowledgement: () -> Unit = {
            mainHandler.post {
                if (activeSession?.id == session.id && currentState() == JarvisConversationState.WAKE_CONFIRMED) {
                    transitionTo(JarvisConversationState.COMMAND_CAPTURE, "acknowledgment spoken")
                    scheduleCommandStart()
                }
            }
            Unit
        }
        speaker?.speak(JarvisConversationModePolicy.WAKE_ACKNOWLEDGEMENT, afterAcknowledgement) ?: afterAcknowledgement()
    }

    private fun handleCommandResults(results: Bundle?) {
        handleCommandText(selectBestCommandResult(results))
    }

    private fun handleCommandText(result: RecognizedCommandResult) {
        if (currentState() != JarvisConversationState.COMMAND_CAPTURE) {
            Log.i(TAG, "Command ignored outside COMMAND_CAPTURE: state=${currentState()}")
            return
        }
        val session = activeSession
        val question = result.primary.trim()
        latestCommandPartial = ""
        latestCommandPartialResult = RecognizedCommandResult.empty()
        transitionTo(JarvisConversationState.PROCESSING, "command captured")
        if (session == null) {
            Log.w(TAG, "Command ignored: no active Jarvis session")
            failCommandCapture("missing active session", RESTART_DELAY_MS)
            return
        }
        if (question.isBlank()) {
            failCommandCapture("blank command", RESTART_DELAY_MS)
            return
        }
        session.emptyListenCount = 0
        session.commandCaptured = true
        session.turnCount += 1
        Log.i(TAG, "Jarvis command captured: ${commandObservationLabel(result)}")
        if (handlePendingContactLearningIfNeeded(session, question)) {
            return
        }
        if (handlePersonalLearningIfNeeded(session, question)) {
            return
        }
        if (handlePendingExecutionIfNeeded(session, question)) {
            return
        }
        when (JarvisConversationCommand.classify(question)) {
            JarvisConversationCommandType.TAKE_REST -> {
                Log.i(TAG, "Jarvis conversation end requested: session=${session.id}; turns=${session.turnCount}")
                speakAndReturnToIdle(SESSION_REST_RESPONSE_TEXT, "founder ended conversation")
            }
            JarvisConversationCommandType.CONTINUE_PROMPT -> {
                Log.i(TAG, "Jarvis conversation continuation prompt: session=${session.id}; turns=${session.turnCount}")
                speakAndContinueConversation(SESSION_CONTINUE_RESPONSE_TEXT, "conversation continuation prompt")
            }
            JarvisConversationCommandType.QUESTION -> askFounderBrain(session, question)
        }
    }

    private fun selectBestCommandResult(results: Bundle?): RecognizedCommandResult {
        val phrases = results
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            .orEmpty()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        val confidenceScores = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
        Log.i(
            TAG,
            "Jarvis command recognition alternatives: count=${phrases.size}; confidenceScores=${confidenceScores?.size ?: 0}" +
                debugAlternativesLabel(phrases, confidenceScores)
        )
        if (phrases.isEmpty()) return RecognizedCommandResult.empty()
        val scoredCandidates = phrases.mapIndexed { index, phrase ->
            val confidence = confidenceScores?.getOrNull(index) ?: UNKNOWN_CONFIDENCE
            RecognizedCommandCandidate(index = index, phrase = phrase, confidence = confidence)
        }
        val best = if (scoredCandidates.none { it.hasUsableConfidence }) {
            scoredCandidates.first()
        } else {
            scoredCandidates.maxWithOrNull(
                compareBy<RecognizedCommandCandidate> { it.hasUsableConfidence }
                    .thenBy { it.confidence }
                    .thenBy { it.phrase.length }
            )
                ?: scoredCandidates.first()
        }
        return RecognizedCommandResult(
            primary = best.phrase,
            confidence = best.confidence,
            alternatives = scoredCandidates
        )
    }

    private fun commandObservationLabel(result: RecognizedCommandResult): String {
        val primary = result.primary.take(MAX_DEBUG_TRANSCRIPT_CHARS).forLog()
        val confidence = result.confidence.toConfidenceText()
        val alternatives = result.alternatives.take(MAX_DEBUG_ALTERNATIVES).mapIndexed { outputIndex, candidate ->
            val text = candidate.phrase.take(MAX_DEBUG_TRANSCRIPT_CHARS).forLog()
            val candidateConfidence = candidate.confidence.toConfidenceText()
            "alternative${outputIndex + 1}=\"$text\"; alternative${outputIndex + 1}Confidence=$candidateConfidence"
        }
        return buildString {
            append("chars=${result.primary.length}; transcript=\"$primary\"; confidence=$confidence")
            if (alternatives.isNotEmpty()) {
                append("; ")
                append(alternatives.joinToString("; "))
            }
        }
    }

    private fun debugAlternativesLabel(phrases: List<String>, confidenceScores: FloatArray?): String {
        if (phrases.isEmpty()) return ""
        val alternatives = phrases.take(MAX_DEBUG_ALTERNATIVES).mapIndexed { index, phrase ->
            val confidence = confidenceScores?.getOrNull(index)
            val confidenceText = confidence?.let { String.format(Locale.US, "%.2f", it) } ?: "unknown"
            "$index:$confidenceText:${phrase.take(MAX_DEBUG_TRANSCRIPT_CHARS).forLog()}"
        }
        return "; alternatives=${alternatives.joinToString("|")}"
    }

    private fun String.forLog(): String =
        replace("\\", "\\\\").replace("\"", "\\\"")

    private fun Float.toConfidenceText(): String =
        if (this >= 0.0f) String.format(Locale.US, "%.2f", this) else "unknown"

    private fun askFounderBrain(session: JarvisVoiceSession, question: String) {
        val realityDecision = JarvisRealityAdapter.classify(question)
        JarvisRealityAdapter.logDecision(session.id, question, realityDecision)
        if (realityDecision.route == JarvisRealityRoute.EXECUTION) {
            handleExecutionRequest(session, question)
            return
        }
        if (realityDecision.route == JarvisRealityRoute.AGENTS) {
            val verdict = JarvisRealityMode.evaluateAgents(realityDecision)
            if (!verdict.canAnswer) {
                Log.i(
                    TAG,
                    "Jarvis Reality Mode blocked agent answer: session=${session.id}; truth_status=${verdict.truthStatus}; " +
                        "sources_used=${verdict.sourcesUsed.joinToString("|")}; last_verified_timestamp=${verdict.lastVerifiedTimestamp ?: "null"}; " +
                        "reason=${verdict.reason}; REALITY_PERCENT=${realityDecision.realityScore.realityPercent}"
                )
                speakAndContinueConversation(verdict.speech.orEmpty(), "agent reality mode blocked")
                return
            }
            val snapshot = realityDecision.agentVisibilitySnapshot
            val speech = if (snapshot == null) {
                "I do not have verified agent visibility yet."
            } else {
                AgentVisibilityResponseFormatter.voiceSummary(snapshot)
            }
            Log.i(
                TAG,
                "Agent visibility question answered from runtime snapshot: session=${session.id}; truthStatus=${realityDecision.truthStatus}; " +
                    "REALITY_PERCENT=${realityDecision.realityScore.realityPercent}; " +
                    "snapshot_fields_used=${realityDecision.realityScore.snapshotFieldsUsed.joinToString("|")}; " +
                    "founder_brain_used=${realityDecision.realityScore.founderBrainUsed}"
            )
            speakAndContinueConversation(speech, "agent visibility response delivered")
            return
        }
        if (realityDecision.route == JarvisRealityRoute.PROJECT) {
            val verdict = JarvisRealityMode.evaluateProject(realityDecision)
            if (!verdict.canAnswer) {
                Log.i(
                    TAG,
                    "Jarvis Reality Mode blocked project answer: session=${session.id}; truth_status=${verdict.truthStatus}; " +
                        "sources_used=${verdict.sourcesUsed.joinToString("|")}; last_verified_timestamp=${verdict.lastVerifiedTimestamp ?: "null"}; " +
                        "reason=${verdict.reason}; REALITY_PERCENT=${realityDecision.realityScore.realityPercent}"
                )
                speakAndContinueConversation(verdict.speech.orEmpty(), "project reality mode blocked")
                return
            }
            val snapshot = realityDecision.projectSnapshot
            val speech = if (snapshot == null) {
                "I do not have enough verified project data yet."
            } else {
                ProjectSnapshotResponseFormatter.voiceSummary(snapshot)
            }
            Log.i(
                TAG,
                "Project question answered from runtime snapshot: session=${session.id}; truthStatus=${realityDecision.truthStatus}; " +
                    "REALITY_PERCENT=${realityDecision.realityScore.realityPercent}; " +
                    "snapshot_fields_used=${realityDecision.realityScore.snapshotFieldsUsed.joinToString("|")}; " +
                    "founder_brain_used=${realityDecision.realityScore.founderBrainUsed}"
            )
            speakAndContinueConversation(speech, "project snapshot response delivered")
            return
        }
        if (realityDecision.route == JarvisRealityRoute.TIMELINE) {
            val store = realityEventStore
            val window = RealityTimelineQuestionClassifier.windowFor(question) ?: RealityTimelineWindow.TODAY
            val events = if (store == null) {
                emptyList()
            } else {
                val provider = RealityTimelineProvider(store)
                when (window) {
                    RealityTimelineWindow.TODAY -> provider.getEventsToday()
                    RealityTimelineWindow.LAST_24_HOURS -> provider.getEventsLast24Hours()
                    RealityTimelineWindow.LAST_7_DAYS -> provider.getEventsLast7Days()
                }
            }
            Log.i(
                TAG,
                "Reality timeline question answered from event store: session=${session.id}; window=$window; " +
                    "events=${events.size}; founder_brain_used=false"
            )
            speakAndContinueConversation(
                RealityTimelineResponseFormatter.voiceSummary(events, window),
                "reality timeline response delivered"
            )
            return
        }
        if (realityDecision.route == JarvisRealityRoute.OPERATOR) {
            val realitySnapshot = RealitySnapshotGenerator.generate(realityEventStore?.all().orEmpty())
            val personalSnapshot = PersonalSnapshotRuntime.capture().withLocalFacts(personalMemory?.all().orEmpty())
            val projectSnapshot = ProjectSnapshotRuntime.capture()
            val decision = PersonalOperatorDecisionLayer.decide(
                realitySnapshot = realitySnapshot,
                personalSnapshot = personalSnapshot,
                projectSnapshot = projectSnapshot
            )
            Log.i(
                TAG,
                "Personal operator decision answered from verified inputs: session=${session.id}; " +
                    "priorities=${decision.currentPriorities.size}; founder_brain_used=false"
            )
            speakAndContinueConversation(
                PersonalOperatorDecisionFormatter.voiceSummary(decision),
                "personal operator decision delivered"
            )
            return
        }
        if (realityDecision.route == JarvisRealityRoute.PERSONAL) {
            val snapshot = realityDecision.personalSnapshot?.withLocalFacts(personalMemory?.all().orEmpty())
            val speech = if (snapshot == null) {
                "I do not have enough verified personal data yet."
            } else {
                PersonalSnapshotResponseFormatter.voiceSummary(snapshot, question)
            }
            Log.i(
                TAG,
                "Personal question answered from runtime snapshot: session=${session.id}; truthStatus=${realityDecision.truthStatus}; " +
                    "REALITY_PERCENT=${realityDecision.realityScore.realityPercent}; " +
                    "snapshot_fields_used=${realityDecision.realityScore.snapshotFieldsUsed.joinToString("|")}; " +
                    "founder_brain_used=${realityDecision.realityScore.founderBrainUsed}"
            )
            speakAndContinueConversation(speech, "personal snapshot response delivered")
            return
        }
        if (realityDecision.route != JarvisRealityRoute.REFLECTION) {
            Log.i(TAG, "Founder Brain bypassed for non-reflection route=${realityDecision.route}; session=${session.id}")
            speakAndContinueConversation(nonFounderBrainFallback(realityDecision), "non-founder-brain route blocked")
            return
        }
        val connector = brainConnector
        if (connector == null) {
            Log.w(TAG, "Founder Brain connector missing for session ${session.id}")
            speakAndContinueConversation(JarvisBrainSpeechPolicy.safeFallback(), "brain not attached")
            return
        }
        session.brainAttached = true
        Log.i(
            TAG,
            "Founder Brain question captured after reality route=${realityDecision.route}; " +
                "REALITY_PERCENT=${realityDecision.realityScore.realityPercent}; " +
                "snapshot_fields_used=${realityDecision.realityScore.snapshotFieldsUsed.joinToString("|")}; " +
                "founder_brain_used=${realityDecision.realityScore.founderBrainUsed}"
        )
        connector.askQuestion(
            question = question,
            sessionId = session.id,
            realityDecision = realityDecision,
            onAnswer = { answer ->
                mainHandler.post {
                    if (activeSession?.id != session.id || currentState() != JarvisConversationState.PROCESSING) {
                        Log.w(TAG, "Stale Founder Brain answer ignored: ${session.id}")
                        return@post
                    }
                    val speech = JarvisBrainSpeechPolicy.speechFor(answer)
                    Log.i(TAG, "Founder Brain voiceSummary received: chars=${speech.length}")
                    speakAndContinueConversation(speech, "brain response delivered")
                }
            },
            onFailure = { reason ->
                mainHandler.post {
                    if (activeSession?.id != session.id || currentState() != JarvisConversationState.PROCESSING) {
                        Log.w(TAG, "Stale Founder Brain failure ignored: ${session.id}")
                        return@post
                    }
                    Log.w(TAG, "Founder Brain conversation failed: $reason")
                    speakAndContinueConversation(JarvisBrainSpeechPolicy.safeFallback(), "brain failure")
                }
            }
        )
    }

    private fun nonFounderBrainFallback(decision: JarvisRealityDecision): String =
        when (decision.route) {
            JarvisRealityRoute.AGENTS -> "I do not have verified agent visibility yet."
            JarvisRealityRoute.PERSONAL -> "I do not have enough verified personal data yet."
            JarvisRealityRoute.TIMELINE -> "I do not have verified reality events yet."
            JarvisRealityRoute.OPERATOR -> "I do not have enough verified reality, personal, or project data to decide."
            JarvisRealityRoute.EXECUTION -> "I can only stage phone actions after confirmation."
            JarvisRealityRoute.PROJECT -> "I do not have enough verified project data yet."
            JarvisRealityRoute.REFLECTION -> JarvisBrainSpeechPolicy.safeFallback()
        }

    private fun handlePendingExecutionIfNeeded(session: JarvisVoiceSession, text: String): Boolean {
        val pending = session.pendingExecution ?: return false
        return when {
            JarvisExecutionLayerV1.isConfirmation(text) -> {
                session.pendingExecution = null
                val success = JarvisPhoneActionExecutor(this).execute(pending)
                val speech = if (success) {
                    "Done."
                } else {
                    "I could not complete that phone action."
                }
                Log.i(TAG, "Execution Layer V1 confirmed: session=${session.id}; action=${pending.action}; success=$success")
                speakAndContinueConversation(speech, "execution layer v1 confirmed")
                true
            }
            JarvisExecutionLayerV1.isCancellation(text) -> {
                session.pendingExecution = null
                Log.i(TAG, "Execution Layer V1 cancelled: session=${session.id}; action=${pending.action}")
                speakAndContinueConversation("Cancelled.", "execution layer v1 cancelled")
                true
            }
            else -> {
                session.pendingExecution = null
                Log.i(TAG, "Execution Layer V1 pending action cleared by new command: session=${session.id}; action=${pending.action}")
                false
            }
        }
    }

    private fun handleExecutionRequest(session: JarvisVoiceSession, command: String) {
        when (val result = JarvisExecutionLayerV1.parse(command)) {
            is JarvisExecutionParseResult.Ready -> {
                val plan = resolveContactIfNeeded(session, result.plan) ?: return
                session.pendingExecution = plan
                Log.i(TAG, "Execution Layer V1 staged: session=${session.id}; action=${plan.action}; target=${plan.target}")
                speakAndContinueConversation(
                    text = plan.confirmationPrompt(),
                    reason = "execution layer v1 staged",
                    includeStateCue = false
                )
            }
            is JarvisExecutionParseResult.NeedsClarification -> {
                Log.i(TAG, "Execution Layer V1 needs clarification: session=${session.id}")
                speakAndContinueConversation(result.prompt, "execution layer v1 clarification")
            }
            is JarvisExecutionParseResult.Rejected -> {
                Log.i(TAG, "Execution Layer V1 rejected command: session=${session.id}; reason=${result.reason}")
                speakAndContinueConversation(result.reason, "execution layer v1 rejected")
            }
        }
    }

    private fun handlePendingContactLearningIfNeeded(session: JarvisVoiceSession, text: String): Boolean {
        val pendingReference = session.pendingContactReference ?: return false
        val learning = ContactUnderstandingLayer.parseLearning(text)
        if (learning == null) {
            speakAndContinueConversation("I still do not know who $pendingReference is to you.", "contact learning clarification")
            return true
        }
        val relationship = ContactUnderstandingLayer.createRelationship(learning)
        contactMemory?.save(relationship)
        realityEventStore?.let { store ->
            RealityEventEngine.contactLearned(
                store = store,
                sessionId = session.id,
                relationship = relationship
            )
        }
        session.pendingContactReference = null
        Log.i(TAG, "Contact relationship learned: reference=$pendingReference; relationship=${relationship.relationship}")
        speakAndContinueConversation(
            "Got it. I will remember ${relationship.displayName} as ${relationship.relationship}.",
            "contact relationship learned"
        )
        return true
    }

    private fun handlePersonalLearningIfNeeded(session: JarvisVoiceSession, text: String): Boolean {
        val memory = personalMemory ?: return false
        return when (val result = PersonalAwarenessLearningLayer.learn(text)) {
            is PersonalAwarenessLearningResult.Learned -> {
                memory.save(result.fact)
                realityEventStore?.let { store ->
                    RealityEventEngine.personalFactAdded(
                        store = store,
                        sessionId = session.id,
                        fact = result.fact
                    )
                }
                Log.i(TAG, "Personal awareness fact learned: category=${result.fact.category}; source=${result.fact.evidenceSourceId}")
                speakAndContinueConversation(result.speech, "personal awareness learned")
                true
            }
            is PersonalAwarenessLearningResult.NeedsClarification -> {
                speakAndContinueConversation(result.speech, "personal awareness clarification")
                true
            }
            PersonalAwarenessLearningResult.NotPersonalLearning -> false
        }
    }

    private fun resolveContactIfNeeded(session: JarvisVoiceSession, plan: JarvisExecutionPlan): JarvisExecutionPlan? {
        if (plan.action != JarvisExecutionAction.CALL_CONTACT && plan.action != JarvisExecutionAction.WHATSAPP_DRAFT) {
            return plan
        }
        val memory = contactMemory ?: return plan
        return when (val resolution = ContactUnderstandingLayer.resolve(plan.target, memory)) {
            is ContactResolution.Known -> plan.copy(target = resolution.relationship.displayName)
            is ContactResolution.Unknown -> {
                session.pendingContactReference = resolution.reference
                Log.i(TAG, "Contact relationship unknown: reference=${resolution.reference}")
                speakAndContinueConversation(resolution.prompt, "contact relationship unknown", includeStateCue = false)
                null
            }
            is ContactResolution.Ambiguous -> {
                session.pendingContactReference = resolution.reference
                Log.i(TAG, "Contact relationship ambiguous: reference=${resolution.reference}; options=${resolution.options.size}")
                speakAndContinueConversation(resolution.prompt, "contact relationship ambiguous", includeStateCue = false)
                null
            }
            is ContactResolution.NotRelationship -> plan
        }
    }

    private fun handleConversationNoMatch() {
        val session = activeSession
        if (session == null) {
            failCommandCapture("missing active session after no-match", RESTART_DELAY_MS)
            return
        }
        session.emptyListenCount += 1
        latestCommandPartial = ""
        latestCommandPartialResult = RecognizedCommandResult.empty()
        if (session.emptyListenCount <= MAX_EMPTY_CONVERSATION_LISTENS) {
            Log.i(
                TAG,
                "Conversation command no-match; keeping session active: session=${session.id}; emptyListens=${session.emptyListenCount}"
            )
            scheduleCommandStart(CONVERSATION_NO_MATCH_RELISTEN_MS)
        } else {
            Log.i(TAG, "Conversation idle timeout: session=${session.id}; turns=${session.turnCount}")
            speakAndReturnToIdle(SESSION_REST_RESPONSE_TEXT, "conversation idle timeout")
        }
    }

    private fun failCommandCapture(reason: String, restartDelayMs: Long) {
        releaseSession(reason)
        latestCommandPartial = ""
        latestCommandPartialResult = RecognizedCommandResult.empty()
        transitionTo(JarvisConversationState.RETURN_TO_IDLE, reason)
        scheduleWakeRestart(restartDelayMs)
    }

    private fun speakAndContinueConversation(
        text: String,
        reason: String,
        includeStateCue: Boolean = true
    ) {
        transitionTo(JarvisConversationState.SPEAKING, reason)
        val sessionId = activeSession?.id
        val spokenText = if (includeStateCue) {
            JarvisConversationModePolicy.appendStateCue(
                answer = text,
                mode = nextConversationMode()
            )
        } else {
            text
        }
        val afterSpeech: () -> Unit = {
            mainHandler.post {
                if (activeSession?.id == sessionId && sessionId != null) {
                    transitionTo(JarvisConversationState.WAITING_FOR_FOLLOWUP, "conversation speech complete")
                    scheduleCommandStart(CONVERSATION_TURN_DELAY_MS)
                } else {
                    transitionTo(JarvisConversationState.RETURN_TO_IDLE, "conversation session missing after speech")
                    scheduleWakeRestart(RETURN_TO_IDLE_DELAY_MS)
                }
            }
            Unit
        }
        if (spokenText.isBlank()) {
            afterSpeech()
        } else {
            speaker?.speak(spokenText, afterSpeech) ?: afterSpeech()
        }
    }

    private fun nextConversationMode(): JarvisConversationMode {
        val turns = activeSession?.turnCount ?: 0
        return if (turns <= 1) {
            JarvisConversationMode.WAITING_FOR_FOLLOWUP
        } else {
            JarvisConversationMode.WAITING_FOR_INSTRUCTION
        }
    }

    private fun speakAndReturnToIdle(text: String, reason: String) {
        transitionTo(JarvisConversationState.SPEAKING, reason)
        val afterSpeech: () -> Unit = {
            mainHandler.post {
                releaseSession(reason)
                transitionTo(JarvisConversationState.RETURN_TO_IDLE, "speech complete")
                scheduleWakeRestart(RETURN_TO_IDLE_DELAY_MS)
            }
            Unit
        }
        if (text.isBlank()) {
            afterSpeech()
        } else {
            speaker?.speak(text, afterSpeech) ?: afterSpeech()
        }
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
        latestCommandPartial = ""
        latestCommandPartialResult = RecognizedCommandResult.empty()
    }

    private fun transitionTo(nextState: JarvisConversationState, reason: String) {
        synchronized(stateLock) {
            if (state != nextState) {
                Log.i(TAG, "Jarvis state transition: $state -> $nextState; reason=$reason")
                state = nextState
            } else {
                Log.d(TAG, "Jarvis state unchanged: $state; reason=$reason")
            }
        }
    }

    private fun currentState(): JarvisConversationState =
        synchronized(stateLock) { state }

    private fun destroyRecognizer() {
        try {
            Log.i(TAG, "SpeechRecognizer stop: destroyRecognizer cancel")
            Log.i(TAG, "AudioRecord stop: destroyRecognizer cancel")
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (e: RuntimeException) {
            Log.w(TAG, "Unable to destroy Jarvis recognizer cleanly", e)
        } finally {
            recognizer = null
        }
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
            .setSilent(true)
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
        private const val WAKE_MAX_RESULTS = 3
        private const val COMMAND_MAX_RESULTS = 5
        private const val COMMAND_MINIMUM_INPUT_MS = 2400L
        private const val COMMAND_COMPLETE_SILENCE_MS = 1900L
        private const val COMMAND_POSSIBLY_COMPLETE_SILENCE_MS = 1200L
        private const val UNKNOWN_CONFIDENCE = -1.0f
        private const val RESTART_DELAY_MS = 800L
        private const val BUSY_RESTART_DELAY_MS = 1600L
        private const val NO_MATCH_RESTART_DELAY_MS = 5000L
        private const val COMMAND_LISTEN_DELAY_MS = 180L
        private const val CONVERSATION_TURN_DELAY_MS = 240L
        private const val CONVERSATION_NO_MATCH_RELISTEN_MS = 900L
        private const val RETURN_TO_IDLE_DELAY_MS = 350L
        private const val WAKE_DEBOUNCE_MS = 6000L
        private const val MAX_EMPTY_CONVERSATION_LISTENS = 2
        private const val MAX_DEBUG_TRANSCRIPT_CHARS = 80
        private const val MAX_DEBUG_ALTERNATIVES = 5
        private const val SESSION_CONTINUE_RESPONSE_TEXT = "I am listening."
        private const val SESSION_REST_RESPONSE_TEXT = JarvisConversationModePolicy.REST_RESPONSE

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

    private enum class JarvisConversationState {
        IDLE,
        WAKE_CONFIRMED,
        COMMAND_CAPTURE,
        PROCESSING,
        SPEAKING,
        WAITING_FOR_FOLLOWUP,
        RETURN_TO_IDLE
    }

    private data class JarvisVoiceSession(
        val id: String,
        val startedAtMs: Long,
        var commandCaptured: Boolean = false,
        var brainAttached: Boolean = false,
        var turnCount: Int = 0,
        var emptyListenCount: Int = 0,
        var pendingExecution: JarvisExecutionPlan? = null,
        var pendingContactReference: String? = null
    )

    private data class RecognizedCommandCandidate(
        val index: Int,
        val phrase: String,
        val confidence: Float
    ) {
        val hasUsableConfidence: Boolean
            get() = confidence >= 0.0f
    }

    private data class RecognizedCommandResult(
        val primary: String,
        val confidence: Float,
        val alternatives: List<RecognizedCommandCandidate>
    ) {
        companion object {
            fun empty(): RecognizedCommandResult =
                RecognizedCommandResult("", UNKNOWN_CONFIDENCE, emptyList())
        }
    }

    private object JarvisWakeWordEngine {
        fun containsWakeWord(text: String): Boolean =
            JarvisWakeWordDetector.containsWakeWord(text)
    }
}
