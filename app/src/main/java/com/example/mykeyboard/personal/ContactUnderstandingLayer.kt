package com.example.mykeyboard.personal

import android.content.Context
import java.time.Instant
import java.util.Locale

data class ContactRelationship(
    val contactId: String,
    val displayName: String,
    val relationship: String,
    val aliases: List<String> = emptyList(),
    val confidence: Float,
    val lastVerified: String
) {
    fun matches(reference: String): Boolean {
        val normalized = reference.normalizedContactToken()
        return relationship.normalizedContactToken() == normalized ||
            aliases.any { it.normalizedContactToken() == normalized } ||
            displayName.normalizedContactToken() == normalized
    }
}

data class ContactLearning(
    val displayName: String,
    val relationship: String,
    val aliases: List<String> = emptyList()
)

sealed class ContactResolution {
    data class Known(val relationship: ContactRelationship) : ContactResolution()
    data class Unknown(val reference: String, val prompt: String) : ContactResolution()
    data class Ambiguous(val reference: String, val options: List<ContactRelationship>, val prompt: String) : ContactResolution()
    data class NotRelationship(val reference: String) : ContactResolution()
}

interface ContactRelationshipMemory {
    fun all(): List<ContactRelationship>
    fun save(relationship: ContactRelationship)
}

class InMemoryContactRelationshipMemory(
    initial: List<ContactRelationship> = emptyList()
) : ContactRelationshipMemory {
    private val relationships = initial.toMutableList()

    override fun all(): List<ContactRelationship> = relationships.toList()

    override fun save(relationship: ContactRelationship) {
        relationships.removeAll {
            it.relationship.normalizedContactToken() == relationship.relationship.normalizedContactToken()
        }
        relationships += relationship
    }
}

class SharedPreferencesContactRelationshipMemory(context: Context) : ContactRelationshipMemory {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun all(): List<ContactRelationship> =
        preferences.getStringSet(KEY_RELATIONSHIPS, emptySet())
            .orEmpty()
            .mapNotNull { it.toRelationshipOrNull() }

    override fun save(relationship: ContactRelationship) {
        val next = all()
            .filterNot {
                it.relationship.normalizedContactToken() == relationship.relationship.normalizedContactToken()
            }
            .plus(relationship)
            .map { it.serialize() }
            .toSet()
        preferences.edit().putStringSet(KEY_RELATIONSHIPS, next).apply()
    }

    private fun ContactRelationship.serialize(): String =
        listOf(
            contactId.encodeField(),
            displayName.encodeField(),
            relationship.encodeField(),
            aliases.joinToString(",").encodeField(),
            confidence.toString().encodeField(),
            lastVerified.encodeField()
        ).joinToString("|")

    private fun String.toRelationshipOrNull(): ContactRelationship? {
        val parts = split("|")
        if (parts.size != FIELD_COUNT) return null
        val confidence = parts[4].decodeField().toFloatOrNull() ?: return null
        return ContactRelationship(
            contactId = parts[0].decodeField(),
            displayName = parts[1].decodeField(),
            relationship = parts[2].decodeField(),
            aliases = parts[3].decodeField().split(",").mapNotNull { it.trim().takeIf(String::isNotEmpty) },
            confidence = confidence,
            lastVerified = parts[5].decodeField()
        )
    }

    private fun String.encodeField(): String =
        replace("%", "%25").replace("|", "%7C").replace(",", "%2C")

    private fun String.decodeField(): String =
        replace("%2C", ",").replace("%7C", "|").replace("%25", "%")

    private companion object {
        const val PREFERENCES_NAME = "jarvis_contact_relationships"
        const val KEY_RELATIONSHIPS = "relationships"
        const val FIELD_COUNT = 6
    }
}

object ContactUnderstandingLayer {
    fun resolve(reference: String, memory: ContactRelationshipMemory): ContactResolution {
        val trimmed = reference.trim()
        if (trimmed.isBlank()) {
            return ContactResolution.Unknown("", "Who is this contact to you?")
        }
        if (!isRelationshipReference(trimmed)) {
            return ContactResolution.NotRelationship(trimmed)
        }

        val matches = memory.all().filter { it.matches(trimmed) }
        return when (matches.size) {
            0 -> ContactResolution.Unknown(trimmed, "Who is $trimmed to you?")
            1 -> ContactResolution.Known(matches.first())
            else -> ContactResolution.Ambiguous(
                reference = trimmed,
                options = matches,
                prompt = "Which $trimmed do you mean?"
            )
        }
    }

    fun parseLearning(text: String): ContactLearning? {
        val normalized = text.trim()
        if (normalized.isBlank()) return null
        val match = LEARNING_PATTERNS.firstNotNullOfOrNull { pattern -> pattern.find(normalized) } ?: return null
        val name = match.groupValues.getOrNull(1).orEmpty().trim()
        val relationship = match.groupValues.getOrNull(2).orEmpty().trim()
        if (name.isBlank() || relationship.isBlank()) return null
        if (!isRelationshipReference(relationship)) return null
        return ContactLearning(
            displayName = name,
            relationship = relationship.normalizedContactToken(),
            aliases = relationshipAliases(relationship)
        )
    }

    fun createRelationship(learning: ContactLearning, now: Instant = Instant.now()): ContactRelationship =
        ContactRelationship(
            contactId = learning.displayName.normalizedContactToken(),
            displayName = learning.displayName,
            relationship = learning.relationship,
            aliases = learning.aliases,
            confidence = FOUNDER_CONFIRMED_CONFIDENCE,
            lastVerified = now.toString()
        )

    fun isRelationshipReference(value: String): Boolean {
        val normalized = value.normalizedContactToken()
        return RELATIONSHIP_KEYWORDS.contains(normalized) ||
            RELATIONSHIP_KEYWORDS.any { keyword -> normalized.endsWith(" $keyword") }
    }

    private fun relationshipAliases(relationship: String): List<String> =
        when (relationship.normalizedContactToken()) {
            "mom" -> listOf("mother", "amma")
            "dad" -> listOf("father", "appa")
            "best friend" -> listOf("bestfriend")
            else -> emptyList()
        }

    private val LEARNING_PATTERNS = listOf(
        Regex("^(.+?)\\s+is\\s+my\\s+(.+)$", RegexOption.IGNORE_CASE),
        Regex("^remember\\s+(.+?)\\s+as\\s+my\\s+(.+)$", RegexOption.IGNORE_CASE)
    )

    private val RELATIONSHIP_KEYWORDS = setOf(
        "mom",
        "mother",
        "amma",
        "dad",
        "father",
        "appa",
        "brother",
        "sister",
        "best friend",
        "bestfriend",
        "coach",
        "teacher",
        "sir",
        "madam"
    )

    private const val FOUNDER_CONFIRMED_CONFIDENCE = 0.95f
}

private fun String.normalizedContactToken(): String =
    lowercase(Locale.US)
        .replace(Regex("[^a-z0-9\\s]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
