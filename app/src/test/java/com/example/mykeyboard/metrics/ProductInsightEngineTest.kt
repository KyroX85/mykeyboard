package com.example.mykeyboard.metrics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Modifier

class ProductInsightEngineTest {

    @Test
    fun returnsNotEnoughEvidenceForSmallSamples() {
        val report = ProductInsightEngine.interpret(baseSnapshot(keyCommits = 2, swipeAttempts = 1))

        assertEquals(ProductStateClassification.NOT_ENOUGH_EVIDENCE, report.primaryClassification)
        assertEquals(1, report.insights.size)
        assertFalse(report.insights.first().enoughEvidence)
    }

    @Test
    fun classifiesSwipeTrustCollapseFromAggregateSignals() {
        val report = ProductInsightEngine.interpret(
            baseSnapshot(
                swipeAttempts = 10,
                swipeSuccesses = 5,
                swipeFailures = 5,
                swipeSuccessRatePercent = 50,
                longWordSwipeFailures = 2,
                swipeBackspacesPer100Successes = 40
            )
        )

        val insight = report.insights.first()
        assertEquals(ProductStateClassification.SWIPE_UNSTABLE, insight.classification)
        assertEquals(InsightConfidence.MEDIUM, insight.confidence)
        assertTrue(insight.signalSource.contains("swipe_success"))
        assertTrue(insight.threshold.contains("success<70%"))
    }

    @Test
    fun classifiesSwipeInterruptionsAsSwipeTrustCollapse() {
        val report = ProductInsightEngine.interpret(
            baseSnapshot(
                swipeAttempts = 6,
                swipeSuccesses = 6,
                swipeSuccessRatePercent = 100,
                swipeInterruptions = 2
            )
        )

        val insight = report.insights.first()
        assertEquals(ProductStateClassification.SWIPE_UNSTABLE, insight.classification)
        assertTrue(insight.evidence.contains("interruptions=2"))
    }

    @Test
    fun classifiesCorrectionAndSymbolFrictionWithoutRawText() {
        val report = ProductInsightEngine.interpret(
            baseSnapshot(
                keyCommits = 40,
                backspacesPer100Commits = 30,
                repeatedCorrectionRuns = 2,
                modeSwitches = 8,
                symbolLayerSwitches = 6,
                symbolLayerDependencyPercent = 75
            )
        )

        assertTrue(report.insights.any { it.classification == ProductStateClassification.HIGH_CORRECTION_LOAD })
        assertTrue(report.insights.any { it.classification == ProductStateClassification.HIGH_MODE_SWITCH_LOAD })
        assertTrue(report.insights.none { it.evidence.contains("hello", ignoreCase = true) })
    }

    @Test
    fun classifiesEdgeConfidenceOnlyWhenCorrectionsAlsoExist() {
        val noCorrectionReport = ProductInsightEngine.interpret(
            baseSnapshot(
                leftEdgePresses = 12,
                rightEdgePresses = 12,
                centerAlphaPresses = 10,
                repeatedCorrectionRuns = 0
            )
        )
        assertFalse(noCorrectionReport.insights.any { it.classification == ProductStateClassification.EDGE_CONFIDENCE_WEAK })

        val correctionReport = ProductInsightEngine.interpret(
            baseSnapshot(
                leftEdgePresses = 12,
                rightEdgePresses = 12,
                centerAlphaPresses = 10,
                repeatedCorrectionRuns = 1
            )
        )
        assertTrue(correctionReport.insights.any { it.classification == ProductStateClassification.EDGE_CONFIDENCE_WEAK })
    }

    @Test
    fun classifiesResponsivenessAndRhythmInstability() {
        val report = ProductInsightEngine.interpret(
            baseSnapshot(
                keyCommits = 20,
                latencySpikeSuspicions = 2,
                frameHitchSuspicions = 2,
                typingBurstCount = 4,
                typingBurstStabilityPercent = 50
            )
        )

        assertTrue(report.insights.any { it.classification == ProductStateClassification.RESPONSIVENESS_UNSTABLE })
        assertTrue(report.insights.any { it.classification == ProductStateClassification.TYPING_RHYTHM_UNSTABLE })
    }

    @Test
    fun classifiesStableTypingWhenEvidenceIsSufficientAndNoFrictionCrossesThresholds() {
        val report = ProductInsightEngine.interpret(
            baseSnapshot(
                keyCommits = 40,
                backspacesPer100Commits = 8,
                typingBurstCount = 4,
                typingBurstStabilityPercent = 90
            )
        )

        assertEquals(ProductStateClassification.STABLE_TYPING, report.primaryClassification)
        assertTrue(report.insights.first().enoughEvidence)
    }

