package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisRealityAdapterTest {
    @Test
    fun routesProjectQuestionsToProjectAwarenessFirst() {
        listOf(
            "What happened today?",
            "What is our next milestone?",
            "What am I building?",
            "What is the build status?",
            "What are the latest commits?",
            "What is blocked?",
            "What is the current milestone?",
            "How is project progress?"
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
}
