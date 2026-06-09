package com.example.mykeyboard.personal

import android.content.Context
import java.time.Instant
import java.util.Locale

enum class PersonalAwarenessCategory {
    SCHEDULE,
    CLASS_TIMING,
    BADMINTON,
    JEE,
    HOMEWORK,
    COMMITMENT
}

data class PersonalAwarenessFact(
    val category: PersonalAwarenessCategory,
    val value: String,
    val evidenceSourceId: String,
    val lastVerified: String
)

sealed class PersonalAwarenessLearningResult {
    data class Learned(val fact: PersonalAwarenessFact, val speech: String) : PersonalAwarenessLearningResult()
    data object NotPersonalLearning : PersonalAwarenessLearningResult()
    data class NeedsClarification(val speech: String) : PersonalAwarenessLearningResult()
}

interface PersonalAwarenessMemory {
    fun all(): List<PersonalAwarenessFact>
    fun save(fact: PersonalAwarenessFact)
}

class InMemoryPersonalAwarenessMemory(
    initial: List<PersonalAwarenessFact> = emptyList()
) : PersonalAwarenessMemory {
    private val facts = initial.toMutableList()

    override fun all(): List<PersonalAwarenessFact> = facts.toList()

    override fun save(fact: PersonalAwarenessFact) {
        facts += fact
    }
}

class SharedPreferencesPersonalAwarenessMemory(context: Context) : PersonalAwarenessMemory {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun all(): List<PersonalAwarenessFact> =
        preferences.getStringSet(KEY_FACTS, emptySet())
            .orEmpty()
            .mapNotNull { it.toFactOrNull() }

    override fun save(fact: PersonalAwarenessFact) {
        preferences.edit()
            .putStringSet(KEY_FACTS, all().plus(fact).map { it.serialize() }.toSet())
            .apply()
    }

    private fun PersonalAwarenessFact.serialize(): String =
        listOf(
            category.name.encodeField(),
            value.encodeField(),
            evidenceSourceId.encodeField(),
            lastVerified.encodeField()
        ).joinToString("|")

    private fun String.toFactOrNull(): PersonalAwarenessFact? {
        val parts = split("|")
        if (parts.size != FIELD_COUNT) return null
        val category = runCatching { PersonalAwarenessCategory.valueOf(parts[0].decodeField()) }.getOrNull()
            ?: return null
        return PersonalAwarenessFact(
            category = category,
            value = parts[1].decodeField(),
            evidenceSourceId = parts[2].decodeField(),
            lastVerified = parts[3].decodeField()
        )
    }

    private fun String.encodeField(): String =
        replace("%", "%25").replace("|", "%7C")

    private fun String.decodeField(): String =
        replace("%7C", "|").replace("%25", "%")

    private companion object {
        const val PREFERENCES_NAME = "jarvis_personal_awareness"
        const val KEY_FACTS = "facts"
        const val FIELD_COUNT = 4
    }
}

object PersonalAwarenessLearningLayer {
    fun learn(text: String, now: Instant = Instant.now()): PersonalAwarenessLearningResult {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return PersonalAwarenessLearningResult.NotPersonalLearning

        val category = categoryFor(trimmed) ?: return PersonalAwarenessLearningResult.NotPersonalLearning
        val value = extractValue(trimmed, category)
        if (value.isBlank()) {
            return PersonalAwarenessLearningResult.NeedsClarification("What should I remember?")
        }
        val fact = PersonalAwarenessFact(
            category = category,
            value = value,
            evidenceSourceId = "founder_voice_input",
            lastVerified = now.toString()
        )
        return PersonalAwarenessLearningResult.Learned(
            fact = fact,
            speech = "Got it. I will remember ${category.voiceLabel()}: $value."
        )
    }

    private fun categoryFor(text: String): PersonalAwarenessCategory? {
        val normalized = text.normalizedPersonalMemoryText()
        return when {
            normalized.startsWith("remember homework") || normalized.startsWith("homework ") ->
                PersonalAwarenessCategory.HOMEWORK
            normalized.startsWith("remember class") || normalized.startsWith("class ") ->
                PersonalAwarenessCategory.CLASS_TIMING
            normalized.startsWith("remember jee") || normalized.startsWith("jee ") ->
                PersonalAwarenessCategory.JEE
            normalized.startsWith("remember badminton") || normalized.startsWith("badminton ") ->
                PersonalAwarenessCategory.BADMINTON
            normalized.startsWith("remember commitment") || normalized.startsWith("commitment ") ->
                PersonalAwarenessCategory.COMMITMENT
            normalized.startsWith("remember schedule") || normalized.startsWith("schedule ") ->
                PersonalAwarenessCategory.SCHEDULE
            else -> null
        }
    }

    private fun extractValue(text: String, category: PersonalAwarenessCategory): String =
        text.replace(Regex("^remember\\s+${category.commandToken()}\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^${category.commandToken()}\\s+", RegexOption.IGNORE_CASE), "")
            .trim()

    private fun PersonalAwarenessCategory.commandToken(): String =
        when (this) {
            PersonalAwarenessCategory.SCHEDULE -> "schedule"
            PersonalAwarenessCategory.CLASS_TIMING -> "class"
            PersonalAwarenessCategory.BADMINTON -> "badminton"
            PersonalAwarenessCategory.JEE -> "jee"
            PersonalAwarenessCategory.HOMEWORK -> "homework"
            PersonalAwarenessCategory.COMMITMENT -> "commitment"
        }

    private fun PersonalAwarenessCategory.voiceLabel(): String =
        when (this) {
            PersonalAwarenessCategory.SCHEDULE -> "schedule"
            PersonalAwarenessCategory.CLASS_TIMING -> "class timing"
            PersonalAwarenessCategory.BADMINTON -> "badminton"
            PersonalAwarenessCategory.JEE -> "JEE"
            PersonalAwarenessCategory.HOMEWORK -> "homework"
            PersonalAwarenessCategory.COMMITMENT -> "commitment"
        }
}

fun PersonalSnapshot.withLocalFacts(facts: List<PersonalAwarenessFact>): PersonalSnapshot {
    if (facts.isEmpty()) return this
    fun values(category: PersonalAwarenessCategory): List<String>? =
        facts.filter { it.category == category }
            .map { it.value }
            .takeIf { it.isNotEmpty() }

    val latestVerified = facts.maxByOrNull { it.lastVerified }?.lastVerified
    return copy(
        userEnteredSchedule = userEnteredSchedule ?: values(PersonalAwarenessCategory.SCHEDULE),
        classTimings = classTimings ?: values(PersonalAwarenessCategory.CLASS_TIMING),
        badmintonTimings = badmintonTimings ?: values(PersonalAwarenessCategory.BADMINTON),
        jeeTimings = jeeTimings ?: values(PersonalAwarenessCategory.JEE),
        homeworkTasks = homeworkTasks ?: values(PersonalAwarenessCategory.HOMEWORK),
        manualCommitments = manualCommitments ?: values(PersonalAwarenessCategory.COMMITMENT),
        lastVerifiedTimestamp = lastVerifiedTimestamp ?: latestVerified
    )
}

private fun String.normalizedPersonalMemoryText(): String =
    lowercase(Locale.US)
        .replace(Regex("[^a-z0-9\\s]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
