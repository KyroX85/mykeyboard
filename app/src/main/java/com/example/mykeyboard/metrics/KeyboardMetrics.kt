package com.example.mykeyboard.metrics

import kotlin.math.max
import kotlin.math.min

class KeyboardMetrics(
    private val rollingWindowSize: Int = DEFAULT_ROLLING_WINDOW_SIZE,
    private val topAcceptedLimit: Int = DEFAULT_TOP_ACCEPTED_LIMIT,
    private val failureReasonLimit: Int = DEFAULT_FAILURE_REASON_LIMIT,
    private val maxAcceptedWordKeys: Int = DEFAULT_MAX_ACCEPTED_WORD_KEYS
) {
    private val latencyWindow = LongArray(max(1, rollingWindowSize))
    private val acceptedWords = mutableMapOf<String, Int>()
    private val failureReasons = ArrayDeque<String>(failureReasonLimit)

    private var sessionStartedAtMs = 0L
    private var keyPresses = 0L
    private var latencyWindowCount = 0
    private var latencyWindowIndex = 0
    private var latencyWindowTotalMs = 0L
    private var worstLatencyMs = 0L
    private var suggestionImpressions = 0L
    private var suggestionClicks = 0L
    private var ignoredSuggestions = 0L
    private var correctionsAfterAcceptedSuggestion = 0L
    private var backspaceAfterAutocomplete = 0L
    private var totalCompletionLength = 0L
    private var completionCount = 0L
    private var popupFailures = 0L
    private var lifecycleInterruptions = 0L
    private var saveModelFailures = 0L
    private var predictorLoadFailures = 0L
    private var networkFailures = 0L
    private var loggingCancellations = 0L
    private var acceptedSuggestionPendingCorrection = false
    private var swipePendingCorrection = false
    private val keyConfidenceZones = LongArray(KeyConfidenceZone.values().size)
    private var totalBackspaces = 0L
    private var rapidCorrectionBackspaces = 0L
    private var repeatedCorrectionRuns = 0L
    private var lastBackspaceAtMs = 0L
    private var consecutiveBackspaces = 0
    private var typingBurstCount = 0L
    private var unstableTypingBursts = 0L
    private var longestTypingBurst = 0
    private var currentBurstCommits = 0
    private var currentBurstCorrections = 0
    private var lastCommitAtMs = 0L
    private var swipeAttempts = 0L
    private var swipeSuccesses = 0L
    private var swipeFailures = 0L
    private var swipeBackspaces = 0L
    private var longWordSwipeFailures = 0L
    private var swipeInterruptions = 0L
    private var repeatedSwipeFailureRuns = 0L
    private var consecutiveSwipeFailures = 0
    private var modeSwitches = 0L
    private var symbolLayerSwitches = 0L
    private var totalModeSwitchLatencyMs = 0L
    private var worstModeSwitchLatencyMs = 0L
    private var latencySpikeSuspicions = 0L
    private var frameHitchSuspicions = 0L
    private var swipeResolveCount = 0L
    private var swipeResolveTotalMs = 0L
    private var swipeResolveWorstMs = 0L
    private var swipeResolveSpikeSuspicions = 0L

    @Synchronized
    fun startSession(nowMs: Long) {
        if (sessionStartedAtMs == 0L) {
            sessionStartedAtMs = nowMs
        }
    }

    @Synchronized
    fun recordTypingTouch(nowMs: Long, zone: KeyConfidenceZone) {
        if (sessionStartedAtMs == 0L) {
            sessionStartedAtMs = nowMs
        }
        keyConfidenceZones[zone.ordinal]++
    }

    @Synchronized
    fun endSession() {
        sessionStartedAtMs = 0L
        acceptedSuggestionPendingCorrection = false
    }

    @Synchronized
    fun recordKeyCommit(durationMs: Long, nowMs: Long) {
        startSession(nowMs)
        recordBurstCommit(nowMs)
        val safeDuration = max(0L, durationMs)
        if (safeDuration >= LATENCY_SPIKE_MS) {
            latencySpikeSuspicions++
        }
        if (safeDuration >= FRAME_HITCH_SUSPECT_MS) {
            frameHitchSuspicions++
        }
        keyPresses++
        worstLatencyMs = max(worstLatencyMs, safeDuration)

        if (latencyWindowCount < latencyWindow.size) {
            latencyWindowCount++
        } else {
            latencyWindowTotalMs -= latencyWindow[latencyWindowIndex]
        }

        latencyWindow[latencyWindowIndex] = safeDuration
        latencyWindowTotalMs += safeDuration
        latencyWindowIndex = (latencyWindowIndex + 1) % latencyWindow.size
    }

    @Synchronized
    fun recordSuggestionImpression(suggestions: List<String>) {
        val visibleCount = min(MAX_VISIBLE_SUGGESTIONS, suggestions.count { it.isNotBlank() })
        suggestionImpressions += visibleCount.toLong()
    }

    @Synchronized
    fun recordKeyConfidenceZone(zone: KeyConfidenceZone) {
        keyConfidenceZones[zone.ordinal]++
    }

    @Synchronized
    fun recordSuggestionAccepted(word: String, typedLength: Int) {
        val wordKey = privacyKey(word)
        if (wordKey.isNotEmpty()) {
            if (!acceptedWords.containsKey(wordKey) && acceptedWords.size >= maxAcceptedWordKeys) {
                removeLowestAcceptedWord()
            }
            acceptedWords[wordKey] = (acceptedWords[wordKey] ?: 0) + 1
        }

        suggestionClicks++
        acceptedSuggestionPendingCorrection = true
        val completionLength = max(0, word.trim().length - max(0, typedLength))
        totalCompletionLength += completionLength.toLong()
        completionCount++
    }

    @Synchronized
    fun recordSuggestionIgnored() {
        ignoredSuggestions++
    }

    @Synchronized
    fun recordBackspace(nowMs: Long = 0L): Boolean {
        totalBackspaces++
        if (swipePendingCorrection) {
            swipeBackspaces++
            swipePendingCorrection = false
        }
        if (nowMs > 0L) {
            if (lastBackspaceAtMs > 0L && nowMs - lastBackspaceAtMs <= RAPID_CORRECTION_WINDOW_MS) {
                rapidCorrectionBackspaces++
            }
            lastBackspaceAtMs = nowMs
        }
        consecutiveBackspaces++
        currentBurstCorrections++
        if (consecutiveBackspaces == REPEATED_CORRECTION_THRESHOLD) {
            repeatedCorrectionRuns++
        }

        if (!acceptedSuggestionPendingCorrection) return false

        backspaceAfterAutocomplete++
        acceptedSuggestionPendingCorrection = false
        return true
    }

    @Synchronized
    fun recordSwipeResolved(sequenceLength: Int, candidateCount: Int, committed: Boolean) {
        if (committed) {
            swipeAttempts++
            swipeSuccesses++
            consecutiveSwipeFailures = 0
            swipePendingCorrection = true
        } else {
            recordSwipeFailure(sequenceLength, candidateCount, interrupted = false)
        }
    }

    @Synchronized
    fun recordSwipeFailure(sequenceLength: Int, candidateCount: Int, interrupted: Boolean) {
        swipeAttempts++
        swipeFailures++
        consecutiveSwipeFailures++
        if (sequenceLength >= LONG_SWIPE_SEQUENCE_LENGTH && candidateCount == 0) {
            longWordSwipeFailures++
        }
        if (interrupted) {
            swipeInterruptions++
        }
        if (consecutiveSwipeFailures == REPEATED_SWIPE_FAILURE_THRESHOLD) {
            repeatedSwipeFailureRuns++
        }
    }

    @Synchronized
    fun recordModeSwitch(durationMs: Long, symbolLayer: Boolean) {
        val safeDuration = max(0L, durationMs)
        modeSwitches++
        totalModeSwitchLatencyMs += safeDuration
        worstModeSwitchLatencyMs = max(worstModeSwitchLatencyMs, safeDuration)
        if (symbolLayer) {
            symbolLayerSwitches++
        }
        if (safeDuration >= FRAME_HITCH_SUSPECT_MS) {
            frameHitchSuspicions++
        }
    }

    @Synchronized
    fun recordSwipeResolveDuration(durationMs: Long) {
        val safeDuration = max(0L, durationMs)
        swipeResolveCount++
        swipeResolveTotalMs += safeDuration
        swipeResolveWorstMs = max(swipeResolveWorstMs, safeDuration)
        if (safeDuration >= SWIPE_RESOLVE_SPIKE_MS) {
            swipeResolveSpikeSuspicions++
            frameHitchSuspicions++
        }
    }

    @Synchronized
    fun recordCorrectionAfterAcceptedSuggestion() {
        correctionsAfterAcceptedSuggestion++
        acceptedSuggestionPendingCorrection = false
    }

    @Synchronized
    fun recordPopupFailure(reason: String) {
        popupFailures++
        addFailureReason("popup", reason)
    }

    @Synchronized
    fun recordLifecycleInterruption(reason: String) {
        lifecycleInterruptions++
        addFailureReason("lifecycle", reason)
    }

    @Synchronized
    fun recordSaveModelFailure(reason: String) {
        saveModelFailures++
        addFailureReason("saveModel", reason)
    }

    @Synchronized
    fun recordPredictorLoadFailure(reason: String) {
        predictorLoadFailures++
        addFailureReason("predictorLoad", reason)
    }

    @Synchronized
    fun recordNetworkFailure(reason: String) {
        networkFailures++
        addFailureReason("network", reason)
    }

    @Synchronized
    fun recordLoggingCancellation() {
        loggingCancellations++
        addFailureReason("logging", "cancelled")
    }

    @Synchronized
    fun snapshot(nowMs: Long): KeyboardMetricsSnapshot = buildSnapshot(nowMs)

    @Synchronized
    fun flushSnapshot(nowMs: Long): KeyboardMetricsSnapshot {
        val snapshot = buildSnapshot(nowMs)
        resetIntervalCounters()
        return snapshot
    }

    private fun buildSnapshot(nowMs: Long): KeyboardMetricsSnapshot {
        val averageLatency = if (latencyWindowCount == 0) {
            0L
        } else {
            latencyWindowTotalMs / latencyWindowCount
        }
        val acceptanceRate = if (suggestionImpressions == 0L) {
            0
        } else {
            ((suggestionClicks * 100L) / suggestionImpressions).toInt()
        }
        val predictionHitRate = if (keyPresses == 0L) {
            0
        } else {
            ((suggestionClicks * 100L) / keyPresses).toInt()
        }
        val averageCompletionLength = if (completionCount == 0L) {
            0
        } else {
            (totalCompletionLength / completionCount).toInt()
        }

        return KeyboardMetricsSnapshot(
            keyPresses = keyPresses,
            averageLatencyMs = averageLatency,
            worstLatencyMs = worstLatencyMs,
            sessionDurationMs = if (sessionStartedAtMs == 0L) 0L else max(0L, nowMs - sessionStartedAtMs),
            suggestionImpressions = suggestionImpressions,
            suggestionClicks = suggestionClicks,
            acceptanceRatePercent = acceptanceRate,
            ignoredSuggestions = ignoredSuggestions,
            topAcceptedWords = topAcceptedWords(),
            predictionHitRatePercent = predictionHitRate,
            correctionsAfterAcceptedSuggestion = correctionsAfterAcceptedSuggestion,
            backspaceAfterAutocomplete = backspaceAfterAutocomplete,
            averageCompletionLength = averageCompletionLength,
            popupFailures = popupFailures,
            lifecycleInterruptions = lifecycleInterruptions,
            saveModelFailures = saveModelFailures,
            predictorLoadFailures = predictorLoadFailures,
            networkFailures = networkFailures,
            loggingCancellations = loggingCancellations,
            failureReasons = failureReasons.toList(),
            swipeAttempts = swipeAttempts,
            swipeSuccesses = swipeSuccesses,
            swipeFailures = swipeFailures,
            swipeSuccessRatePercent = swipeSuccessRate(),
            swipeBackspaces = swipeBackspaces,
            longWordSwipeFailures = longWordSwipeFailures,
            swipeInterruptions = swipeInterruptions,
            repeatedSwipeFailureRuns = repeatedSwipeFailureRuns,
            modeSwitches = modeSwitches,
            symbolLayerSwitches = symbolLayerSwitches,
            symbolLayerDependencyPercent = symbolLayerDependencyPercent(),
            averageModeSwitchLatencyMs = averageModeSwitchLatencyMs(),
            worstModeSwitchLatencyMs = worstModeSwitchLatencyMs,
            latencySpikeSuspicions = latencySpikeSuspicions,
            frameHitchSuspicions = frameHitchSuspicions,
            averageSwipeResolveLatencyMs = averageSwipeResolveLatencyMs(),
            worstSwipeResolveLatencyMs = swipeResolveWorstMs,
            swipeResolveSpikeSuspicions = swipeResolveSpikeSuspicions
        )
    }

    @Synchronized
    fun usageSnapshot(nowMs: Long): KeyboardUsageSnapshot {
        val sessionDuration = if (sessionStartedAtMs == 0L) 0L else max(0L, nowMs - sessionStartedAtMs)
        val acceptanceRate = if (suggestionImpressions == 0L) {
            0
        } else {
            ((suggestionClicks * 100L) / suggestionImpressions).toInt()
        }
        val backspacesPer100Commits = if (keyPresses == 0L) {
            0
        } else {
            ((totalBackspaces * 100L) / keyPresses).toInt()
        }
        val burstTotal = activeBurstCount()
        val unstableTotal = unstableTypingBursts + if (isCurrentBurstUnstable()) 1L else 0L
        val stability = if (burstTotal == 0L) {
            100
        } else {
            (100L - ((unstableTotal * 100L) / burstTotal)).coerceIn(0L, 100L).toInt()
        }

        return KeyboardUsageSnapshot(
            sessionDurationMs = sessionDuration,
            keyCommits = keyPresses,
            totalBackspaces = totalBackspaces,
            backspacesPer100Commits = backspacesPer100Commits,
            rapidCorrectionBackspaces = rapidCorrectionBackspaces,
            repeatedCorrectionRuns = repeatedCorrectionRuns,
            suggestionImpressions = suggestionImpressions,
            suggestionClicks = suggestionClicks,
            suggestionAcceptanceRatePercent = acceptanceRate,
            typingBurstCount = burstTotal,
            longestTypingBurst = max(longestTypingBurst, currentBurstCommits),
            typingBurstStabilityPercent = stability,
            leftEdgePresses = keyConfidenceZones[KeyConfidenceZone.LEFT_EDGE.ordinal],
            rightEdgePresses = keyConfidenceZones[KeyConfidenceZone.RIGHT_EDGE.ordinal],
            centerAlphaPresses = keyConfidenceZones[KeyConfidenceZone.CENTER_ALPHA.ordinal],
            bottomModifierPresses = keyConfidenceZones[KeyConfidenceZone.BOTTOM_MODIFIER.ordinal],
            actionEdgePresses = keyConfidenceZones[KeyConfidenceZone.ACTION_EDGE.ordinal],
            unknownZonePresses = keyConfidenceZones[KeyConfidenceZone.UNKNOWN.ordinal],
            swipeAttempts = swipeAttempts,
            swipeSuccesses = swipeSuccesses,
            swipeFailures = swipeFailures,
            swipeSuccessRatePercent = swipeSuccessRate(),
            swipeBackspaces = swipeBackspaces,
            swipeBackspacesPer100Successes = swipeBackspacesPer100Successes(),
            longWordSwipeFailures = longWordSwipeFailures,
            swipeInterruptions = swipeInterruptions,
            repeatedSwipeFailureRuns = repeatedSwipeFailureRuns,
            modeSwitches = modeSwitches,
            symbolLayerSwitches = symbolLayerSwitches,
            symbolLayerDependencyPercent = symbolLayerDependencyPercent(),
            averageModeSwitchLatencyMs = averageModeSwitchLatencyMs(),
            worstModeSwitchLatencyMs = worstModeSwitchLatencyMs,
            latencySpikeSuspicions = latencySpikeSuspicions,
            frameHitchSuspicions = frameHitchSuspicions,
            averageSwipeResolveLatencyMs = averageSwipeResolveLatencyMs(),
            worstSwipeResolveLatencyMs = swipeResolveWorstMs,
            swipeResolveSpikeSuspicions = swipeResolveSpikeSuspicions
        )
    }

    @Synchronized
    fun productInsights(nowMs: Long): ProductFrictionReport =
        ProductInsightEngine.interpret(usageSnapshot(nowMs))

    private fun topAcceptedWords(): List<TopAcceptedWord> =
        acceptedWords.entries
            .sortedWith(
                compareByDescending<Map.Entry<String, Int>> { it.value }
                    .thenBy { it.key }
            )
            .take(topAcceptedLimit)
            .map { TopAcceptedWord(it.key, it.value) }

    private fun resetIntervalCounters() {
        keyPresses = 0L
        latencyWindow.fill(0L)
        latencyWindowCount = 0
        latencyWindowIndex = 0
        latencyWindowTotalMs = 0L
        worstLatencyMs = 0L
        suggestionImpressions = 0L
        suggestionClicks = 0L
        ignoredSuggestions = 0L
        acceptedWords.clear()
        correctionsAfterAcceptedSuggestion = 0L
        backspaceAfterAutocomplete = 0L
        totalCompletionLength = 0L
        completionCount = 0L
        popupFailures = 0L
        lifecycleInterruptions = 0L
        saveModelFailures = 0L
        predictorLoadFailures = 0L
        networkFailures = 0L
        loggingCancellations = 0L
        failureReasons.clear()
        acceptedSuggestionPendingCorrection = false
        swipePendingCorrection = false
        keyConfidenceZones.fill(0L)
        totalBackspaces = 0L
        rapidCorrectionBackspaces = 0L
        repeatedCorrectionRuns = 0L
        lastBackspaceAtMs = 0L
        consecutiveBackspaces = 0
        typingBurstCount = 0L
        unstableTypingBursts = 0L
        longestTypingBurst = 0
        currentBurstCommits = 0
        currentBurstCorrections = 0
        lastCommitAtMs = 0L
        swipeAttempts = 0L
        swipeSuccesses = 0L
        swipeFailures = 0L
        swipeBackspaces = 0L
        longWordSwipeFailures = 0L
        swipeInterruptions = 0L
        repeatedSwipeFailureRuns = 0L
        consecutiveSwipeFailures = 0
        modeSwitches = 0L
        symbolLayerSwitches = 0L
        totalModeSwitchLatencyMs = 0L
        worstModeSwitchLatencyMs = 0L
        latencySpikeSuspicions = 0L
        frameHitchSuspicions = 0L
        swipeResolveCount = 0L
        swipeResolveTotalMs = 0L
        swipeResolveWorstMs = 0L
        swipeResolveSpikeSuspicions = 0L
    }

    private fun recordBurstCommit(nowMs: Long) {
        if (lastCommitAtMs == 0L || nowMs - lastCommitAtMs > TYPING_BURST_GAP_MS) {
            closeCurrentBurst()
            typingBurstCount++
            currentBurstCommits = 0
            currentBurstCorrections = 0
        }

        currentBurstCommits++
        longestTypingBurst = max(longestTypingBurst, currentBurstCommits)
        lastCommitAtMs = nowMs
        consecutiveBackspaces = 0
    }

    private fun closeCurrentBurst() {
        if (currentBurstCommits == 0) return
        if (currentBurstCorrections * 100 >= currentBurstCommits * UNSTABLE_BURST_CORRECTION_PERCENT) {
            unstableTypingBursts++
        }
    }

    private fun activeBurstCount(): Long =
        typingBurstCount + if (currentBurstCommits > 0 && typingBurstCount == 0L) 1L else 0L

    private fun isCurrentBurstUnstable(): Boolean =
        currentBurstCommits > 0 &&
            currentBurstCorrections * 100 >= currentBurstCommits * UNSTABLE_BURST_CORRECTION_PERCENT

    private fun swipeSuccessRate(): Int =
        if (swipeAttempts == 0L) 0 else ((swipeSuccesses * 100L) / swipeAttempts).toInt()

    private fun swipeBackspacesPer100Successes(): Int =
        if (swipeSuccesses == 0L) 0 else ((swipeBackspaces * 100L) / swipeSuccesses).toInt()

    private fun symbolLayerDependencyPercent(): Int =
        if (modeSwitches == 0L) 0 else ((symbolLayerSwitches * 100L) / modeSwitches).toInt()

    private fun averageModeSwitchLatencyMs(): Long =
        if (modeSwitches == 0L) 0L else totalModeSwitchLatencyMs / modeSwitches

    private fun averageSwipeResolveLatencyMs(): Long =
        if (swipeResolveCount == 0L) 0L else swipeResolveTotalMs / swipeResolveCount

    private fun removeLowestAcceptedWord() {
        val entry = acceptedWords.entries.minWithOrNull(
            compareBy<Map.Entry<String, Int>> { it.value }.thenBy { it.key }
        ) ?: return
        acceptedWords.remove(entry.key)
    }

    private fun addFailureReason(type: String, reason: String) {
        if (failureReasons.size == failureReasonLimit) {
            failureReasons.removeFirst()
        }
        failureReasons.addLast("$type:${reason.take(MAX_REASON_LENGTH)}")
    }

    private fun privacyKey(word: String): String {
        val clean = word.trim().lowercase()
        if (clean.isEmpty()) return ""

        var hash = FNV_OFFSET
        for (char in clean) {
            hash = hash xor char.code
            hash *= FNV_PRIME
        }
        return "w${clean.length}:h${hash.toUInt().toString(16)}"
    }

    private companion object {
        const val DEFAULT_ROLLING_WINDOW_SIZE = 64
        const val DEFAULT_TOP_ACCEPTED_LIMIT = 8
        const val DEFAULT_FAILURE_REASON_LIMIT = 12
        const val DEFAULT_MAX_ACCEPTED_WORD_KEYS = 64
        const val MAX_VISIBLE_SUGGESTIONS = 3
        const val MAX_REASON_LENGTH = 36
        const val RAPID_CORRECTION_WINDOW_MS = 700L
        const val TYPING_BURST_GAP_MS = 1_500L
        const val REPEATED_CORRECTION_THRESHOLD = 3
        const val UNSTABLE_BURST_CORRECTION_PERCENT = 35
        const val LONG_SWIPE_SEQUENCE_LENGTH = 7
        const val REPEATED_SWIPE_FAILURE_THRESHOLD = 3
        const val LATENCY_SPIKE_MS = 40L
        const val FRAME_HITCH_SUSPECT_MS = 32L
        const val SWIPE_RESOLVE_SPIKE_MS = 48L
        const val FNV_OFFSET = -0x7ee3623b
        const val FNV_PRIME = 16777619
    }
}

