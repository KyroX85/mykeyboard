package com.example.mykeyboard.metrics

object ProductInsightEngine {

    fun interpret(snapshot: KeyboardUsageSnapshot): ProductFrictionReport {
        val insights = mutableListOf<ProductInsight>()
        addSwipeInsight(snapshot, insights)
        addCorrectionInsight(snapshot, insights)
        addSymbolInsight(snapshot, insights)
        addEdgeInsight(snapshot, insights)
        addResponsivenessInsight(snapshot, insights)
        addRhythmInsight(snapshot, insights)

        val reportInsights = if (insights.isEmpty()) {
            baselineInsight(snapshot)
        } else {
            insights
        }

        return ProductFrictionReport(
            primaryClassification = reportInsights.first().classification,
            insights = reportInsights
        )
    }

    private fun addSwipeInsight(snapshot: KeyboardUsageSnapshot, output: MutableList<ProductInsight>) {
        if (snapshot.swipeAttempts < MIN_SWIPE_ATTEMPTS) return

        when {
            snapshot.swipeSuccessRatePercent < SWIPE_UNSTABLE_SUCCESS_RATE ||
                snapshot.longWordSwipeFailures >= LONG_WORD_FAILURE_LIMIT ||
                snapshot.swipeBackspacesPer100Successes >= SWIPE_BACKSPACE_RATE_LIMIT ||
                snapshot.swipeInterruptions >= SWIPE_INTERRUPTION_LIMIT ||
                snapshot.repeatedSwipeFailureRuns >= REPEATED_SWIPE_FAILURE_LIMIT -> {
                output.add(
                    ProductInsight(
                        classification = ProductStateClassification.SWIPE_UNSTABLE,
                        summary = "Swipe trust is unstable for this session.",
                        confidence = confidenceFor(snapshot.swipeAttempts, strongAt = 12L),
                        signalSource = "swipe_success, long_word_swipe_failure, swipe_backspace",
                        evidence = "success=${snapshot.swipeSuccessRatePercent}%, longFailures=${snapshot.longWordSwipeFailures}, swipeBackspacesPer100=${snapshot.swipeBackspacesPer100Successes}, interruptions=${snapshot.swipeInterruptions}, repeatedFailures=${snapshot.repeatedSwipeFailureRuns}",
                        threshold = "success<70% OR longFailures>=2 OR swipeBackspacesPer100>=35 OR interruptions>=2 OR repeatedFailures>=2",
                        enoughEvidence = true
                    )
                )
            }
        }
    }

    private fun addCorrectionInsight(snapshot: KeyboardUsageSnapshot, output: MutableList<ProductInsight>) {
        if (snapshot.keyCommits < MIN_KEY_COMMITS) return
        if (
            snapshot.backspacesPer100Commits >= HIGH_BACKSPACE_RATE ||
            snapshot.repeatedCorrectionRuns >= REPEATED_CORRECTION_LIMIT
        ) {
            output.add(
                ProductInsight(
                    classification = ProductStateClassification.HIGH_CORRECTION_LOAD,
                    summary = "Correction load is high enough to disrupt typing rhythm.",
                    confidence = confidenceFor(snapshot.keyCommits, strongAt = 30L),
                    signalSource = "backspace_rate, repeated_correction_runs",
                    evidence = "backspacesPer100=${snapshot.backspacesPer100Commits}, repeatedRuns=${snapshot.repeatedCorrectionRuns}",
                    threshold = "backspacesPer100>=25 OR repeatedRuns>=2",
                    enoughEvidence = true
                )
            )
        }
    }

    private fun addSymbolInsight(snapshot: KeyboardUsageSnapshot, output: MutableList<ProductInsight>) {
        if (snapshot.modeSwitches < MIN_MODE_SWITCHES) return
        if (snapshot.symbolLayerDependencyPercent >= HIGH_SYMBOL_DEPENDENCY) {
            output.add(
                ProductInsight(
                    classification = ProductStateClassification.HIGH_MODE_SWITCH_LOAD,
                    summary = "Symbol-layer dependence suggests transition friction.",
                    confidence = confidenceFor(snapshot.modeSwitches, strongAt = 12L),
                    signalSource = "mode_switches, symbol_layer_switches",
                    evidence = "modeSwitches=${snapshot.modeSwitches}, symbolDependency=${snapshot.symbolLayerDependencyPercent}%",
                    threshold = "modeSwitches>=6 AND symbolDependency>=60%",
                    enoughEvidence = true
                )
            )
        }
    }

