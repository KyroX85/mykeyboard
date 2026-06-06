package com.example.mykeyboard.personal

import com.example.mykeyboard.BuildConfig

data class ProjectSnapshot(
    val currentMilestone: String?,
    val latestCommit: String?,
    val latestBuild: String?,
    val ciState: String?,
    val knownBlockers: List<String>?,
    val lastVerifiedTimestamp: String?
) {
    fun missingFields(): List<String> = buildList {
        if (currentMilestone == null) add("current_milestone")
        if (latestCommit == null) add("latest_commit")
        if (latestBuild == null) add("latest_build")
        if (ciState == null) add("ci_state")
        if (knownBlockers == null) add("known_blockers")
        if (lastVerifiedTimestamp == null) add("last_verified_timestamp")
    }

    fun hasEvidence(): Boolean =
        listOf(
            currentMilestone,
            latestCommit,
            latestBuild,
            ciState,
            lastVerifiedTimestamp
        ).any { it != null } || knownBlockers != null
}

interface ProjectSnapshotBuildInfo {
    val currentMilestone: String
    val latestCommit: String
    val buildStatus: String
    val ciState: String
    val knownBlockers: String
    val versionName: String
    val versionCode: Int
    val buildVerifiedAt: String
}

object ProjectSnapshotRuntime {
    fun capture(buildInfo: ProjectSnapshotBuildInfo = BuildConfigProjectSnapshotBuildInfo): ProjectSnapshot {
        val latestBuild = buildList {
            buildInfo.versionName.nullIfBlank()?.let { add("versionName=$it") }
            buildInfo.versionCode.takeIf { it > 0 }?.let { add("versionCode=$it") }
            buildInfo.buildStatus.nullIfBlank()?.let { add("status=$it") }
        }.joinToString("; ").nullIfBlank()

        return ProjectSnapshot(
            currentMilestone = buildInfo.currentMilestone.nullIfBlank(),
            latestCommit = buildInfo.latestCommit.nullIfBlank(),
            latestBuild = latestBuild,
            ciState = buildInfo.ciState.nullIfBlank(),
            knownBlockers = buildInfo.knownBlockers.toKnownBlockers(),
            lastVerifiedTimestamp = buildInfo.buildVerifiedAt.nullIfBlank()
        )
    }
}

private object BuildConfigProjectSnapshotBuildInfo : ProjectSnapshotBuildInfo {
    override val currentMilestone: String = BuildConfig.PROJECT_CURRENT_MILESTONE
    override val latestCommit: String = BuildConfig.PROJECT_LATEST_COMMIT
    override val buildStatus: String = BuildConfig.PROJECT_BUILD_STATUS
    override val ciState: String = BuildConfig.PROJECT_CI_STATE
    override val knownBlockers: String = BuildConfig.PROJECT_KNOWN_BLOCKERS
    override val versionName: String = BuildConfig.VERSION_NAME
    override val versionCode: Int = BuildConfig.VERSION_CODE
    override val buildVerifiedAt: String = BuildConfig.PROJECT_BUILD_VERIFIED_AT
}

private fun String.nullIfBlank(): String? =
    trim().takeIf { it.isNotEmpty() }

private fun String.toKnownBlockers(): List<String>? =
    split("|", ";")
        .mapNotNull { it.nullIfBlank() }
        .takeIf { it.isNotEmpty() }
