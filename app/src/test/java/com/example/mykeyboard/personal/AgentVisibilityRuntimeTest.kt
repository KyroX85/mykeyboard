package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AgentVisibilityRuntimeTest {
    @Test
    fun blankAgentVisibilityBecomesUnknownInsteadOfInvented() {
        val snapshot = AgentVisibilityRuntime.capture(
            FakeAgentVisibilityBuildInfo(
                agentVisibilityJson = "",
                agentVisibilityVerifiedAt = ""
            )
        )

        assertNull(snapshot.agents)
        assertNull(snapshot.lastVerifiedTimestamp)
        assertFalse(snapshot.hasEvidence())
        assertEquals("I do not have verified agent visibility yet.", AgentVisibilityResponseFormatter.voiceSummary(snapshot))
    }

    @Test
    fun parsesEvidenceBackedAgentVisibilityJson() {
        val snapshot = AgentVisibilityRuntime.capture(
            FakeAgentVisibilityBuildInfo(
                agentVisibilityJson = """
                    [
                      {
                        "agentName": "Coder",
                        "current_task": "stabilize Jarvis command capture",
                        "last_action": "ran focused unit tests",
                        "last_success": "compileDebugKotlin passed",
                        "last_failure": "remote APK workflow failed",
                        "waiting_reason": "GitHub job logs unavailable",
                        "next_action": "inspect CI logs"
                      }
                    ]
                """.trimIndent(),
                agentVisibilityVerifiedAt = "2026-06-08T12:00:00Z"
            )
        )

        val agent = snapshot.agents?.single()
        assertEquals("Coder", agent?.agentName)
        assertEquals("stabilize Jarvis command capture", agent?.currentTask)
        assertEquals("ran focused unit tests", agent?.lastAction)
        assertEquals("compileDebugKotlin passed", agent?.lastSuccess)
        assertEquals("remote APK workflow failed", agent?.lastFailure)
        assertEquals("GitHub job logs unavailable", agent?.waitingReason)
        assertEquals("inspect CI logs", agent?.nextAction)
        assertEquals("2026-06-08T12:00:00Z", snapshot.lastVerifiedTimestamp)
        assertTrue(snapshot.hasEvidence())
    }

    @Test
    fun formatsAgentNameCurrentTaskProgressAndBlocker() {
        val speech = AgentVisibilityResponseFormatter.voiceSummary(
            AgentVisibilitySnapshot(
                agents = listOf(
                    AgentVisibilityEntry(
                        agentName = "Reviewer",
                        currentTask = "review Jarvis runtime",
                        lastAction = "checked route tests",
                        lastSuccess = "guardrails passed",
                        waitingReason = "waiting for device test",
                        nextAction = "verify on phone"
                    )
                )
            )
        )

        assertTrue(speech.contains("Reviewer"))
        assertTrue(speech.contains("current task: review Jarvis runtime"))
        assertTrue(speech.contains("progress: guardrails passed"))
        assertTrue(speech.contains("blocker: waiting for device test"))
        assertTrue(speech.contains("next: verify on phone"))
    }

    @Test
    fun invalidJsonIsReportedAsMissingEvidence() {
        val snapshot = AgentVisibilityRuntime.capture(
            FakeAgentVisibilityBuildInfo(
                agentVisibilityJson = "{bad",
                agentVisibilityVerifiedAt = ""
            )
        )

        assertNull(snapshot.agents)
        assertTrue(snapshot.parseFailure != null)
        assertFalse(snapshot.hasEvidence())
    }

    private data class FakeAgentVisibilityBuildInfo(
        override val agentVisibilityJson: String,
        override val agentVisibilityVerifiedAt: String
    ) : AgentVisibilityBuildInfo
}
