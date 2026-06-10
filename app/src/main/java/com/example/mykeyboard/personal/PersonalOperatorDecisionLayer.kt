package com.example.mykeyboard.personal

import java.util.Locale

data class PersonalOperatorDecision(
    val currentPriorities: List<String>,
    val recommendedNextAction: String?,
    val reason: String?
) {
    fun hasEvidence(): Boolean =
        currentPriorities.isNotEmpty() &&
            recommendedNextAction != null &&
            reason != null
}

object PersonalOperatorDecisionLayer {
    fun decide(
        realitySnapshot: RealitySnapshot,
        personalSnapshot: PersonalSnapshot,
        projectSnapshot: ProjectSnapshot
    ): PersonalOperatorDecision {
        val priorities = buildList {
            addAll(criticalPriorities(realitySnapshot, personalSnapshot, projectSnapshot))
            addAll(schoolPriorities(personalSnapshot))
            addAll(healthPriorities(personalSnapshot))
            addAll(aritenisPriorities(realitySnapshot, projectSnapshot))
        }.distinct()

        val nextAction = priorities.firstOrNull()
        return PersonalOperatorDecision(
            currentPriorities = priorities,
            recommendedNextAction = nextAction,
            reason = nextAction?.let { reasonFor(it) }
        )
    }

    fun isOperatorQuestion(question: String): Boolean {
        val normalized = question.normalizedOperatorQuestion()
        return normalized == "what should i do now" ||
            normalized == "what is pending" ||
            normalized == "what is most important today" ||
            normalized == "what should i focus on now" ||
            normalized == "what should i work on now"
    }

    private fun criticalPriorities(
        realitySnapshot: RealitySnapshot,
        personalSnapshot: PersonalSnapshot,
        projectSnapshot: ProjectSnapshot
    ): List<String> = buildList {
        realitySnapshot.currentBlockers?.forEach { add("Resolve blocker: $it") }
        projectSnapshot.openBlockers?.forEach { add("Resolve project blocker: $it") }
        projectSnapshot.knownBlockers?.forEach { add("Resolve known blocker: $it") }
        personalSnapshot.manualCommitments
            ?.filter { it.isCriticalCommitment() }
            ?.forEach { add("Handle deadline: $it") }
        projectSnapshot.lastFailedBuild?.let { add("Investigate failed build: $it") }
    }

    private fun schoolPriorities(snapshot: PersonalSnapshot): List<String> = buildList {
        snapshot.homeworkTasks?.forEach { add("Complete homework: $it") }
        snapshot.classTimings?.firstOrNull()?.let { add("Prepare for class: $it") }
        snapshot.jeeTimings?.firstOrNull()?.let { add("Complete JEE work: $it") }
    }

    private fun healthPriorities(snapshot: PersonalSnapshot): List<String> =
        snapshot.manualCommitments
            ?.filter { it.isHealthCommitment() }
            ?.map { "Handle health item: $it" }
            .orEmpty()

    private fun aritenisPriorities(
        realitySnapshot: RealitySnapshot,
        projectSnapshot: ProjectSnapshot
    ): List<String> = buildList {
        projectSnapshot.currentMilestone?.let { add("Work on Aritenis milestone: $it") }
        realitySnapshot.currentMilestone?.let { add("Work on current milestone: $it") }
        projectSnapshot.latestCommitMessage?.let { add("Review recent Aritenis change: $it") }
        realitySnapshot.recentProgress?.firstOrNull()?.let { add("Continue from recent progress: $it") }
    }

    private fun reasonFor(priority: String): String =
        when {
            priority.startsWith("Resolve") -> "A blocker is verified in current reality."
            priority.startsWith("Handle deadline") -> "A deadline or urgent commitment is verified."
            priority.startsWith("Investigate failed build") -> "A failed build is verified."
            priority.startsWith("Complete homework") -> "Homework is verified in personal awareness."
            priority.startsWith("Prepare for class") -> "Class timing is verified in personal awareness."
            priority.startsWith("Complete JEE") -> "JEE work is verified in personal awareness."
            priority.startsWith("Handle health") -> "A health item is verified in personal awareness."
            else -> "Aritenis project evidence is available."
        }

    private fun String.isCriticalCommitment(): Boolean {
        val normalized = normalizedOperatorQuestion()
        return normalized.contains("deadline") ||
            normalized.contains("due") ||
            normalized.contains("urgent") ||
            normalized.contains("submit")
    }

    private fun String.isHealthCommitment(): Boolean {
        val normalized = normalizedOperatorQuestion()
        return normalized.contains("sleep") ||
            normalized.contains("rest") ||
            normalized.contains("medicine") ||
            normalized.contains("doctor") ||
            normalized.contains("health")
    }

    private fun String.normalizedOperatorQuestion(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}

object PersonalOperatorDecisionFormatter {
    fun voiceSummary(decision: PersonalOperatorDecision): String {
        if (!decision.hasEvidence()) {
            return "I do not have enough verified reality, personal, or project data to decide."
        }
        return "Current priorities: ${decision.currentPriorities.joinToString("; ")}. " +
            "Recommended next action: ${decision.recommendedNextAction}. " +
            "Reason: ${decision.reason}"
    }
}
