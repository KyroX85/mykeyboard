package com.example.mykeyboard.metrics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Modifier

class KeyboardMetricsTest {

    @Test
    fun recordsRollingLatencyAverageAndWorstSpike() {
        val metrics = KeyboardMetrics(rollingWindowSize = 4)

        metrics.recordKeyCommit(10L, 10L)
        metrics.recordKeyCommit(20L, 20L)
        metrics.recordKeyCommit(30L, 30L)
        metrics.recordKeyCommit(80L, 80L)
        metrics.recordKeyCommit(100L, 100L)

        val snapshot = metrics.snapshot(1_000L)

        assertEquals(5, snapshot.keyPresses)
        assertEquals(57, snapshot.averageLatencyMs)
        assertEquals(100, snapshot.worstLatencyMs)
    }

    @Test
    fun tracksSuggestionEffectivenessWithoutRawAcceptedWords() {
        val metrics = KeyboardMetrics(topAcceptedLimit = 2)

        metrics.recordSuggestionImpression(listOf("hello", "help", "held"))
        metrics.recordSuggestionAccepted("hello", typedLength = 2)
        metrics.recordSuggestionImpression(listOf("world", "word"))
        metrics.recordSuggestionIgnored()
        metrics.recordSuggestionAccepted("world", typedLength = 1)
        metrics.recordSuggestionAccepted("world", typedLength = 1)

        val snapshot = metrics.snapshot(2_000L)

        assertEquals(5, snapshot.suggestionImpressions)
        assertEquals(3, snapshot.suggestionClicks)
        assertEquals(1, snapshot.ignoredSuggestions)
        assertEquals(60, snapshot.acceptanceRatePercent)
        assertEquals(2, snapshot.topAcceptedWords.size)
        assertFalse(snapshot.topAcceptedWords.any { it.wordKey == "hello" || it.wordKey == "world" })
        assertEquals(3, snapshot.averageCompletionLength)
    }

    @Test
    fun tracksPredictionQualityAndStabilityCounters() {
        val metrics = KeyboardMetrics()

        metrics.recordSuggestionAccepted("testing", typedLength = 4)
        metrics.recordBackspace()
        metrics.recordBackspace()
        metrics.recordCorrectionAfterAcceptedSuggestion()
        metrics.recordPopupFailure("bad-token")
        metrics.recordLifecycleInterruption("finish-input")
        metrics.recordSaveModelFailure("prefs")
        metrics.recordPredictorLoadFailure("json")
        metrics.recordNetworkFailure("timeout")
        metrics.recordLoggingCancellation()

        val snapshot = metrics.snapshot(3_000L)

        assertEquals(1, snapshot.backspaceAfterAutocomplete)
        assertEquals(1, snapshot.correctionsAfterAcceptedSuggestion)
        assertEquals(1, snapshot.popupFailures)
        assertEquals(1, snapshot.lifecycleInterruptions)
        assertEquals(1, snapshot.saveModelFailures)
        assertEquals(1, snapshot.predictorLoadFailures)
        assertEquals(1, snapshot.networkFailures)
        assertEquals(1, snapshot.loggingCancellations)
        assertTrue(snapshot.failureReasons.contains("popup:bad-token"))
    }

    @Test
    fun boundsAcceptedWordKeysToProtectMemory() {
        val metrics = KeyboardMetrics(maxAcceptedWordKeys = 4, topAcceptedLimit = 8)

        repeat(20) { index ->
            metrics.recordSuggestionAccepted("word$index", typedLength = 1)
        }

        val snapshot = metrics.snapshot(4_000L)

        assertTrue(snapshot.topAcceptedWords.size <= 4)
    }

    @Test
    fun flushSnapshotResetsIntervalCountersButKeepsSessionTiming() {
        val metrics = KeyboardMetrics()

        metrics.startSession(100L)
        metrics.recordKeyCommit(5L, 120L)
        metrics.recordSuggestionImpression(listOf("one"))

        val flushed = metrics.flushSnapshot(700L)
        val next = metrics.snapshot(900L)

        assertEquals(1, flushed.keyPresses)
        assertEquals(600, flushed.sessionDurationMs)
        assertEquals(0, next.keyPresses)
        assertEquals(800, next.sessionDurationMs)
    }

    @Test
    fun usageIntelligenceTracksOnlyAggregatedCorrectionAndZoneCounters() {
        val metrics = KeyboardMetrics()

        metrics.recordTypingTouch(100L, KeyConfidenceZone.LEFT_EDGE)
        metrics.recordKeyConfidenceZone(KeyConfidenceZone.LEFT_EDGE)
        metrics.recordKeyConfidenceZone(KeyConfidenceZone.CENTER_ALPHA)
        metrics.recordKeyConfidenceZone(KeyConfidenceZone.BOTTOM_MODIFIER)
        metrics.recordKeyCommit(8L, 100L)
        metrics.recordKeyCommit(9L, 180L)
        metrics.recordBackspace(240L)
        metrics.recordBackspace(500L)
        metrics.recordBackspace(700L)

        val usage = metrics.usageSnapshot(1_000L)

        assertEquals(900, usage.sessionDurationMs)
        assertEquals(2, usage.keyCommits)
        assertEquals(3, usage.totalBackspaces)
        assertEquals(150, usage.backspacesPer100Commits)
        assertEquals(2, usage.rapidCorrectionBackspaces)
        assertEquals(1, usage.repeatedCorrectionRuns)
        assertEquals(2, usage.leftEdgePresses)
        assertEquals(1, usage.centerAlphaPresses)
        assertEquals(1, usage.bottomModifierPresses)
        assertEquals(1, usage.typingBurstCount)
        assertEquals(2, usage.longestTypingBurst)
        assertEquals(0, usage.typingBurstStabilityPercent)
    }

