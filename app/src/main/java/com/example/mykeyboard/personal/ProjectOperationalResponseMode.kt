package com.example.mykeyboard.personal

object ProjectOperationalResponseMode {
    fun buildAnswer(snapshot: ProjectSnapshot): String {
        if (!snapshot.hasEvidence()) {
            return "I do not have enough verified project data yet."
        }

        val facts = buildFacts(snapshot)
        val currentState = buildCurrentState(snapshot)
        val nextAction = buildNextAction(snapshot)

        return listOfNotNull(facts, currentState, nextAction)
            .joinToString(". ")
            .take(MAX_VOICE_CHARS)
    }

    private fun buildFacts(snapshot: ProjectSnapshot): String? {
        val facts = buildList {
            snapshot.commitsToday?.let { add("commits today: $it") }
            snapshot.latestCommitMessage?.let { add("latest commit: $it") }
            snapshot.latestCommit?.let { add("commit sha: ${it.take(COMMIT_CHARS)}") }
            snapshot.latestApkVersion?.let { add("APK $it") }
            snapshot.lastSuccessfulBuild?.let { add("last successful build: $it") }
            snapshot.lastFailedBuild?.let { add("last failed build: $it") }
            snapshot.ciState?.let { add("CI is $it") }
        }
        if (facts.isEmpty()) return null
        return "Facts: ${facts.joinToString("; ")}"
    }

    private fun buildCurrentState(snapshot: ProjectSnapshot): String? {
        val currentState = buildList {
            snapshot.currentPhase?.let { add("phase is $it") }
            snapshot.currentMilestone?.let { add("milestone is $it") }
            snapshot.openBlockers?.firstOrNull()?.let { add("blocked by $it") }
            snapshot.activeRuntimeModules?.takeIf { it.isNotEmpty() }?.let {
                add("active modules: ${it.joinToString(", ")}")
            }
        }
        if (currentState.isEmpty()) return null
        return "Current state: ${currentState.joinToString("; ")}"
    }

    private fun buildNextAction(snapshot: ProjectSnapshot): String? =
        snapshot.openBlockers?.firstOrNull()?.let { "Next action: clear $it" }
            ?: snapshot.knownBlockers?.firstOrNull()?.let { "Next action: clear $it" }
            ?: snapshot.currentMilestone?.let { "Next action: continue $it" }

    private const val COMMIT_CHARS = 10
    private const val MAX_VOICE_CHARS = 320
}
