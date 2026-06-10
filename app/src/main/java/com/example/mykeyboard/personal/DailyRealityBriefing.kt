package com.example.mykeyboard.personal

import java.util.Locale

data class DailyRealityBriefing(
    val projectCommits: String?,
    val projectBuilds: String?,
    val projectBlockers: String?,
    val milestoneProgress: String?,
    val personalCommitments: String?,
    val personalReminders: String?,
    val personalPendingItems: String?,
    val operatorNextAction: String?
)

object DailyRealityBriefingProvider {
    fun create(
        todayEvents: List<RealityEvent>,
        realitySnapshot: RealitySnapshot,
        personalSnapshot: PersonalSnapshot,
        projectSnapshot: ProjectSnapshot,
        operatorDecision: PersonalOperatorDecision
    ): DailyRealityBriefing =
        DailyRealityBriefing(
            projectCommits = commits(todayEvents, projectSnapshot),
            projectBuilds = builds(todayEvents, projectSnapshot),
            projectBlockers = blockers(todayEvents, realitySnapshot, projectSnapshot),
            milestoneProgress = milestoneProgress(realitySnapshot, projectSnapshot),
            personalCommitments = personalSnapshot.manualCommitments?.joinEvidence(),
            personalReminders = reminders(todayEvents),
            personalPendingItems = pendingItems(personalSnapshot),
            operatorNextAction = operatorDecision.recommendedNextAction
        )

    fun isBriefingQuestion(question: String): Boolean {
        val normalized = question.normalizedBriefingQuestion()
        return normalized == "what happened today" ||
            normalized == "daily reality briefing" ||
            normalized == "give me daily reality briefing"
    }

    private fun commits(events: List<RealityEvent>, projectSnapshot: ProjectSnapshot): String? {
        val commits = events
            .filter { it.eventType == RealityEventType.COMMIT_CREATED }
            .mapNotNull { event -> event.payload.valueFor("commit_message", "message", "summary", "sha") }
        return when {
            commits.isNotEmpty() -> commits.joinEvidence()
            projectSnapshot.commitsToday != null || projectSnapshot.latestCommitMessage != null ->
                buildList {
                    projectSnapshot.commitsToday?.let { add("$it commits today") }
                    projectSnapshot.latestCommitMessage?.let { add(it) }
                }.joinEvidence()
            else -> null
        }
    }

    private fun builds(events: List<RealityEvent>, projectSnapshot: ProjectSnapshot): String? {
        val builds = events
            .filter { it.eventType == RealityEventType.BUILD_STARTED || it.eventType == RealityEventType.BUILD_PASSED || it.eventType == RealityEventType.BUILD_FAILED }
            .mapNotNull { event -> event.payload.valueFor("summary", "task", "result") ?: event.eventType.buildLabel() }
        return when {
            builds.isNotEmpty() -> builds.joinEvidence()
            projectSnapshot.latestBuild != null -> projectSnapshot.latestBuild
            projectSnapshot.lastSuccessfulBuild != null -> projectSnapshot.lastSuccessfulBuild
            projectSnapshot.lastFailedBuild != null -> projectSnapshot.lastFailedBuild
            else -> null
        }
    }

    private fun blockers(
        events: List<RealityEvent>,
        realitySnapshot: RealitySnapshot,
        projectSnapshot: ProjectSnapshot
    ): String? {
        val eventBlockers = events
            .filter { it.eventType == RealityEventType.TASK_BLOCKED }
            .mapNotNull { event -> event.payload.valueFor("blocker", "task", "reason") }
        return eventBlockers
            .ifEmpty { realitySnapshot.currentBlockers.orEmpty() }
            .ifEmpty { projectSnapshot.openBlockers.orEmpty() }
            .ifEmpty { projectSnapshot.knownBlockers.orEmpty() }
            .joinEvidence()
    }

    private fun milestoneProgress(realitySnapshot: RealitySnapshot, projectSnapshot: ProjectSnapshot): String? =
        realitySnapshot.currentMilestone
            ?: projectSnapshot.currentMilestone
            ?: realitySnapshot.recentProgress?.joinEvidence()
            ?: projectSnapshot.latestCommitMessage

    private fun reminders(events: List<RealityEvent>): String? =
        events
            .filter { it.eventType == RealityEventType.REMINDER_CREATED || it.eventType == RealityEventType.REMINDER_COMPLETED }
            .mapNotNull { event -> event.payload.valueFor("summary", "title", "reminder") ?: event.eventType.reminderLabel() }
            .joinEvidence()

    private fun pendingItems(snapshot: PersonalSnapshot): String? =
        buildList {
            snapshot.homeworkTasks?.let { addAll(it) }
            snapshot.userEnteredSchedule?.let { addAll(it) }
            snapshot.jeeTimings?.let { addAll(it) }
            snapshot.badmintonTimings?.let { addAll(it) }
        }.joinEvidence()

    private fun RealityEventType.buildLabel(): String? =
        when (this) {
            RealityEventType.BUILD_STARTED -> "build started"
            RealityEventType.BUILD_PASSED -> "build passed"
            RealityEventType.BUILD_FAILED -> "build failed"
            else -> null
        }

    private fun RealityEventType.reminderLabel(): String? =
        when (this) {
            RealityEventType.REMINDER_CREATED -> "reminder created"
            RealityEventType.REMINDER_COMPLETED -> "reminder completed"
            else -> null
        }

    private fun List<String>.joinEvidence(): String? =
        mapNotNull { it.trim().takeIf(String::isNotEmpty) }
            .distinct()
            .takeIf { it.isNotEmpty() }
            ?.joinToString("; ")

    private fun Map<String, String>.valueFor(vararg keys: String): String? =
        keys.firstNotNullOfOrNull { key -> this[key]?.trim()?.takeIf(String::isNotEmpty) }

    private fun String.normalizedBriefingQuestion(): String =
        lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
}

object DailyRealityBriefingFormatter {
    fun voiceSummary(briefing: DailyRealityBriefing): String =
        "Project:\n" +
            "* commits: ${briefing.projectCommits ?: NOT_VERIFIED}\n" +
            "* builds: ${briefing.projectBuilds ?: NOT_VERIFIED}\n" +
            "* blockers: ${briefing.projectBlockers ?: NOT_VERIFIED}\n" +
            "* milestone progress: ${briefing.milestoneProgress ?: NOT_VERIFIED}\n\n" +
            "Personal:\n" +
            "* commitments: ${briefing.personalCommitments ?: NOT_VERIFIED}\n" +
            "* reminders: ${briefing.personalReminders ?: NOT_VERIFIED}\n" +
            "* pending items: ${briefing.personalPendingItems ?: NOT_VERIFIED}\n\n" +
            "Operator:\n" +
            "* next recommended action: ${briefing.operatorNextAction ?: NOT_VERIFIED}"

    private const val NOT_VERIFIED = "not verified"
}
