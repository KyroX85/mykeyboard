package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectSnapshotRuntimeTest {
    @Test
    fun blankBuildFieldsBecomeNullInsteadOfGuessedValues() {
        val snapshot = ProjectSnapshotRuntime.capture(
            FakeProjectSnapshotProvider(
                phase = "",
                milestone = "",
                latestCommit = "",
                latestCommitMessage = "",
                commitsToday = null,
                buildStatus = "",
                lastSuccessfulBuild = "",
                lastFailedBuild = "",
                ciState = "",
                knownBlockerList = null,
                openBlockers = null,
                runtimeModules = null,
                versionName = "",
                versionCode = 0,
                branch = "",
                buildVerifiedAt = ""
            )
        )

        assertNull(snapshot.currentPhase)
        assertNull(snapshot.currentMilestone)
        assertNull(snapshot.lastSuccessfulBuild)
        assertNull(snapshot.lastFailedBuild)
        assertNull(snapshot.latestCommitMessage)
        assertNull(snapshot.commitsToday)
        assertNull(snapshot.openBlockers)
        assertNull(snapshot.latestApkVersion)
        assertNull(snapshot.activeRuntimeModules)
        assertNull(snapshot.latestCommit)
        assertNull(snapshot.latestBuild)
        assertNull(snapshot.ciState)
        assertNull(snapshot.knownBlockers)
        assertNull(snapshot.branchState)
        assertNull(snapshot.lastVerifiedTimestamp)
    }

    @Test
    fun capturesOnlyExplicitProjectEvidence() {
        val snapshot = ProjectSnapshotRuntime.capture(
            FakeProjectSnapshotProvider(
                phase = "Phase 1 protected plus Phase 2 Explain active",
                milestone = "Jarvis reliability sprint",
                latestCommit = "abc1234",
                latestCommitMessage = "expand jarvis reality snapshot",
                commitsToday = 3,
                buildStatus = "local_debug_assembled",
                lastSuccessfulBuild = "Android CI #42",
                lastFailedBuild = "Product Lab #12",
                ciState = "in_progress",
                knownBlockerList = listOf("wake reliability", "transcript accuracy"),
                openBlockers = listOf("false wake rate", "transcript accuracy"),
                runtimeModules = listOf("JarvisWakeWordService", "FounderBrainConnector"),
                versionName = "1.0.7",
                versionCode = 7,
                branch = "## main...origin/main",
                buildVerifiedAt = "2026-06-06T10:00:00Z"
            )
        )

        assertEquals("Phase 1 protected plus Phase 2 Explain active", snapshot.currentPhase)
        assertEquals("Jarvis reliability sprint", snapshot.currentMilestone)
        assertEquals("Android CI #42", snapshot.lastSuccessfulBuild)
        assertEquals("Product Lab #12", snapshot.lastFailedBuild)
        assertEquals("expand jarvis reality snapshot", snapshot.latestCommitMessage)
        assertEquals(3, snapshot.commitsToday)
        assertEquals(listOf("false wake rate", "transcript accuracy"), snapshot.openBlockers)
        assertEquals("versionName=1.0.7; versionCode=7", snapshot.latestApkVersion)
        assertEquals(listOf("JarvisWakeWordService", "FounderBrainConnector"), snapshot.activeRuntimeModules)
        assertEquals("abc1234", snapshot.latestCommit)
        assertEquals("versionName=1.0.7; versionCode=7; status=local_debug_assembled", snapshot.latestBuild)
        assertEquals("in_progress", snapshot.ciState)
        assertEquals(listOf("wake reliability", "transcript accuracy"), snapshot.knownBlockers)
        assertEquals("## main...origin/main", snapshot.branchState)
        assertEquals("2026-06-06T10:00:00Z", snapshot.lastVerifiedTimestamp)
        assertTrue(snapshot.hasEvidence())
    }

    @Test
    fun providerMethodsExposeRequiredEvidenceSources() {
        val provider = FakeProjectSnapshotProvider(
            phase = "Phase 2 Explain active",
            milestone = "Project awareness connector",
            latestCommit = "abc1234",
            latestCommitMessage = "add project awareness connector",
            commitsToday = 2,
            buildStatus = "success",
            lastSuccessfulBuild = "Android CI #88",
            lastFailedBuild = "",
            ciState = "success",
            knownBlockerList = listOf("none"),
            openBlockers = listOf("remote CI still running"),
            runtimeModules = listOf("JarvisRealityAdapter"),
            versionName = "1.0.9",
            versionCode = 9,
            branch = "## main...origin/main",
            buildVerifiedAt = "2026-06-09T10:00:00Z"
        )

        assertEquals("add project awareness connector", provider.getLatestCommits().latestCommitMessage)
        assertEquals("Project awareness connector", provider.getCurrentMilestone())
        assertEquals(listOf("remote CI still running"), provider.getCurrentBlockers())
        assertEquals("versionName=1.0.9; versionCode=9; status=success", provider.getBuildStatus().latestBuild)
        assertEquals("## main...origin/main", provider.getBranchState())
    }

    private data class FakeProjectSnapshotProvider(
        val phase: String,
        val milestone: String,
        val latestCommit: String,
        val latestCommitMessage: String,
        val commitsToday: Int?,
        val buildStatus: String,
        val lastSuccessfulBuild: String,
        val lastFailedBuild: String,
        val ciState: String,
        val knownBlockerList: List<String>?,
        val openBlockers: List<String>?,
        val runtimeModules: List<String>?,
        val versionName: String,
        val versionCode: Int,
        val branch: String,
        val buildVerifiedAt: String
    ) : ProjectSnapshotProvider {
        override fun getLatestCommits(): ProjectCommitEvidence =
            ProjectCommitEvidence(
                latestCommit = latestCommit.nullIfBlank(),
                latestCommitMessage = latestCommitMessage.nullIfBlank(),
                commitsToday = commitsToday
            )

        override fun getCurrentPhase(): String? =
            phase.nullIfBlank()

        override fun getCurrentMilestone(): String? =
            milestone.nullIfBlank()

        override fun getCurrentBlockers(): List<String>? =
            openBlockers

        override fun getBuildStatus(): ProjectBuildEvidence {
            val latestApkVersion = buildList {
                versionName.nullIfBlank()?.let { add("versionName=$it") }
                versionCode.takeIf { it > 0 }?.let { add("versionCode=$it") }
            }.joinToString("; ").nullIfBlank()
            val latestBuild = buildList {
                latestApkVersion?.let { add(it) }
                buildStatus.nullIfBlank()?.let { add("status=$it") }
            }.joinToString("; ").nullIfBlank()
            return ProjectBuildEvidence(
                latestBuild = latestBuild,
                lastSuccessfulBuild = lastSuccessfulBuild.nullIfBlank(),
                lastFailedBuild = lastFailedBuild.nullIfBlank(),
                ciState = ciState.nullIfBlank(),
                latestApkVersion = latestApkVersion
            )
        }

        override fun getBranchState(): String? =
            branch.nullIfBlank()

        override fun getKnownBlockers(): List<String>? =
            knownBlockerList

        override fun getActiveRuntimeModules(): List<String>? =
            runtimeModules

        override fun getLastVerifiedTimestamp(): String? =
            buildVerifiedAt.nullIfBlank()
    }
}

private fun String.nullIfBlank(): String? =
    trim().takeIf { it.isNotEmpty() }
