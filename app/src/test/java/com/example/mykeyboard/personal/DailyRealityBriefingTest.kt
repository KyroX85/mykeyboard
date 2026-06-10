package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DailyRealityBriefingTest {
    @Test
    fun createsBriefingFromEvidenceOnly() {
        val events = listOf(
            event(
                id = "commit",
                type = RealityEventType.COMMIT_CREATED,
                payload = mapOf("commit_message" to "feat: add jarvis reality timeline")
            ),
            event(
                id = "build",
                type = RealityEventType.BUILD_PASSED,
                payload = mapOf("summary" to "debug APK assembled")
            ),
            event(
                id = "blocked",
                type = RealityEventType.TASK_BLOCKED,
                payload = mapOf("blocker" to "remote APK distribution failed")
            ),
            event(
                id = "reminder",
                type = RealityEventType.REMINDER_CREATED,
                payload = mapOf("title" to "submit assignment")
            )
        )
        val realitySnapshot = RealitySnapshotGenerator.generate(events)
        val personalSnapshot = PersonalSnapshot(
            homeworkTasks = listOf("physics notes"),
            manualCommitments = listOf("sleep by 10pm")
        )
        val projectSnapshot = ProjectSnapshot(currentMilestone = "personal operator")
        val operatorDecision = PersonalOperatorDecisionLayer.decide(
            realitySnapshot = realitySnapshot,
            personalSnapshot = personalSnapshot,
            projectSnapshot = projectSnapshot
        )

        val briefing = DailyRealityBriefingProvider.create(
            todayEvents = events,
            realitySnapshot = realitySnapshot,
            personalSnapshot = personalSnapshot,
            projectSnapshot = projectSnapshot,
            operatorDecision = operatorDecision
        )

        assertEquals("feat: add jarvis reality timeline", briefing.projectCommits)
        assertEquals("debug APK assembled", briefing.projectBuilds)
        assertEquals("remote APK distribution failed", briefing.projectBlockers)
        assertEquals("personal operator", briefing.milestoneProgress)
        assertEquals("sleep by 10pm", briefing.personalCommitments)
        assertEquals("submit assignment", briefing.personalReminders)
        assertEquals("physics notes", briefing.personalPendingItems)
        assertEquals("Resolve blocker: remote APK distribution failed", briefing.operatorNextAction)
    }

    @Test
    fun formatsRequiredSectionsWithNotVerifiedForMissingEvidence() {
        val speech = DailyRealityBriefingFormatter.voiceSummary(
            DailyRealityBriefingProvider.create(
                todayEvents = emptyList(),
                realitySnapshot = RealitySnapshot(),
                personalSnapshot = PersonalSnapshot(),
                projectSnapshot = ProjectSnapshot(),
                operatorDecision = PersonalOperatorDecision(emptyList(), null, null)
            )
        )

        assertEquals(
            "Project:\n" +
                "* commits: not verified\n" +
                "* builds: not verified\n" +
                "* blockers: not verified\n" +
                "* milestone progress: not verified\n\n" +
                "Personal:\n" +
                "* commitments: not verified\n" +
                "* reminders: not verified\n" +
                "* pending items: not verified\n\n" +
                "Operator:\n" +
                "* next recommended action: not verified",
            speech
        )
        assertFalse(speech.contains("Founder Brain", ignoreCase = true))
        assertFalse(speech.contains("probably", ignoreCase = true))
    }

    @Test
    fun classifiesDailyBriefingQuestion() {
        assertTrue(DailyRealityBriefingProvider.isBriefingQuestion("What happened today?"))
        assertTrue(DailyRealityBriefingProvider.isBriefingQuestion("Daily reality briefing"))
        assertFalse(DailyRealityBriefingProvider.isBriefingQuestion("What happened yesterday?"))
    }

    private fun event(
        id: String,
        type: RealityEventType,
        payload: Map<String, String>
    ): RealityEvent =
        RealityEvent(
            eventId = id,
            eventType = type,
            timestamp = "2026-06-10T08:00:00Z",
            source = RealityEventSource.LOCAL_GIT,
            evidenceSource = "test:$id",
            payload = payload
        )
}