enum class KeyConfidenceZone {
    LEFT_EDGE,
    RIGHT_EDGE,
    CENTER_ALPHA,
    BOTTOM_MODIFIER,
    ACTION_EDGE,
    UNKNOWN
}

data class KeyboardUsageSnapshot(
    val sessionDurationMs: Long,
    val keyCommits: Long,
    val totalBackspaces: Long,
    val backspacesPer100Commits: Int,
    val rapidCorrectionBackspaces: Long,
    val repeatedCorrectionRuns: Long,
    val suggestionImpressions: Long,
    val suggestionClicks: Long,
    val suggestionAcceptanceRatePercent: Int,
    val typingBurstCount: Long,
    val longestTypingBurst: Int,
    val typingBurstStabilityPercent: Int,
    val leftEdgePresses: Long,
    val rightEdgePresses: Long,
    val centerAlphaPresses: Long,
    val bottomModifierPresses: Long,
    val actionEdgePresses: Long,
    val unknownZonePresses: Long,
    val swipeAttempts: Long,
    val swipeSuccesses: Long,
    val swipeFailures: Long,
    val swipeSuccessRatePercent: Int,
    val swipeBackspaces: Long,
    val swipeBackspacesPer100Successes: Int,
    val longWordSwipeFailures: Long,
    val swipeInterruptions: Long,
    val repeatedSwipeFailureRuns: Long,
    val modeSwitches: Long,
    val symbolLayerSwitches: Long,
    val symbolLayerDependencyPercent: Int,
    val averageModeSwitchLatencyMs: Long,
    val worstModeSwitchLatencyMs: Long,
    val latencySpikeSuspicions: Long,
    val frameHitchSuspicions: Long,
    val averageSwipeResolveLatencyMs: Long = 0L,
    val worstSwipeResolveLatencyMs: Long = 0L,
    val swipeResolveSpikeSuspicions: Long = 0L
)

