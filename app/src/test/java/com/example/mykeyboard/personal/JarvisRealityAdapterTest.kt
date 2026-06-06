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
            "What am I building?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.PROJECT, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "PARTIAL_WITH_LIMITS", decision.safeResponseMode)
        }
    }

    @Test
    fun routesPersonalQuestionsToPersonalAwarenessFirst() {
        listOf(
            "What homework is pending?",
            "What should I focus on?",
            "How overloaded am I this week?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.PERSONAL, decision.route)
            assertTrue(question, decision.awarenessAttempted)
            assertEquals(question, "PARTIAL_WITH_LIMITS", decision.safeResponseMode)
        }
    }

    @Test
    fun routesReflectionQuestionsDirectlyToFounderBrain() {
        listOf(
            "Who am I becoming?",
            "What kills Aritenis?",
            "What contradiction do you see?"
        ).forEach { question ->
            val decision = JarvisRealityAdapter.classify(question)

            assertEquals(question, JarvisRealityRoute.REFLECTION, decision.route)
            assertFalse(question, decision.awarenessAttempted)
            assertEquals(question, "REFLECTION_ONLY", decision.safeResponseMode)
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