    @Test
    fun usageSnapshotCannotRetainSensitiveTextFields() {
        val sensitiveFieldTypes = KeyboardUsageSnapshot::class.java.declaredFields
            .filterNot { Modifier.isStatic(it.modifiers) }
            .filter { it.type == String::class.java || Iterable::class.java.isAssignableFrom(it.type) }

        assertTrue(sensitiveFieldTypes.isEmpty())
    }

    @Test
    fun usageIntelligenceKeepsSuggestionUsefulnessAggregated() {
        val metrics = KeyboardMetrics()

        metrics.recordSuggestionImpression(listOf("hello", "help", "held"))
        metrics.recordSuggestionAccepted("hello", typedLength = 2)
        metrics.recordSuggestionIgnored()

        val usage = metrics.usageSnapshot(1_000L)

        assertEquals(3, usage.suggestionImpressions)
        assertEquals(1, usage.suggestionClicks)
        assertEquals(33, usage.suggestionAcceptanceRatePercent)
    }

    @Test
    fun productIntelligenceTracksSwipeReliabilityWithoutRawSequences() {
        val metrics = KeyboardMetrics()

        metrics.recordSwipeResolved(sequenceLength = 11, candidateCount = 3, committed = true)
        metrics.recordBackspace(100L)
        metrics.recordSwipeResolved(sequenceLength = 12, candidateCount = 0, committed = false)
        metrics.recordSwipeFailure(sequenceLength = 9, candidateCount = 0, interrupted = true)

        val usage = metrics.usageSnapshot(1_000L)
        val snapshot = metrics.snapshot(1_000L)

        assertEquals(3, usage.swipeAttempts)
        assertEquals(1, usage.swipeSuccesses)
        assertEquals(2, usage.swipeFailures)
        assertEquals(33, usage.swipeSuccessRatePercent)
        assertEquals(1, usage.swipeBackspaces)
        assertEquals(100, usage.swipeBackspacesPer100Successes)
        assertEquals(2, usage.longWordSwipeFailures)
        assertEquals(1, usage.swipeInterruptions)
        assertEquals(3, snapshot.swipeAttempts)
        assertEquals(1, snapshot.swipeSuccesses)
    }

    @Test
    fun productIntelligenceTracksModeSwitchesAndResponsivenessLocally() {
        val metrics = KeyboardMetrics()

        metrics.recordKeyCommit(45L, 100L)
        metrics.recordModeSwitch(durationMs = 20L, symbolLayer = true)
        metrics.recordModeSwitch(durationMs = 40L, symbolLayer = false)
        metrics.recordSwipeResolveDuration(22L)
        metrics.recordSwipeResolveDuration(51L)

        val usage = metrics.usageSnapshot(1_000L)
        val snapshot = metrics.snapshot(1_000L)

        assertEquals(2, usage.modeSwitches)
        assertEquals(1, usage.symbolLayerSwitches)
        assertEquals(50, usage.symbolLayerDependencyPercent)
        assertEquals(30, usage.averageModeSwitchLatencyMs)
        assertEquals(40, usage.worstModeSwitchLatencyMs)
        assertEquals(1, usage.latencySpikeSuspicions)
        assertEquals(3, usage.frameHitchSuspicions)
        assertEquals(36, usage.averageSwipeResolveLatencyMs)
        assertEquals(51, usage.worstSwipeResolveLatencyMs)
        assertEquals(1, usage.swipeResolveSpikeSuspicions)
        assertEquals(50, snapshot.symbolLayerDependencyPercent)
        assertEquals(3, snapshot.frameHitchSuspicions)
        assertEquals(36, snapshot.averageSwipeResolveLatencyMs)
        assertEquals(1, snapshot.swipeResolveSpikeSuspicions)
    }

    @Test
    fun lowEndLatencyAndRetryBurstsAreCapturedAsAggregateSignals() {
        val metrics = KeyboardMetrics()

        repeat(8) { index ->
            metrics.recordKeyCommit(durationMs = 55L + (index % 3), nowMs = 100L + index * 80L)
        }
        repeat(4) {
            metrics.recordSwipeFailure(sequenceLength = 10, candidateCount = 0, interrupted = false)
        }
        repeat(3) {
            metrics.recordBackspace(nowMs = 2_000L + it * 200L)
        }

        val usage = metrics.usageSnapshot(4_000L)

        assertTrue(usage.latencySpikeSuspicions >= 8)
        assertTrue(usage.frameHitchSuspicions >= 8)
        assertTrue(usage.repeatedSwipeFailureRuns >= 1)
        assertTrue(usage.repeatedCorrectionRuns >= 1)
    }

    @Test
    fun rapidSymbolSwitchingDependencyIsTrackedForFrictionReview() {
        val metrics = KeyboardMetrics()

        repeat(10) {
            metrics.recordModeSwitch(durationMs = 28L, symbolLayer = true)
        }
        repeat(3) {
            metrics.recordModeSwitch(durationMs = 22L, symbolLayer = false)
        }

        val usage = metrics.usageSnapshot(3_000L)
        assertEquals(13, usage.modeSwitches)
        assertEquals(10, usage.symbolLayerSwitches)
        assertTrue(usage.symbolLayerDependencyPercent >= 75)
    }
}