data class KeyboardMetricsSnapshot(
    val keyPresses: Long,
    val averageLatencyMs: Long,
    val worstLatencyMs: Long,
    val sessionDurationMs: Long,
    val suggestionImpressions: Long,
    val suggestionClicks: Long,
    val acceptanceRatePercent: Int,
    val ignoredSuggestions: Long,
    val topAcceptedWords: List<TopAcceptedWord>,
    val predictionHitRatePercent: Int,
    val correctionsAfterAcceptedSuggestion: Long,
    val backspaceAfterAutocomplete: Long,
    val averageCompletionLength: Int,
    val popupFailures: Long,
    val lifecycleInterruptions: Long,
    val saveModelFailures: Long,
    val predictorLoadFailures: Long,
    val networkFailures: Long,
    val loggingCancellations: Long,
    val failureReasons: List<String>,
    val swipeAttempts: Long,
    val swipeSuccesses: Long,
    val swipeFailures: Long,
    val swipeSuccessRatePercent: Int,
    val swipeBackspaces: Long,
    val longWordSwipeFailures: Long,
    val swipeInterruptions: Long,
    val repeatedSwipeFailureRuns: Long,
    val modeSwitches: Long,
    val symbolLayerSwitches: Long,
    val symbolLayerDependencyPercent: Int,
    val averageModeSwitchLatencyMs: Long,
    val worstModeSwitchLatencyMs: Long,
    val latencySpikeSuspicions: Long,
    val frameHitchSuspicions: Long,
    val averageSwipeResolveLatencyMs: Long = 0L,
    val worstSwipeResolveLatencyMs: Long = 0L,
    val swipeResolveSpikeSuspicions: Long = 0L
) {
    fun toCompactLogLine(): String =
        "keys=$keyPresses avg=${averageLatencyMs}ms worst=${worstLatencyMs}ms " +
            "session=${sessionDurationMs}ms sug=$suggestionImpressions clicks=$suggestionClicks " +
            "accept=$acceptanceRatePercent% hit=$predictionHitRatePercent% ignored=$ignoredSuggestions " +
            "backsAfterAuto=$backspaceAfterAutocomplete swipe=$swipeSuccesses/$swipeAttempts " +
            "swipeBacks=$swipeBackspaces longSwipeFail=$longWordSwipeFailures " +
            "modes=$modeSwitches symbolDep=$symbolLayerDependencyPercent% hitches=$frameHitchSuspicions " +
            "swipeResolveAvg=${averageSwipeResolveLatencyMs}ms swipeResolveWorst=${worstSwipeResolveLatencyMs}ms " +
            "failures=${totalFailures()}"

    fun totalFailures(): Long =
        popupFailures +
            lifecycleInterruptions +
            saveModelFailures +
            predictorLoadFailures +
            networkFailures +
            loggingCancellations
}

data class TopAcceptedWord(
    val wordKey: String,
    val count: Int
)
