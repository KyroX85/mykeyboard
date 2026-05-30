package com.example.mykeyboard.execution

import java.util.Locale
import kotlin.math.abs

object FileSearchMatcher {

    fun rank(
        query: String,
        candidates: List<DeviceFileCandidate>,
        nowMillis: Long = System.currentTimeMillis(),
        limit: Int = 8
    ): List<FileSearchResult> {
        val normalizedQuery = normalize(query)
        val terms = expandTerms(tokenize(normalizedQuery))
        if (terms.isEmpty()) return emptyList()
        val wantsYesterday = normalizedQuery.contains("yesterday")

        return candidates.asSequence()
            .mapNotNull { candidate ->
                val result = scoreCandidate(candidate, terms, wantsYesterday, nowMillis)
                if (result.score > 0) result else null
            }
            .sortedWith(
                compareByDescending<FileSearchResult> { it.score }
                    .thenByDescending { it.candidate.modifiedAtMillis }
                    .thenBy { it.candidate.displayName.length }
            )
            .take(limit)
            .toList()
    }

    private fun scoreCandidate(
        candidate: DeviceFileCandidate,
        terms: Set<String>,
        wantsYesterday: Boolean,
        nowMillis: Long
    ): FileSearchResult {
        val name = normalize(candidate.displayName)
        val path = normalize(candidate.relativePath)
        val source = normalize(candidate.source)
        val mime = normalize(candidate.mimeType)
        val haystack = "$name $path $source $mime"
        val matched = mutableListOf<String>()
        var score = 0

        for (term in terms) {
            when {
                term.length <= 1 -> Unit
                name == term || name.startsWith("$term.") -> {
                    score += 45
                    matched += term
                }
                name.contains(term) -> {
                    score += 30
                    matched += term
                }
                path.contains(term) || source.contains(term) -> {
                    score += 16
                    matched += term
                }
                haystack.contains(term) -> {
                    score += 8
                    matched += term
                }
            }
        }

        if (terms.any { it == "pdf" } && mime.contains("pdf")) score += 25
        if (terms.any { it == "photo" || it == "image" || it == "screenshot" } && mime.startsWith("image")) score += 18
        if (terms.any { it == "screenshot" } && (path.contains("screenshot") || name.contains("screenshot"))) score += 35
        if (terms.any { it == "whatsapp" } && path.contains("whatsapp")) score += 35
        if (terms.any { it == "telegram" } && path.contains("telegram")) score += 35
        if (terms.any { it == "download" } && path.contains("download")) score += 20

        if (wantsYesterday) {
            val ageDays = abs(nowMillis - candidate.modifiedAtMillis) / MILLIS_PER_DAY
            score += when (ageDays) {
                1L -> 60
                0L, 2L -> 18
                else -> -20
            }
        }

        return FileSearchResult(
            candidate = candidate,
            score = score,
            matchedTerms = matched.distinct()
        )
    }

    private fun expandTerms(rawTerms: List<String>): Set<String> {
        val expanded = linkedSetOf<String>()
        for (term in rawTerms) {
            if (term in STOP_WORDS) continue
            expanded += term
            ALIASES[term]?.let(expanded::addAll)
        }
        return expanded
    }

    private fun tokenize(value: String): List<String> =
        value.split(Regex("[^a-z0-9]+")).filter { it.isNotBlank() }

    private fun normalize(value: String): String =
        value.lowercase(Locale.US)
            .replace("_", " ")
            .replace("-", " ")
            .trim()

    private const val MILLIS_PER_DAY = 86_400_000L

    private val STOP_WORDS = setOf(
        "find", "my", "the", "a", "an", "from", "for", "of", "in", "to", "me", "show", "get"
    )

    private val ALIASES = mapOf(
        "aadhaar" to setOf("aadhar", "uidai", "identity"),
        "aadhar" to setOf("aadhaar", "uidai", "identity"),
        "portion" to setOf("portions", "syllabus", "annual"),
        "portions" to setOf("portion", "syllabus", "annual"),
        "fee" to setOf("fees", "receipt", "payment"),
        "fees" to setOf("fee", "receipt", "payment"),
        "receipt" to setOf("fee", "fees", "payment"),
        "hall" to setOf("ticket", "admit"),
        "ticket" to setOf("hall", "admit"),
        "timetable" to setOf("time", "table", "schedule"),
        "photo" to setOf("image", "pic", "picture"),
        "pics" to setOf("photo", "image", "picture")
    )
}