    @Test
    fun classifiesLowFrictionWhenThereIsVolumeButNotEnoughStableTypingEvidence() {
        val report = ProductInsightEngine.interpret(
            baseSnapshot(
                keyCommits = 12,
                backspacesPer100Commits = 5
            )
        )

        assertEquals(ProductStateClassification.LOW_FRICTION, report.primaryClassification)
        assertTrue(report.insights.first().enoughEvidence)
    }

    @Test
    fun productInsightDataDoesNotContainCollectionsOfUserText() {
        val forbiddenFields = ProductInsight::class.java.declaredFields
            .filterNot { Modifier.isStatic(it.modifiers) }
            .filter { Iterable::class.java.isAssignableFrom(it.type) }

        assertTrue(forbiddenFields.isEmpty())
    }

    @Test
    fun keyboardMetricsExposesLocalProductInsights() {
        val metrics = KeyboardMetrics()
        repeat(5) {
            metrics.recordSwipeResolved(sequenceLength = 9, candidateCount = 0, committed = false)
        }

        val report = metrics.productInsights(1_000L)

        assertEquals(ProductStateClassification.SWIPE_UNSTABLE, report.primaryClassification)
    }

    private fun baseSnapshot(
        keyCommits: Long = 0,
        totalBackspaces: Long = 0,
        backspacesPer100Commits: Int = 0,
        rapidCorrectionBackspaces: Long = 0,
        repeatedCorrectionRuns: Long = 0,
        suggestionImpressions: Long = 0,
        suggestionClicks: Long = 0,
        suggestionAcceptanceRatePercent: Int = 0,
        typingBurstCount: Long = 0,
        longestTypingBurst: Int = 0,
        typingBurstStabilityPercent: Int = 100,
        leftEdgePresses: Long = 0,
        rightEdgePresses: Long = 0,
        centerAlphaPresses: Long = 0,
        bottomModifierPresses: Long = 0,
        actionEdgePresses: Long = 0,
        unknownZonePresses: Long = 0,
        swipeAttempts: Long = 0,
        swipeSuccesses: Long = 0,
        swipeFailures: Long = 0,
        swipeSuccessRatePercent: Int = 0,
        swipeBackspaces: Long = 0,
        swipeBackspacesPer100Successes: Int = 0,
        longWordSwipeFailures: Long = 0,
        swipeInterruptions: Long = 0,
        repeatedSwipeFailureRuns: Long = 0,
        modeSwitches: Long = 0,
        symbolLayerSwitches: Long = 0,
        symbolLayerDependencyPercent: Int = 0,
        averageModeSwitchLatencyMs: Long = 0,
        worstModeSwitchLatencyMs: Long = 0,
        latencySpikeSuspicions: Long = 0,
        frameHitchSuspicions: Long = 0
    ) = KeyboardUsageSnapshot(
        sessionDurationMs = 1_000L,
        keyCommits = keyCommits,
        totalBackspaces = totalBackspaces,
        backspacesPer100Commits = backspacesPer100Commits,
        rapidCorrectionBackspaces = rapidCorrectionBackspaces,
        repeatedCorrectionRuns = repeatedCorrectionRuns,
        suggestionImpressions = suggestionImpressions,
        suggestionClicks = suggestionClicks,
        suggestionAcceptanceRatePercent = suggestionAcceptanceRatePercent,
        typingBurstCount = typingBurstCount,
        longestTypingBurst = longestTypingBurst,
        typingBurstStabilityPercent = typingBurstStabilityPercent,
        leftEdgePresses = leftEdgePresses,
        rightEdgePresses = rightEdgePresses,
        centerAlphaPresses = centerAlphaPresses,
        bottomModifierPresses = bottomModifierPresses,
        actionEdgePresses = actionEdgePresses,
        unknownZonePresses = unknownZonePresses,
        swipeAttempts = swipeAttempts,
        swipeSuccesses = swipeSuccesses,
        swipeFailures = swipeFailures,
        swipeSuccessRatePercent = swipeSuccessRatePercent,
        swipeBackspaces = swipeBackspaces,
        swipeBackspacesPer100Successes = swipeBackspacesPer100Successes,
        longWordSwipeFailures = longWordSwipeFailures,
        swipeInterruptions = swipeInterruptions,
        repeatedSwipeFailureRuns = repeatedSwipeFailureRuns,
        modeSwitches = modeSwitches,
        symbolLayerSwitches = symbolLayerSwitches,
        symbolLayerDependencyPercent = symbolLayerDependencyPercent,
        averageModeSwitchLatencyMs = averageModeSwitchLatencyMs,
        worstModeSwitchLatencyMs = worstModeSwitchLatencyMs,
        latencySpikeSuspicions = latencySpikeSuspicions,
        frameHitchSuspicions = frameHitchSuspicions
    )
}