    private fun addEdgeInsight(snapshot: KeyboardUsageSnapshot, output: MutableList<ProductInsight>) {
        val edgePresses = snapshot.leftEdgePresses + snapshot.rightEdgePresses + snapshot.actionEdgePresses
        val totalPresses = edgePresses + snapshot.centerAlphaPresses + snapshot.bottomModifierPresses
        if (totalPresses < MIN_ZONE_TOUCHES || snapshot.repeatedCorrectionRuns == 0L) return
        if (edgePresses >= snapshot.centerAlphaPresses) {
            output.add(
                ProductInsight(
                    classification = ProductStateClassification.EDGE_CONFIDENCE_WEAK,
                    summary = "Edge-heavy correction patterns suggest weaker edge-key confidence.",
                    confidence = confidenceFor(totalPresses, strongAt = 50L),
                    signalSource = "edge_zones, repeated_correction_runs",
                    evidence = "edgePresses=$edgePresses, centerPresses=${snapshot.centerAlphaPresses}, repeatedRuns=${snapshot.repeatedCorrectionRuns}",
                    threshold = "zoneTouches>=20 AND edgePresses>=centerPresses AND repeatedRuns>0",
                    enoughEvidence = true
                )
            )
        }
    }

    private fun addResponsivenessInsight(snapshot: KeyboardUsageSnapshot, output: MutableList<ProductInsight>) {
        if (snapshot.keyCommits < MIN_RESPONSIVENESS_COMMITS && snapshot.modeSwitches < MIN_MODE_SWITCHES) return
        if (
            snapshot.latencySpikeSuspicions >= LATENCY_SPIKE_LIMIT ||
            snapshot.frameHitchSuspicions >= FRAME_HITCH_LIMIT
        ) {
            output.add(
                ProductInsight(
                    classification = ProductStateClassification.RESPONSIVENESS_UNSTABLE,
                    summary = "Responsiveness signals suggest possible perceived latency instability.",
                    confidence = InsightConfidence.MEDIUM,
                    signalSource = "latency_spikes, frame_hitch_suspicions",
                    evidence = "latencySpikes=${snapshot.latencySpikeSuspicions}, frameHitches=${snapshot.frameHitchSuspicions}",
                    threshold = "latencySpikes>=2 OR frameHitches>=2",
                    enoughEvidence = true
                )
            )
        }
    }

    private fun addRhythmInsight(snapshot: KeyboardUsageSnapshot, output: MutableList<ProductInsight>) {
        if (snapshot.typingBurstCount < MIN_TYPING_BURSTS) return
        if (snapshot.typingBurstStabilityPercent < STABLE_RHYTHM_PERCENT) {
            output.add(
                ProductInsight(
                    classification = ProductStateClassification.TYPING_RHYTHM_UNSTABLE,
                    summary = "Typing rhythm is unstable during bursts.",
                    confidence = confidenceFor(snapshot.typingBurstCount, strongAt = 8L),
                    signalSource = "typing_burst_stability",
                    evidence = "bursts=${snapshot.typingBurstCount}, stability=${snapshot.typingBurstStabilityPercent}%",
                    threshold = "bursts>=3 AND stability<75%",
                    enoughEvidence = true
                )
            )
        }
    }

    private fun confidenceFor(count: Long, strongAt: Long): InsightConfidence = when {
        count >= strongAt -> InsightConfidence.HIGH
        count >= strongAt / 2 -> InsightConfidence.MEDIUM
        else -> InsightConfidence.LOW
    }

