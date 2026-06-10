package com.example.mykeyboard.personal

import android.content.Context
import java.time.Instant
import java.util.UUID

enum class RealityEventType {
    BUILD_STARTED,
    BUILD_PASSED,
    BUILD_FAILED,
    COMMIT_CREATED,
    TASK_CREATED,
    TASK_COMPLETED,
    TASK_BLOCKED,
    REMINDER_CREATED,
    REMINDER_COMPLETED,
    CONTACT_LEARNED,
    PERSONAL_FACT_ADDED
}

enum class RealityEventSource {
    GITHUB_ACTIONS,
    LOCAL_GRADLE,
    LOCAL_GIT,
    JARVIS_VOICE,
    ANDROID_INTENT,
    FOUNDER_CONFIRMED
}

data class RealityEvent(
    val eventId: String,
    val eventType: RealityEventType,
    val timestamp: String,
    val source: RealityEventSource,
    val evidenceSource: String,
    val payload: Map<String, String>
)

interface RealityEventStore {
    fun append(event: RealityEvent)
    fun all(): List<RealityEvent>
}

class InMemoryRealityEventStore(
    initial: List<RealityEvent> = emptyList()
) : RealityEventStore {
    private val events = initial.toMutableList()

    override fun append(event: RealityEvent) {
        events += event
    }

    override fun all(): List<RealityEvent> = events.toList()
}

class SharedPreferencesRealityEventStore(context: Context) : RealityEventStore {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun append(event: RealityEvent) {
        val next = all().plus(event).map { it.serialize() }.toSet()
        preferences.edit().putStringSet(KEY_EVENTS, next).apply()
    }

    override fun all(): List<RealityEvent> =
        preferences.getStringSet(KEY_EVENTS, emptySet())
            .orEmpty()
            .mapNotNull { it.toRealityEventOrNull() }
            .sortedBy { it.timestamp }

    private fun RealityEvent.serialize(): String =
        listOf(
            eventId.encodeField(),
            eventType.name.encodeField(),
            timestamp.encodeField(),
            source.name.encodeField(),
            evidenceSource.encodeField(),
            payload.serializePayload().encodeField()
        ).joinToString("|")

    private fun String.toRealityEventOrNull(): RealityEvent? {
        val parts = split("|")
        if (parts.size != FIELD_COUNT) return null
        val eventType = runCatching { RealityEventType.valueOf(parts[1].decodeField()) }.getOrNull()
            ?: return null
        val source = runCatching { RealityEventSource.valueOf(parts[3].decodeField()) }.getOrNull()
            ?: return null
        return RealityEvent(
            eventId = parts[0].decodeField(),
            eventType = eventType,
            timestamp = parts[2].decodeField(),
            source = source,
            evidenceSource = parts[4].decodeField(),
            payload = parts[5].decodeField().deserializePayload()
        )
    }

    private fun Map<String, String>.serializePayload(): String =
        entries.joinToString(";") { (key, value) -> "${key.encodePayload()}=${value.encodePayload()}" }

    private fun String.deserializePayload(): Map<String, String> =
        split(";")
            .mapNotNull { entry ->
                if (entry.isBlank()) return@mapNotNull null
                val key = entry.substringBefore("=", "").decodePayload()
                val value = entry.substringAfter("=", "").decodePayload()
                if (key.isBlank()) null else key to value
            }
            .toMap()

    private fun String.encodePayload(): String =
        replace("%", "%25").replace("=", "%3D").replace(";", "%3B")

    private fun String.decodePayload(): String =
        replace("%3B", ";").replace("%3D", "=").replace("%25", "%")

    private fun String.encodeField(): String =
        replace("%", "%25").replace("|", "%7C")

    private fun String.decodeField(): String =
        replace("%7C", "|").replace("%25", "%")

    private companion object {
        const val PREFERENCES_NAME = "jarvis_reality_events"
        const val KEY_EVENTS = "events"
        const val FIELD_COUNT = 6
    }
}

object RealityEventEngine {
    fun append(
        store: RealityEventStore,
        eventType: RealityEventType,
        source: RealityEventSource,
        evidenceSource: String,
        payload: Map<String, String>,
        timestamp: Instant = Instant.now(),
        eventId: String = UUID.randomUUID().toString()
    ): RealityEvent {
        require(evidenceSource.isNotBlank()) { "Reality events require evidence_source." }
        require(payload.values.none { value -> value.contains("AI_GENERATED", ignoreCase = true) }) {
            "Reality events cannot be AI-generated."
        }
        val event = RealityEvent(
            eventId = eventId,
            eventType = eventType,
            timestamp = timestamp.toString(),
            source = source,
            evidenceSource = evidenceSource,
            payload = payload.filterValues { it.isNotBlank() }
        )
        store.append(event)
        return event
    }

    fun contactLearned(
        store: RealityEventStore,
        sessionId: String,
        relationship: ContactRelationship,
        timestamp: Instant = Instant.now()
    ): RealityEvent =
        append(
            store = store,
            eventType = RealityEventType.CONTACT_LEARNED,
            source = RealityEventSource.FOUNDER_CONFIRMED,
            evidenceSource = "jarvis_voice_session:$sessionId",
            payload = mapOf(
                "contact_id" to relationship.contactId,
                "relationship" to relationship.relationship,
                "confidence" to relationship.confidence.toString(),
                "last_verified" to relationship.lastVerified
            ),
            timestamp = timestamp
        )

    fun personalFactAdded(
        store: RealityEventStore,
        sessionId: String,
        fact: PersonalAwarenessFact,
        timestamp: Instant = Instant.now()
    ): RealityEvent =
        append(
            store = store,
            eventType = RealityEventType.PERSONAL_FACT_ADDED,
            source = RealityEventSource.FOUNDER_CONFIRMED,
            evidenceSource = "jarvis_voice_session:$sessionId",
            payload = mapOf(
                "category" to fact.category.name,
                "evidence_source_id" to fact.evidenceSourceId,
                "last_verified" to fact.lastVerified
            ),
            timestamp = timestamp
        )
}
