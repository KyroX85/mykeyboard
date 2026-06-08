package com.example.mykeyboard.personal

import com.example.mykeyboard.BuildConfig

data class ProjectSnapshot(
    val currentPhase: String? = null,
    val currentMilestone: String? = null,
    val lastSuccessfulBuild: String? = null,
    val lastFailedBuild: String? = null,
    val latestCommitMessage: String? = null,
    val commitsToday: Int? = null,
    val openBlockers: List<String>? = null,
    val latestApkVersion: String? = null,
    val activeRuntimeModules: List<String>? = null,
    val latestCommit: String? = null,
    val latestBuild: String? = null,
    val ciState: String? = null,
    val knownBlockers: List<String>? = null,
    val lastVerifiedTimestamp: String? = null
) {
    fun missingFields(): List<String> = buildList {
        if (currentPhase == null) add("current_phase")
        if (currentMilestone == null) add("current_milestone")
        if (lastSuccessfulBuild == null) add("last_successful_build")
        if (lastFailedBuild == null) add("last_failed_build")
        if (latestCommitMessage == null) add("latest_commit_message")
        if (commitsToday == null) add("commits_today")
        if (openBlockers == null) add("open_blockers")
        if (latestApkVersion == null) add("latest_apk_version")
        if (activeRuntimeModules == null) add("active_runtime_modules")
        if (latestCommit == null) add("latest_commit")
        if (latestBuild == null) add("latest_build")
        if (ciState == null) add("ci_state")
        if (knownBlockers == null) add("known_blockers")
        if (lastVerifiedTimestamp == null) add("last_verified_timestamp")
    }

    fun hasEvidence(): Boolean =
        listOf(
            currentPhase,
            currentMilestone,
            lastSuccessfulBuild,
            lastFailedBuild,
            latestCommitMessage,
            latestCommit,
            latestBuild,
            ciState,
            latestApkVersion,
            lastVerifiedTimestamp
        ).any { it != null } ||
            commitsToday != null ||
            openBlockers != null ||
            activeRuntimeModules != null ||
            knownBlockers != null
}

interface ProjectSnapshotBuildInfo {
    val currentPhase: String
    val currentMilestone: String
    val latestCommit: String
    val latestCommitMessage: String
    val commitsToday: String
    val buildStatus: String
    val lastSuccessfulBuild: String
    val lastFailedBuild: String
    val ciState: String
    val knownBlockers: String
    val openBlockers: String
    val activeRuntimeModules: String
    val versionName: String
    val versionCode: Int
    val buildVerifiedAt: String
}

object ProjectSnapshotRuntime {
    fun capture(buildInfo: ProjectSnapshotBuildInfo = BuildConfigProjectSnapshotBuildInfo): ProjectSnapshot {
        val latestApkVersion = buildList {
            buildInfo.versionName.nullIfBlank()?.let { add("versionName=$it") }
            buildInfo.versionCode.takeIf { it > 0 }?.let { add("versionCode=$it") }
        }.joinToString("; ").nullIfBlank()

        val latestBuild = buildList {
            latestApkVersion?.let { add(it) }
            buildInfo.buildStatus.nullIfBlank()?.let { add("status=$it") }
        }.joinToString("; ").nullIfBlank()

        return ProjectSnapshot(
            currentPhase = buildInfo.currentPhase.nullIfBlank(),
            currentMilestone = buildInfo.currentMilestone.nullIfBlank(),
            lastSuccessfulBuild = buildInfo.lastSuccessfulBuild.nullIfBlank(),
            lastFailedBuild = buildInfo.lastFailedBuild.nullIfBlank(),
            latestCommitMessage = buildInfo.latestCommitMessage.nullIfBlank(),
            commitsToday = buildInfo.commitsToday.toPositiveOrZeroInt(),
            openBlockers = buildInfo.openBlockers.toSnapshotList(),
            latestApkVersion = latestApkVersion,
            activeRuntimeModules = buildInfo.activeRuntimeModules.toSnapshotList(),
            latestCommit = buildInfo.latestCommit.nullIfBlank(),
            latestBuild = latestBuild,
            ciState = buildInfo.ciState.nullIfBlank(),
            knownBlockers = buildInfo.knownBlockers.toSnapshotList(),
            lastVerifiedTimestamp = buildInfo.buildVerifiedAt.nullIfBlank()
        )
    }
}

private object BuildConfigProjectSnapshotBuildInfo : ProjectSnapshotBuildInfo {
    override val currentPhase: String = BuildConfig.PROJECT_CURRENT_PHASE
    override val currentMilestone: String = BuildConfig.PROJECT_CURRENT_MILESTONE
    override val latestCommit: String = BuildConfig.PROJECT_LATEST_COMMIT
    override val latestCommitMessage: String = BuildConfig.PROJECT_LATEST_COMMIT_MESSAGE
    override val commitsToday: String = BuildConfig.PROJECT_COMMITS_TODAY
    override val buildStatus: String = BuildConfig.PROJECT_BUILD_STATUS
    override val lastSuccessfulBuild: String = BuildConfig.PROJECT_LAST_SUCCESSFUL_BUILD
    override val lastFailedBuild: String = BuildConfig.PROJECT_LAST_FAILED_BUILD
    override val ciState: String = BuildConfig.PROJECT_CI_STATE
    override val knownBlockers: String = BuildConfig.PROJECT_KNOWN_BLOCKERS
    override val openBlockers: String = BuildConfig.PROJECT_OPEN_BLOCKERS
    override val activeRuntimeModules: String = BuildConfig.PROJECT_ACTIVE_RUNTIME_MODULES
    override val versionName: String = BuildConfig.VERSION_NAME
    override val versionCode: Int = BuildConfig.VERSION_CODE
    override val buildVerifiedAt: String = BuildConfig.PROJECT_BUILD_VERIFIED_AT
}

private fun String.nullIfBlank(): String? =
    trim().takeIf { it.isNotEmpty() }

private fun String.toSnapshotList(): List<String>? =
    split("|", ";")
        .mapNotNull { it.nullIfBlank() }
        .takeIf { it.isNotEmpty() }

private fun String.toPositiveOrZeroInt(): Int? =
    trim().toIntOrNull()?.takeIf { it >= 0 }
