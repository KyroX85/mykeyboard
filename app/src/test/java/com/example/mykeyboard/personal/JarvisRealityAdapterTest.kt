package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisRealityAdapterTest {
    @Test
    fun routesAgentVisibilityQuestionsToAgentSnapshotFirst() {
        listOf(
            "What are my agents doing?",
            "Are my agents alive?",
            "What is coder doing?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.AGENTS, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "INSUFFICIENT_DATA", decision.safeResponseMode)
            assertTrue(question, decision.agentVisibilitySnapshot != null)
            assertFalse(question, decision.realityScore.founderBrainUsed)
        }
    }

    @Test
    fun routesProjectQuestionsToProjectAwarenessFirst() {
        listOf(
            "What are you doing?",
            "What are you working on?",
            "What are we doing?",
            "What are we working on?",
            "What is next?",
            "What is the next action?",
            "What is our next milestone?",
            "What am I building?",
            "What is the build status?",
            "What are the latest commits?",
            "What is blocked?",
            "What is the current milestone?",
            "How is project progress?",
            "What progress was made?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.PROJECT, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "PARTIAL_WITH_LIMITS", decision.safeResponseMode)
            assertTrue(question, decision.projectSnapshot != null)
            assertFalse(question, decision.realityScore.founderBrainUsed)
        }
    }

    @Test
    fun routesTimelineQuestionsToRealityEventsFirst() {
        listOf(
            "What happened today?",
            "What happened yesterday?",
            "What changed this week?",
            "What changed today?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.TIMELINE, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "PARTIAL_WITH_LIMITS", decision.safeResponseMode)
            assertFalse(question, decision.realityScore.founderBrainUsed)
            assertTrue(question, decision.realityScore.snapshotFieldsUsed.contains("reality_event_timeline"))
        }
    }

    @Test
    fun routesOperatorQuestionsToPersonalOperatorDecisionLayer() {
        listOf(
            "What should I do now?",
            "What is pending?",
            "What is most important today?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.OPERATOR, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "PARTIAL_WITH_LIMITS", decision.safeResponseMode)
            assertFalse(question, decision.realityScore.founderBrainUsed)
            assertTrue(question, decision.realityScore.snapshotFieldsUsed.contains("personal_awareness"))
            assertTrue(question, decision.realityScore.snapshotFieldsUsed.contains("project_awareness"))
        }
    }

    @Test
    fun routesAgentProgressQuestionsToAgentVisibilityFirst() {
        val decision = JarvisRealityAdapter.classify("What did the agents do?")

        assertEquals(JarvisRealityRoute.AGENTS, decision.route)
        assertTrue(decision.awarenessAttempted)
        assertTrue(decision.agentVisibilitySnapshot != null)
        assertFalse(decision.realityScore.founderBrainUsed)
    }

    @Test
    fun routesPersonalQuestionsToPersonalAwarenessFirst() {
        listOf(
            "What homework is pending?",
            "What should I focus on?",
            "What classes are left?",
            "How overloaded am I this week?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.PERSONAL, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "INSUFFICIENT_DATA", decision.safeResponseMode)
            assertTrue(question, decision.personalSnapshot != null)
            assertFalse(question, decision.realityScore.founderBrainUsed)
        }
    }

    @Test
    fun routesReflectionQuestionsDirectlyToFounderBrain() {
        listOf(
            "Who am I becoming?",
            "What kills Aritenis?",
            "What contradiction do you see?",
            "What is our dream?",
            "What is the strategy?",
            "What tradeoff should I think about?",
            "What is my founder identity?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.REFLECTION, decision.route)
            assertFalse(question, decision.awarenessAttempted)
            assertEquals(question, "REFLECTION_ONLY", decision.safeResponseMode)
            assertTrue(question, decision.realityScore.founderBrainUsed)
            assertTrue(question, decision.realityScore.realityPercent <= 20)
        }
    }

    @Test
    fun routesExecutionQuestionsWithoutEnablingExecution() {
        val decision = JarvisRealityAdapter.classify("Fix this and commit it")

        assertEquals(JarvisRealityRoute.EXECUTION, decision.route)
        assertFalse(decision.awarenessAttempted)
        assertEquals("UNKNOWN", decision.truthStatus)
        assertEquals("INSUFFICIENT_DATA", decision.safeResponseMode)
    }

    @Test
    fun routesAllowedPhoneActionsToExecutionLayer() {
        listOf(
            "Call Mom",
            "Open app Instagram",
            "Send WhatsApp Rahul saying I will be late",
            "Open URL example.com",
            "Create reminder finish homework"
        ).forEach { command ->
            val decision = JarvisRealityAdapter.classify(command)

            assertEquals(command, JarvisRealityRoute.EXECUTION, decision.route)
            assertFalse(command, decision.awarenessAttempted)
            assertFalse(command, decision.realityScore.founderBrainUsed)
        }
    }
}
