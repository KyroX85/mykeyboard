package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class PersonalAwarenessMemoryTest {
    @Test
    fun learnsOnlyExplicitFounderPersonalFacts() {
        val result = PersonalAwarenessLearningLayer.learn(
            text = "remember homework math worksheet",
            now = Instant.parse("2026-06-09T10:00:00Z")
        )

        assertTrue(result is PersonalAwarenessLearningResult.Learned)
        val fact = (result as PersonalAwarenessLearningResult.Learned).fact
        assertEquals(PersonalAwarenessCategory.HOMEWORK, fact.category)
        assertEquals("math worksheet", fact.value)
        assertEquals("founder_voice_input", fact.evidenceSourceId)
        assertEquals("2026-06-09T10:00:00Z", fact.lastVerified)
    }

    @Test
    fun ignoresNonPersonalStatements() {
        val result = PersonalAwarenessLearningLayer.learn("what kills aritenis")

        assertTrue(result is PersonalAwarenessLearningResult.NotPersonalLearning)
    }

    @Test
    fun localFactsHydratePersonalSnapshotWithoutGuessing() {
        val facts = listOf(
            PersonalAwarenessFact(
                category = PersonalAwarenessCategory.HOMEWORK,
                value = "math worksheet",
                evidenceSourceId = "founder_voice_input",
                lastVerified = "2026-06-09T10:00:00Z"
            ),
            PersonalAwarenessFact(
                category = PersonalAwarenessCategory.CLASS_TIMING,
                value = "physics 2pm",
                evidenceSourceId = "founder_voice_input",
                lastVerified = "2026-06-09T11:00:00Z"
            )
        )

        val snapshot = PersonalSnapshot().withLocalFacts(facts)

        assertEquals(listOf("math worksheet"), snapshot.homeworkTasks)
        assertEquals(listOf("physics 2pm"), snapshot.classTimings)
        assertEquals("2026-06-09T11:00:00Z", snapshot.lastVerifiedTimestamp)
        assertEquals(
            "Pending today: homework: math worksheet.",
            PersonalSnapshotResponseFormatter.voiceSummary(snapshot, "What is pending today?")
        )
    }
}
