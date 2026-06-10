package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class RealityEventEngineTest {
    @Test
    fun appendsEvidenceBackedRealityEvent() {
        val store = InMemoryRealityEventStore()

        val event = RealityEventEngine.append(
            store = store,
            eventType = RealityEventType.BUILD_PASSED,
            source = RealityEventSource.LOCAL_GRADLE,
            evidenceSource = "gradle::app:assembleDebug",
            payload = mapOf("task" to ":app:assembleDebug", "result" to "passed"),
            timestamp = Instant.parse("2026-06-10T10:00:00Z"),
            eventId = "event-1"
        )

        assertEquals("event-1", event.eventId)
        assertEquals(RealityEventType.BUILD_PASSED, event.eventType)
        assertEquals("2026-06-10T10:00:00Z", event.timestamp)
        assertEquals("gradle::app:assembleDebug", event.evidenceSource)
        assertEquals(listOf(event), store.all())
    }

    @Test
    fun rejectsEventsWithoutEvidence() {
        val store = InMemoryRealityEventStore()

        assertThrows(IllegalArgumentException::class.java) {
            RealityEventEngine.append(
                store = store,
                eventType = RealityEventType.TASK_COMPLETED,
                source = RealityEventSource.JARVIS_VOICE,
                evidenceSource = "",
                payload = mapOf("task" to "homework")
            )
        }

        assertTrue(store.all().isEmpty())
    }

    @Test
    fun rejectsAiGeneratedEvents() {
        val store = InMemoryRealityEventStore()

        assertThrows(IllegalArgumentException::class.java) {
            RealityEventEngine.append(
                store = store,
                eventType = RealityEventType.TASK_COMPLETED,
                source = RealityEventSource.JARVIS_VOICE,
                evidenceSource = "jarvis_voice_session:test",
                payload = mapOf("origin" to "AI_GENERATED")
            )
        }

        assertTrue(store.all().isEmpty())
    }

    @Test
    fun contactLearningCreatesFounderConfirmedRealityEvent() {
        val store = InMemoryRealityEventStore()
        val relationship = ContactRelationship(
            contactId = "anitha",
            displayName = "Anitha",
            relationship = "mom",
            confidence = 0.95f,
            lastVerified = "2026-06-10T10:00:00Z"
        )

        val event = RealityEventEngine.contactLearned(
            store = store,
            sessionId = "session-123",
            relationship = relationship,
            timestamp = Instant.parse("2026-06-10T10:01:00Z")
        )

        assertEquals(RealityEventType.CONTACT_LEARNED, event.eventType)
        assertEquals(RealityEventSource.FOUNDER_CONFIRMED, event.source)
        assertEquals("jarvis_voice_session:session-123", event.evidenceSource)
        assertEquals("mom", event.payload["relationship"])
        assertEquals("anitha", event.payload["contact_id"])
    }

    @Test
    fun personalFactCreatesFounderConfirmedRealityEventWithoutRawFactValue() {
        val store = InMemoryRealityEventStore()
        val fact = PersonalAwarenessFact(
            category = PersonalAwarenessCategory.HOMEWORK,
            value = "math worksheet",
            evidenceSourceId = "founder_voice_input",
            lastVerified = "2026-06-10T10:00:00Z"
        )

        val event = RealityEventEngine.personalFactAdded(
            store = store,
            sessionId = "session-123",
            fact = fact,
            timestamp = Instant.parse("2026-06-10T10:01:00Z")
        )

        assertEquals(RealityEventType.PERSONAL_FACT_ADDED, event.eventType)
        assertEquals(RealityEventSource.FOUNDER_CONFIRMED, event.source)
        assertEquals("jarvis_voice_session:session-123", event.evidenceSource)
        assertEquals("HOMEWORK", event.payload["category"])
        assertEquals("founder_voice_input", event.payload["evidence_source_id"])
        assertTrue(event.payload.values.none { it == "math worksheet" })
    }
}
