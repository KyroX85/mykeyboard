package com.example.mykeyboard.personal

import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

data class JarvisRealityModeVerdict(
    val canAnswer: Boolean,
    val speech: String?,
    val truthStatus: String,
    val sourcesUsed: List<String>,
    val lastVerifiedTimestamp: String?,
    val reason: String
)

object JarvisRealityMode {
    fun evaluateProject(
        decision: JarvisRealityDecision,
        nowMs: Long = System.currentTimeMillis()
    ): JarvisRealityModeVerdict {
        val snapshot = decision.projectSnapshot
        val timestamp = snapshot?.lastVerifiedTimestamp
        return evaluate(
            hasEvidence = snapshot?.hasEvidence() == true,
            realityPercent = decision.realityScore.realityPercent,
            sourcesUsed = decision.sourcesUsed,
            lastVerifiedTimestamp = timestamp,
            nowMs = nowMs
        )
    }

    fun evaluateAgents(
        decision: JarvisRealityDecision,
        nowMs: Long = System.currentTimeMillis()
    ): JarvisRealityModeVerdict {
        val snapshot = decision.agentVisibilitySnapshot
        val timestamp = snapshot?.lastVerifiedTimestamp
        return evaluate(
            hasEvidence = snapshot?.hasEvidence() == true,
            realityPercent = decision.realityScore.realityPercent,
            sourcesUsed = decision.sourcesUsed,
            lastVerifiedTimestamp = timestamp,
            nowMs = nowMs
        )
    }

    private fun evaluate(
        hasEvidence: Boolean,
        realityPercent: Int,
        sourcesUsed: List<String>,
        lastVerifiedTimestamp: String?,
        nowMs: Long
    ): JarvisRealityModeVerdict {
        if (!hasEvidence || realityPercent < MIN_CONFIDENCE_PERCENT) {
            return JarvisRealityModeVerdict(
                canAnswer = false,
                speech = INSUFFICIENT_DATA_SPEECH,
                truthStatus = TRUTH_UNKNOWN,
                sourcesUsed = sourcesUsed,
                lastVerifiedTimestamp = lastVerifiedTimestamp,
                reason = "confidence_below_threshold"
            )
        }

        if (!isFresh(lastVerifiedTimestamp, nowMs)) {
            return JarvisRealityModeVerdict(
                canAnswer = false,
                speech = OUTDATED_PROJECT_SPEECH,
                truthStatus = TRUTH_OUTDATED,
                sourcesUsed = sourcesUsed,
                lastVerifiedTimestamp = lastVerifiedTimestamp,
                reason = "snapshot_outdated"
            )
        }

        return JarvisRealityModeVerdict(
            canAnswer = true,
            speech = null,
            truthStatus = TRUTH_VERIFIED,
            sourcesUsed = sourcesUsed,
            lastVerifiedTimestamp = lastVerifiedTimestamp,
            reason = "verified_reality"
        )
    }

    private fun isFresh(timestamp: String?, nowMs: Long): Boolean {
        val verifiedAtMs = parseIsoTimestamp(timestamp) ?: return false
        val ageMs = nowMs - verifiedAtMs
        return ageMs in 0..MAX_SNAPSHOT_AGE_MS
    }

    private fun parseIsoTimestamp(timestamp: String?): Long? {
        val value = timestamp?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return ISO_FORMATS.firstNotNullOfOrNull { pattern ->
            try {
                SimpleDateFormat(pattern, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.parse(value)?.time
            } catch (_: ParseException) {
                null
            }
        }
    }

    const val INSUFFICIENT_DATA_SPEECH = "INSUFFICIENT DATA."
    const val OUTDATED_PROJECT_SPEECH = "Project state is outdated. Refresh required."
    private const val MIN_CONFIDENCE_PERCENT = 70
    private val MAX_SNAPSHOT_AGE_MS = TimeUnit.HOURS.toMillis(48)
    private const val TRUTH_UNKNOWN = "UNKNOWN"
    private const val TRUTH_OUTDATED = "OUTDATED"
    private const val TRUTH_VERIFIED = "VERIFIED"
    private val ISO_FORMATS = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        "yyyy-MM-dd'T'HH:mm:ssXXX"
    )
}
