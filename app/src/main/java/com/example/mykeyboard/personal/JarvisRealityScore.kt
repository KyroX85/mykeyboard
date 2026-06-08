package com.example.mykeyboard.personal

data class JarvisRealityScore(
    val realityPercent: Int,
    val factsUsed: Int,
    val snapshotFieldsUsed: List<String>,
    val founderBrainUsed: Boolean
)

object JarvisRealityScorer {
    fun score(route: JarvisRealityRoute, snapshot: ProjectSnapshot? = null): JarvisRealityScore =
        when (route) {
            JarvisRealityRoute.PROJECT -> scoreProject(snapshot)
            JarvisRealityRoute.REFLECTION -> JarvisRealityScore(
                realityPercent = REFLECTION_REALITY_PERCENT,
                factsUsed = 0,
                snapshotFieldsUsed = emptyList(),
                founderBrainUsed = true
            )
            JarvisRealityRoute.PERSONAL,
            JarvisRealityRoute.EXECUTION -> JarvisRealityScore(
                realityPercent = UNKNOWN_REALITY_PERCENT,
                factsUsed = 0,
                snapshotFieldsUsed = emptyList(),
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

    private const val UNKNOWN_REALITY_PERCENT = 0
    private const val REFLECTION_REALITY_PERCENT = 10
    private const val BASE_PROJECT_REALITY_PERCENT = 40
    private const val FIELD_WEIGHT_PERCENT = 15
    private const val MAX_REALITY_PERCENT = 100
}
