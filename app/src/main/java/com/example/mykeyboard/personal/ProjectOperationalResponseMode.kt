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
            snapshot.latestCommit?.let { add("latest verified commit is ${it.take(COMMIT_CHARS)}") }
            snapshot.latestBuild?.let { add("latest build is $it") }
            snapshot.ciState?.let { add("CI is $it") }
        }
        if (facts.isEmpty()) return null
        return "Facts: ${facts.joinToString("; ")}"
    }

    private fun buildCurrentState(snapshot: ProjectSnapshot): String? =
        snapshot.currentMilestone?.let { "Current state: milestone is $it" }
            ?: snapshot.knownBlockers?.firstOrNull()?.let { "Current state: blocked by $it" }

    private fun buildNextAction(snapshot: ProjectSnapshot): String? =
        snapshot.knownBlockers?.firstOrNull()?.let { "Next action: clear $it" }
            ?: snapshot.currentMilestone?.let { "Next action: continue $it" }

    private const val COMMIT_CHARS = 10
    private const val MAX_VOICE_CHARS = 240
}
