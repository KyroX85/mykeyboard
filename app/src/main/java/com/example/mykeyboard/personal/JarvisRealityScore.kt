package com.example.mykeyboard.personal

data class JarvisRealityScore(
    val realityPercent: Int,
    val factsUsed: Int,
    val snapshotFieldsUsed: List<String>,
    val founderBrainUsed: Boolean
)

object JarvisRealityScorer {
    fun score(
        route: JarvisRealityRoute,
        snapshot: ProjectSnapshot? = null,
        personalSnapshot: PersonalSnapshot? = null,
        agentSnapshot: AgentVisibilitySnapshot? = null
    ): JarvisRealityScore =
        when (route) {
            JarvisRealityRoute.AGENTS -> scoreAgentVisibility(agentSnapshot)
            JarvisRealityRoute.PROJECT -> scoreProject(snapshot)
            JarvisRealityRoute.PERSONAL -> scorePersonal(personalSnapshot)
            JarvisRealityRoute.REFLECTION -> JarvisRealityScore(
                realityPercent = REFLECTION_REALITY_PERCENT,
                factsUsed = 0,
                snapshotFieldsUsed = emptyList(),
                founderBrainUsed = true
            )
            JarvisRealityRoute.EXECUTION -> JarvisRealityScore(
                realityPercent = UNKNOWN_REALITY_PERCENT,
                factsUsed = 0,
                snapshotFieldsUsed = emptyList(),
                founderBrainUsed = false
            )
        }

    private fun scoreAgentVisibility(snapshot: AgentVisibilitySnapshot?): JarvisRealityScore {
        val fieldsUsed = snapshot?.usedFields().orEmpty()
        val realityPercent = if (fieldsUsed.isEmpty()) {
            UNKNOWN_REALITY_PERCENT
        } else {
            (BASE_PROJECT_REALITY_PERCENT + fieldsUsed.size * FIELD_WEIGHT_PERCENT)
                .coerceAtMost(MAX_REALITY_PERCENT)
        }
        return JarvisRealityScore(
            realityPercent = realityPercent,
            factsUsed = fieldsUsed.size,
            snapshotFieldsUsed = fieldsUsed,
            founderBrainUsed = false
        )
    }

    private fun scoreProject(snapshot: ProjectSnapshot?): JarvisRealityScore {
        val fieldsUsed = snapshot?.usedFields().orEmpty()
        val realityPercent = if (fieldsUsed.isEmpty()) {
            UNKNOWN_REALITY_PERCENT
        } else {
            (BASE_PROJECT_REALITY_PERCENT + fieldsUsed.size * FIELD_WEIGHT_PERCENT)
                .coerceAtMost(MAX_REALITY_PERCENT)
        }
        return JarvisRealityScore(
            realityPercent = realityPercent,
            factsUsed = fieldsUsed.size,
            snapshotFieldsUsed = fieldsUsed,
            founderBrainUsed = false
        )
    }

    private fun scorePersonal(snapshot: PersonalSnapshot?): JarvisRealityScore {
        val fieldsUsed = snapshot?.usedFields().orEmpty()
        val realityPercent = if (fieldsUsed.isEmpty()) {
            UNKNOWN_REALITY_PERCENT
        } else {
            (BASE_PROJECT_REALITY_PERCENT + fieldsUsed.size * FIELD_WEIGHT_PERCENT)
                .coerceAtMost(MAX_REALITY_PERCENT)
        }
        return JarvisRealityScore(
            realityPercent = realityPercent,
            factsUsed = fieldsUsed.size,
            snapshotFieldsUsed = fieldsUsed,
            founderBrainUsed = false
        )
    }

    private fun ProjectSnapshot.usedFields(): List<String> = buildList {
        if (currentPhase != null) add("current_phase")
        if (currentMilestone != null) add("current_milestone")
        if (lastSuccessfulBuild != null) add("last_successful_build")
        if (lastFailedBuild != null) add("last_failed_build")
        if (latestCommitMessage != null) add("latest_commit_message")
        if (commitsToday != null) add("commits_today")
        if (openBlockers != null) add("open_blockers")
        if (latestApkVersion != null) add("latest_apk_version")
        if (activeRuntimeModules != null) add("active_runtime_modules")
        if (latestCommit != null) add("latest_commit")
        if (latestBuild != null) add("latest_build")
        if (ciState != null) add("ci_state")
        if (knownBlockers != null) add("known_blockers")
        if (lastVerifiedTimestamp != null) add("last_verified_timestamp")
    }

    private fun PersonalSnapshot.usedFields(): List<String> = buildList {
        if (userEnteredSchedule != null) add("user_entered_schedule")
        if (classTimings != null) add("class_timings")
        if (badmintonTimings != null) add("badminton_timings")
        if (jeeTimings != null) add("jee_timings")
        if (homeworkTasks != null) add("homework_tasks")
        if (manualCommitments != null) add("manual_commitments")
        if (lastVerifiedTimestamp != null) add("last_verified_timestamp")
    }

    private fun AgentVisibilitySnapshot.usedFields(): List<String> = buildList {
        agents?.forEach { agent ->
            val prefix = agent.agentName.lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
            if (agent.currentTask != null) add("${prefix}_current_task")
            if (agent.lastAction != null) add("${prefix}_last_action")
            if (agent.lastSuccess != null) add("${prefix}_last_success")
            if (agent.lastFailure != null) add("${prefix}_last_failure")
            if (agent.waitingReason != null) add("${prefix}_waiting_reason")
            if (agent.nextAction != null) add("${prefix}_next_action")
        }
        if (lastVerifiedTimestamp != null) add("last_verified_timestamp")
    }

    private const val UNKNOWN_REALITY_PERCENT = 0
    private const val REFLECTION_REALITY_PERCENT = 10
    private const val BASE_PROJECT_REALITY_PERCENT = 40
    private const val FIELD_WEIGHT_PERCENT = 15
    private const val MAX_REALITY_PERCENT = 100
}
