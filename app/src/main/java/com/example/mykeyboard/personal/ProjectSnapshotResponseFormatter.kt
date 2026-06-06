package com.example.mykeyboard.personal

object ProjectSnapshotResponseFormatter {
    fun voiceSummary(snapshot: ProjectSnapshot): String {
        if (!snapshot.hasEvidence()) {
            return "I do not have enough verified project data yet."
        }

        val parts = buildList {
            snapshot.currentMilestone?.let { add("Milestone: $it") }
            snapshot.latestCommit?.let { add("Commit: ${it.take(COMMIT_CHARS)}") }
            snapshot.latestBuild?.let { add("Build: $it") }
            snapshot.ciState?.let { add("CI: $it") }
            snapshot.knownBlockers?.takeIf { it.isNotEmpty() }?.let { add("Blocker: ${it.first()}") }
        }

        return parts
            .take(MAX_VOICE_PARTS)
            .joinToString(". ")
            .ifBlank { "Project snapshot exists, but no useful fields are verified yet." }
            .take(MAX_VOICE_CHARS)
    }

    private const val COMMIT_CHARS = 10
    private const val MAX_VOICE_PARTS = 3
    private const val MAX_VOICE_CHARS = 220
}
