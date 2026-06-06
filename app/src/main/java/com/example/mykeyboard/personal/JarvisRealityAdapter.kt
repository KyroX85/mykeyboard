package com.example.mykeyboard.personal

import android.util.Log
import java.util.Locale

enum class JarvisRealityRoute {
    PROJECT,
    PERSONAL,
    REFLECTION,
    EXECUTION
}

data class JarvisRealityDecision(
    val route: JarvisRealityRoute,
    val truthStatus: String,
    val sourcesUsed: List<String>,
    val missingData: List<String>,
    val safeResponseMode: String,
    val awarenessAttempted: Boolean,
    val projectSnapshot: ProjectSnapshot? = null
)

object JarvisRealityAdapter {
    fun classify(question: String): JarvisRealityDecision {
        val normalized = question.normalizedForRouting()
        val route = when {
            normalized.containsAny(EXECUTION_PATTERNS) -> JarvisRealityRoute.EXECUTION
            normalized.containsAny(PERSONAL_PATTERNS) -> JarvisRealityRoute.PERSONAL
            normalized.containsAny(REFLECTION_PATTERNS) -> JarvisRealityRoute.REFLECTION
            normalized.containsAny(PROJECT_PATTERNS) -> JarvisRealityRoute.PROJECT
            else -> JarvisRealityRoute.REFLECTION
        }

        return when (route) {
            JarvisRealityRoute.PROJECT -> projectAwarenessDecision(ProjectSnapshotRuntime.capture())
            JarvisRealityRoute.PERSONAL -> awarenessDecision(route, "personal awareness provider not attached in Android runtime yet")
            JarvisRealityRoute.REFLECTION -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_PARTIAL,
                sourcesUsed = listOf("founder brain reflection route"),
                missingData = emptyList(),
                safeResponseMode = MODE_REFLECTION_ONLY,
                awarenessAttempted = false
            )
            JarvisRealityRoute.EXECUTION -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_UNKNOWN,
                sourcesUsed = listOf("execution route detected"),
                missingData = listOf("execution layer is intentionally not enabled for Jarvis voice runtime"),
                safeResponseMode = MODE_INSUFFICIENT_DATA,
                awarenessAttempted = false
            )
        }
    }

    fun logDecision(sessionId: String, question: String, decision: JarvisRealityDecision) {
        Log.i(
            TAG,
            "Jarvis reality route: session=$sessionId; route=${decision.route}; truthStatus=${decision.truthStatus}; " +
                "safeResponseMode=${decision.safeResponseMode}; awarenessAttempted=${decision.awarenessAttempted}; " +
                "questionChars=${question.length}; missingData=${decision.missingData.joinToString("|")}"
        )
    }

    private fun projectAwarenessDecision(snapshot: ProjectSnapshot): JarvisRealityDecision =
        JarvisRealityDecision(
            route = JarvisRealityRoute.PROJECT,
            truthStatus = if (snapshot.hasEvidence()) TRUTH_PARTIAL else TRUTH_UNKNOWN,
            sourcesUsed = if (snapshot.hasEvidence()) listOf("runtime project snapshot") else listOf("question route classifier"),
            missingData = snapshot.missingFields(),
            safeResponseMode = if (snapshot.hasEvidence()) MODE_PARTIAL_WITH_LIMITS else MODE_INSUFFICIENT_DATA,
            awarenessAttempted = true,
            projectSnapshot = snapshot
        )

    private fun awarenessDecision(route: JarvisRealityRoute, missingProvider: String): JarvisRealityDecision =
        JarvisRealityDecision(
            route = route,
            truthStatus = TRUTH_PARTIAL,
            sourcesUsed = listOf("question route classifier"),
            missingData = listOf(missingProvider),
            safeResponseMode = MODE_PARTIAL_WITH_LIMITS,
            awarenessAttempted = true
        )

    private fun String.normalizedForRouting(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private fun String.containsAny(patterns: Set<String>): Boolean =
        patterns.any { contains(it) }

    private const val TAG = "AritenisJarvisReality"
    private const val TRUTH_PARTIAL = "PARTIAL"
    private const val TRUTH_UNKNOWN = "UNKNOWN"
    private const val MODE_PARTIAL_WITH_LIMITS = "PARTIAL_WITH_LIMITS"
    private const val MODE_REFLECTION_ONLY = "REFLECTION_ONLY"
    private const val MODE_INSUFFICIENT_DATA = "INSUFFICIENT_DATA"

    private val PROJECT_PATTERNS = setOf(
        "what happened today",
        "next milestone",
        "what is blocked",
        "what changed",
        "how is work going",
        "how is the android",
        "android app",
        "what am i building",
        "what are we building",
        "what is our dream",
        "current milestone",
        "latest commit",
        "build pass",
        "apk"
    )

    private val PERSONAL_PATTERNS = setOf(
        "homework",
        "school",
        "jee",
        "olympiad",
        "badminton",
        "sleep",
        "pending today",
        "what should i focus on",
        "how overloaded",
        "how much work is left",
        "did i finish everything",
        "study"
    )

    private val REFLECTION_PATTERNS = setOf(
        "who am i becoming",
        "what kills aritenis",
        "why am i building",
        "what motivates me",
        "what am i avoiding",
        "what am i missing",
        "what contradiction",
        "belief changed",
        "am i becoming",
        "dream itself",
        "why will we fail"
    )

    private val EXECUTION_PATTERNS = setOf(
        "execute",
        "implement",
        "commit",
        "build this",
        "fix this",
        "modify",
        "create patch",
        "run this",
        "delete"
    )
}
