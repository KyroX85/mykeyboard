package com.example.mykeyboard.personal

import android.util.Log
import java.util.Locale

enum class JarvisRealityRoute {
    AGENTS,
    PROJECT,
    PERSONAL,
    DAILY_BRIEFING,
    TIMELINE,
    OPERATOR,
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
    val realityScore: JarvisRealityScore,
    val agentVisibilitySnapshot: AgentVisibilitySnapshot? = null,
    val projectSnapshot: ProjectSnapshot? = null,
    val personalSnapshot: PersonalSnapshot? = null
)

object JarvisRealityAdapter {
    fun classify(question: String): JarvisRealityDecision {
        val normalized = question.normalizedForRouting()
        val route = when {
            normalized.containsAny(EXECUTION_PATTERNS) -> JarvisRealityRoute.EXECUTION
            PersonalOperatorDecisionLayer.isOperatorQuestion(question) -> JarvisRealityRoute.OPERATOR
            DailyRealityBriefingProvider.isBriefingQuestion(question) -> JarvisRealityRoute.DAILY_BRIEFING
            RealityTimelineQuestionClassifier.isTimelineQuestion(question) -> JarvisRealityRoute.TIMELINE
            normalized.containsAny(AGENT_VISIBILITY_PATTERNS) -> JarvisRealityRoute.AGENTS
            normalized.containsAny(PERSONAL_PATTERNS) -> JarvisRealityRoute.PERSONAL
            normalized.containsAny(PROJECT_PATTERNS) -> JarvisRealityRoute.PROJECT
            normalized.containsAny(REFLECTION_PATTERNS) -> JarvisRealityRoute.REFLECTION
            else -> JarvisRealityRoute.REFLECTION
        }

        return when (route) {
            JarvisRealityRoute.AGENTS -> agentVisibilityDecision(AgentVisibilityRuntime.capture())
            JarvisRealityRoute.PROJECT -> projectAwarenessDecision(ProjectSnapshotRuntime.capture())
            JarvisRealityRoute.PERSONAL -> personalAwarenessDecision(PersonalSnapshotRuntime.capture())
            JarvisRealityRoute.DAILY_BRIEFING -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_PARTIAL,
                sourcesUsed = listOf("reality events", "reality snapshot", "personal awareness", "project awareness"),
                missingData = emptyList(),
                safeResponseMode = MODE_PARTIAL_WITH_LIMITS,
                awarenessAttempted = true,
                realityScore = JarvisRealityScorer.score(JarvisRealityRoute.DAILY_BRIEFING)
            )
            JarvisRealityRoute.TIMELINE -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_PARTIAL,
                sourcesUsed = listOf("runtime reality event timeline"),
                missingData = emptyList(),
                safeResponseMode = MODE_PARTIAL_WITH_LIMITS,
                awarenessAttempted = true,
                realityScore = JarvisRealityScorer.score(JarvisRealityRoute.TIMELINE)
            )
            JarvisRealityRoute.OPERATOR -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_PARTIAL,
                sourcesUsed = listOf("reality snapshot", "personal awareness", "project awareness"),
                missingData = emptyList(),
                safeResponseMode = MODE_PARTIAL_WITH_LIMITS,
                awarenessAttempted = true,
                realityScore = JarvisRealityScorer.score(JarvisRealityRoute.OPERATOR)
            )
            JarvisRealityRoute.REFLECTION -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_PARTIAL,
                sourcesUsed = listOf("founder brain reflection route"),
                missingData = emptyList(),
                safeResponseMode = MODE_REFLECTION_ONLY,
                awarenessAttempted = false,
                realityScore = JarvisRealityScorer.score(JarvisRealityRoute.REFLECTION)
            )
            JarvisRealityRoute.EXECUTION -> JarvisRealityDecision(
                route = route,
                truthStatus = TRUTH_UNKNOWN,
                sourcesUsed = listOf("execution route detected"),
                missingData = listOf("execution layer is intentionally not enabled for Jarvis voice runtime"),
                safeResponseMode = MODE_INSUFFICIENT_DATA,
                awarenessAttempted = false,
                realityScore = JarvisRealityScorer.score(JarvisRealityRoute.EXECUTION)
            )
        }
    }

    private fun agentVisibilityDecision(snapshot: AgentVisibilitySnapshot): JarvisRealityDecision =
        JarvisRealityDecision(
            route = JarvisRealityRoute.AGENTS,
            truthStatus = if (snapshot.hasEvidence()) TRUTH_PARTIAL else TRUTH_UNKNOWN,
            sourcesUsed = if (snapshot.hasEvidence()) listOf("runtime agent visibility snapshot") else listOf("question route classifier"),
            missingData = snapshot.missingFields(),
            safeResponseMode = if (snapshot.hasEvidence()) MODE_PARTIAL_WITH_LIMITS else MODE_INSUFFICIENT_DATA,
            awarenessAttempted = true,
            realityScore = JarvisRealityScorer.score(JarvisRealityRoute.AGENTS, agentSnapshot = snapshot),
            agentVisibilitySnapshot = snapshot
        )

    fun logDecision(sessionId: String, question: String, decision: JarvisRealityDecision) {
        Log.i(
            TAG,
            "Jarvis reality route: session=$sessionId; route=${decision.route}; truthStatus=${decision.truthStatus}; " +
                "safeResponseMode=${decision.safeResponseMode}; awarenessAttempted=${decision.awarenessAttempted}; " +
                "questionChars=${question.length}; missingData=${decision.missingData.joinToString("|")}; " +
                "REALITY_PERCENT=${decision.realityScore.realityPercent}; factsUsed=${decision.realityScore.factsUsed}; " +
                "snapshot_fields_used=${decision.realityScore.snapshotFieldsUsed.joinToString("|")}; " +
                "founder_brain_used=${decision.realityScore.founderBrainUsed}"
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
            realityScore = JarvisRealityScorer.score(JarvisRealityRoute.PROJECT, snapshot),
            projectSnapshot = snapshot
        )

    private fun personalAwarenessDecision(snapshot: PersonalSnapshot): JarvisRealityDecision =
        JarvisRealityDecision(
            route = JarvisRealityRoute.PERSONAL,
            truthStatus = if (snapshot.hasEvidence()) TRUTH_PARTIAL else TRUTH_UNKNOWN,
            sourcesUsed = if (snapshot.hasEvidence()) listOf("runtime personal snapshot") else listOf("question route classifier"),
            missingData = snapshot.missingFields(),
            safeResponseMode = if (snapshot.hasEvidence()) MODE_PARTIAL_WITH_LIMITS else MODE_INSUFFICIENT_DATA,
            awarenessAttempted = true,
            realityScore = JarvisRealityScorer.score(JarvisRealityRoute.PERSONAL, personalSnapshot = snapshot),
            personalSnapshot = snapshot
        )

    private fun awarenessDecision(route: JarvisRealityRoute, missingProvider: String): JarvisRealityDecision =
        JarvisRealityDecision(
            route = route,
            truthStatus = TRUTH_PARTIAL,
            sourcesUsed = listOf("question route classifier"),
            missingData = listOf(missingProvider),
            safeResponseMode = MODE_PARTIAL_WITH_LIMITS,
            awarenessAttempted = true,
            realityScore = JarvisRealityScorer.score(route)
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

    private val AGENT_VISIBILITY_PATTERNS = setOf(
        "what are my agents doing",
        "what are the agents doing",
        "what are agents doing",
        "what did the agents do",
        "what did my agents do",
        "agents doing",
        "agent status",
        "agents status",
        "are my agents alive",
        "are agents alive",
        "what is coder doing",
        "what is reviewer doing",
        "what is auditor doing",
        "what is cto doing"
    )

    private val PROJECT_PATTERNS = setOf(
        "what happened today",
        "what changed today",
        "what are you doing",
        "what are we doing",
        "what are we working on",
        "what are you working on",
        "what is next",
        "what next",
        "next action",
        "what is the next action",
        "next milestone",
        "what is the next milestone",
        "what is blocked",
        "current blocker",
        "current blockers",
        "known blocker",
        "known blockers",
        "what changed",
        "how is work going",
        "how is the android",
        "android app",
        "what am i building",
        "what are we building",
        "current milestone",
        "milestone",
        "latest commit",
        "commits",
        "build status",
        "build pass",
        "build failed",
        "project progress",
        "what progress was made",
        "what progress did we make",
        "current progress",
        "what is pending in project",
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
        "what classes are left",
        "classes are left",
        "classes left",
        "class timings",
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
        "what is our dream",
        "our dream",
        "vision",
        "strategy",
        "tradeoff",
        "tradeoffs",
        "identity",
        "belief changed",
        "am i becoming",
        "dream itself",
        "why will we fail"
    )

    private val EXECUTION_PATTERNS = setOf(
        "execute",
        "implement",
        "commit it",
        "commit this",
        "make commit",
        "build this",
        "fix this",
        "call ",
        "open ",
        "open app ",
        "open url ",
        "open website ",
        "open link ",
        "send whatsapp ",
        "whatsapp ",
        "create reminder ",
        "remind me ",
        "modify",
        "create patch",
        "run this",
        "delete"
    )
}