    private fun baselineInsight(snapshot: KeyboardUsageSnapshot): List<ProductInsight> {
        return when {
            hasStableTypingEvidence(snapshot) -> listOf(
                ProductInsight(
                    classification = ProductStateClassification.STABLE_TYPING,
                    summary = "Typing rhythm is stable with no high-friction pattern detected.",
                    confidence = confidenceFor(snapshot.keyCommits, strongAt = 60L),
                    signalSource = "key_commits, backspace_rate, typing_burst_stability, responsiveness",
                    evidence = "keys=${snapshot.keyCommits}, backspacesPer100=${snapshot.backspacesPer100Commits}, burstStability=${snapshot.typingBurstStabilityPercent}%, latencySpikes=${snapshot.latencySpikeSuspicions}, frameHitches=${snapshot.frameHitchSuspicions}",
                    threshold = "keys>=30 AND backspacesPer100<25 AND burstStability>=75% AND latency/frame hitch limits not exceeded",
                    enoughEvidence = true
                )
            )

            hasBroadLowFrictionEvidence(snapshot) -> listOf(
                ProductInsight(
                    classification = ProductStateClassification.LOW_FRICTION,
                    summary = "No strong local friction pattern detected yet.",
                    confidence = InsightConfidence.MEDIUM,
                    signalSource = "aggregate_session_metrics",
                    evidence = "keys=${snapshot.keyCommits}, swipes=${snapshot.swipeAttempts}, modeSwitches=${snapshot.modeSwitches}",
                    threshold = "Requires enough aggregate session volume with no friction threshold crossed.",
                    enoughEvidence = true
                )
            )

            else -> listOf(
                ProductInsight(
                    classification = ProductStateClassification.NOT_ENOUGH_EVIDENCE,
                    summary = "Not enough local product evidence yet.",
                    confidence = InsightConfidence.LOW,
                    signalSource = "session",
                    evidence = "keys=${snapshot.keyCommits}, swipes=${snapshot.swipeAttempts}, modeSwitches=${snapshot.modeSwitches}",
                    threshold = "Requires minimum interaction volume before classification.",
                    enoughEvidence = false
                )
            )
        }
    }

    private fun hasStableTypingEvidence(snapshot: KeyboardUsageSnapshot): Boolean =
        snapshot.keyCommits >= STABLE_TYPING_KEYS &&
            snapshot.backspacesPer100Commits < HIGH_BACKSPACE_RATE &&
            snapshot.repeatedCorrectionRuns < REPEATED_CORRECTION_LIMIT &&
            snapshot.typingBurstStabilityPercent >= STABLE_RHYTHM_PERCENT &&
            snapshot.latencySpikeSuspicions < LATENCY_SPIKE_LIMIT &&
            snapshot.frameHitchSuspicions < FRAME_HITCH_LIMIT

    private fun hasBroadLowFrictionEvidence(snapshot: KeyboardUsageSnapshot): Boolean =
        snapshot.keyCommits >= MIN_KEY_COMMITS ||
            snapshot.swipeAttempts >= MIN_SWIPE_ATTEMPTS ||
            snapshot.modeSwitches >= MIN_MODE_SWITCHES

    private const val MIN_SWIPE_ATTEMPTS = 5
    private const val SWIPE_UNSTABLE_SUCCESS_RATE = 70
    private const val LONG_WORD_FAILURE_LIMIT = 2L
    private const val SWIPE_BACKSPACE_RATE_LIMIT = 35
    private const val SWIPE_INTERRUPTION_LIMIT = 2L
    private const val REPEATED_SWIPE_FAILURE_LIMIT = 2L
    private const val MIN_KEY_COMMITS = 10L
    private const val STABLE_TYPING_KEYS = 30L
    private const val HIGH_BACKSPACE_RATE = 25
    private const val REPEATED_CORRECTION_LIMIT = 2L
    private const val MIN_MODE_SWITCHES = 6L
    private const val HIGH_SYMBOL_DEPENDENCY = 60
    private const val MIN_ZONE_TOUCHES = 20L
    private const val MIN_RESPONSIVENESS_COMMITS = 5L
    private const val LATENCY_SPIKE_LIMIT = 2L
    private const val FRAME_HITCH_LIMIT = 2L
    private const val MIN_TYPING_BURSTS = 3L
    private const val STABLE_RHYTHM_PERCENT = 75
}

data class ProductFrictionReport(
    val primaryClassification: ProductStateClassification,
    val insights: List<ProductInsight>
)

data class ProductInsight(
    val classification: ProductStateClassification,
    val summary: String,
    val confidence: InsightConfidence,
    val signalSource: String,
    val evidence: String,
    val threshold: String,
    val enoughEvidence: Boolean
)

enum class ProductStateClassification {
    NOT_ENOUGH_EVIDENCE,
    LOW_FRICTION,
    STABLE_TYPING,
    SWIPE_UNSTABLE,
    HIGH_CORRECTION_LOAD,
    HIGH_MODE_SWITCH_LOAD,
    EDGE_CONFIDENCE_WEAK,
    RESPONSIVENESS_UNSTABLE,
    TYPING_RHYTHM_UNSTABLE
}

enum class InsightConfidence {
    LOW,
    MEDIUM,
    HIGH
}
