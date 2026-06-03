package com.example.mykeyboard.swipe

class SwipeWordResolver {
    private var geometryCost = FloatArray(0)


    fun resolve(sequence: String, candidates: List<SwipeWordCandidate>, limit: Int = DEFAULT_LIMIT): List<String> {
        return resolve(listOf(sequence), candidates, limit)
    }

    fun resolve(
        sequences: List<String>,
        candidates: List<SwipeWordCandidate>,
        limit: Int = DEFAULT_LIMIT,
        debugReporter: ((String) -> Unit)? = null
    ): List<String> {
        val cleanSequences = sequences
            .asSequence()
            .map(::normalizeSequence)
            .filter { it.length >= MIN_SEQUENCE_LENGTH }
            .distinct()
            .take(MAX_SEQUENCE_VARIANTS)
            .toList()
        if (cleanSequences.isEmpty() || candidates.isEmpty()) return emptyList()

        val scoredCandidates = LinkedHashMap<String, SwipeResolvedCandidate>(candidates.size)
        for (candidate in candidates) {
            bestPathCandidate(cleanSequences, candidate)?.let { scored ->
                keepBestCandidate(scoredCandidates, scored)
            }
            bestShapeCandidate(cleanSequences, candidate)?.let { scored ->
                keepBestCandidate(scoredCandidates, scored)
            }
            bestFallbackCandidate(cleanSequences, candidate)?.let { scored ->
                keepBestCandidate(scoredCandidates, scored)
            }
        }

        val resolved = scoredCandidates.values
            .asSequence()
            .filter { it.score >= if (it.tier == COMMON_FALLBACK_TIER) MIN_SAFE_FALLBACK_SCORE else MIN_SCORE }
            .sortedWith(
                compareBy<SwipeResolvedCandidate> { it.tier }
                    .thenByDescending { it.score }
                    .thenByDescending { it.frequency }
                    .thenBy { it.word }
            )
            .toList()

        debugReporter?.invoke(buildDebugReport(cleanSequences, resolved))
        if (resolved.isAmbiguousWeakRecovery()) return emptyList()
        if (resolved.isLowConfidenceWeakRecovery()) return emptyList()
        return resolved
            .map { it.word }
            .take(limit)
    }

    private fun bestPathCandidate(sequences: List<String>, candidate: SwipeWordCandidate): SwipeResolvedCandidate? {
        var best: SwipeResolvedCandidate? = null
        for (index in sequences.indices) {
            val match = matchScore(sequences[index], candidate) ?: continue
            val weightedPathBonus = if (index == 0) WEIGHTED_PATH_BONUS else 0
            val tier = if (match.tier == STRONG_WEIGHTED_PATH_TIER && index > 0) {
                STRONG_RAW_PATH_TIER
            } else {
                match.tier
            }
            val trustScore = cappedTrustScore(candidate)
            val bestLengthDelta = sequences.minOf { kotlin.math.abs(candidate.word.length - it.length) }
            val lengthPenalty = bestLengthDelta *
                if (candidate.frequency >= COMMON_WORD_FREQUENCY) 1 else 2
            val commonShortBoost = if (candidate.word.length <= 4 && candidate.frequency >= COMMON_SHORT_FREQUENCY) {
                COMMON_SHORT_BOOST
            } else {
                0
            }
            val learnedBoost = if (candidate.isTrustedLearned()) TRUSTED_LEARNED_BOOST else 0
            val bonusScore = weightedPathBonus + commonShortBoost + learnedBoost
            val finalScore = match.score + trustScore + bonusScore - lengthPenalty
            val scored = SwipeResolvedCandidate(
                word = candidate.word,
                tier = tier,
                score = finalScore,
                frequency = candidate.frequency,
                pathScore = match.score,
                trustScore = trustScore,
                bonusScore = bonusScore,
                penaltyScore = lengthPenalty,
                source = if (index == 0) "weighted" else "raw",
                reason = match.reason
            )
            if (best == null || compareCandidate(scored, best!!) < 0) {
                best = scored
            }
        }
        return best
    }

    private fun bestFallbackCandidate(sequences: List<String>, candidate: SwipeWordCandidate): SwipeResolvedCandidate? {
        var best: SwipeResolvedCandidate? = null
        for (sequence in sequences) {
            val score = safeFallbackScore(sequence, candidate) ?: continue
            val scored = SwipeResolvedCandidate(
                word = candidate.word,
                tier = COMMON_FALLBACK_TIER,
                score = score,
                frequency = candidate.frequency,
                pathScore = score,
                trustScore = 0,
                bonusScore = 0,
                penaltyScore = 0,
                source = "fallback",
                reason = "safe-common"
            )
            if (best == null || compareCandidate(scored, best!!) < 0) {
                best = scored
            }
        }
        return best
    }

    private fun bestShapeCandidate(sequences: List<String>, candidate: SwipeWordCandidate): SwipeResolvedCandidate? {
        var best: SwipeResolvedCandidate? = null
        val word = normalizeSequence(candidate.word)
        if (word.length < SHAPE_MIN_WORD_LENGTH) return null
        for (sequence in sequences) {
            val shapeScore = keyboardShapeFallbackScore(sequence, word, candidate) ?: continue
            val scored = SwipeResolvedCandidate(
                word = candidate.word,
                tier = STRONG_WEIGHTED_PATH_TIER,
                score = shapeScore,
                frequency = candidate.frequency,
                pathScore = shapeScore,
                trustScore = cappedTrustScore(candidate),
                bonusScore = 0,
                penaltyScore = 0,
                source = "shape",
                reason = "geometry"
            )
            if (best == null || compareCandidate(scored, best!!) < 0) {
                best = scored
            }
        }
        return best
    }

    private fun keepBestCandidate(
        output: MutableMap<String, SwipeResolvedCandidate>,
        candidate: SwipeResolvedCandidate
    ) {
        val existing = output[candidate.word]
        if (existing == null || compareCandidate(candidate, existing) < 0) {
            output[candidate.word] = candidate
        }
    }

    private fun compareCandidate(first: SwipeResolvedCandidate, second: SwipeResolvedCandidate): Int {
        if (first.tier != second.tier) return first.tier - second.tier
        if (first.score != second.score) return second.score - first.score
        if (first.frequency != second.frequency) return second.frequency - first.frequency
        return first.word.compareTo(second.word)
    }

    private fun List<SwipeResolvedCandidate>.isAmbiguousWeakRecovery(): Boolean {
        val first = firstOrNull() ?: return false
        val second = getOrNull(1) ?: return false
        if (first.tier < WEAK_RECOVERY_TIER || second.tier != first.tier) return false
        return first.score - second.score < MIN_WEAK_RECOVERY_MARGIN
    }

    private fun List<SwipeResolvedCandidate>.isLowConfidenceWeakRecovery(): Boolean {
        val first = firstOrNull() ?: return false
        return first.tier >= WEAK_RECOVERY_TIER && first.score < MIN_LOW_CONFIDENCE_WEAK_SCORE
    }

    private fun buildDebugReport(
        sequences: List<String>,
        candidates: List<SwipeResolvedCandidate>
    ): String {
        val builder = StringBuilder(160)
        builder.append("swipe scores paths=")
            .append(sequences.joinToString("|"))
        candidates.take(DEBUG_CANDIDATE_LIMIT).forEach { candidate ->
            builder.append(" candidate=")
                .append(candidate.word)
                .append(" tier=")
                .append(candidate.tier)
                .append(" raw=")
                .append(candidate.pathScore)
                .append(" trust=")
                .append(candidate.trustScore)
                .append(" bonus=")
                .append(candidate.bonusScore)
                .append(" penalty=")
                .append(candidate.penaltyScore)
                .append(" final=")
                .append(candidate.score)
                .append(" reason=")
                .append(candidate.reason)
                .append('/')
                .append(candidate.source)
        }
        candidates.firstOrNull()?.let {
            builder.append(" winner=")
                .append(it.word)
                .append(" because=tier-")
                .append(it.tier)
                .append("-")
                .append(it.reason)
        }
        return builder.toString()
    }

    private fun normalizeSequence(sequence: String): String {
        if (sequence.isEmpty()) return ""
        val output = StringBuilder(sequence.length)
        var previous = NO_KEY
        for (char in sequence.lowercase()) {
            if (char !in 'a'..'z' || char == previous) continue
            output.append(char)
            previous = char
        }
        return output.toString()
    }

    private fun matchScore(sequence: String, candidate: SwipeWordCandidate): SwipeMatchScore? {
        val word = candidate.word
        val frequency = candidate.frequency
        if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) return null
        val cleanWord = normalizeSequence(word)
        if (cleanWord.length < MIN_WORD_LENGTH) return null
        if (cleanWord == sequence) {
            return SwipeMatchScore(130, EXACT_PATH_TIER, "path", "exact")
        }
        if (cleanWord.startsWith(sequence)) {
            return SwipeMatchScore(
                if (frequency >= COMMON_WORD_FREQUENCY || candidate.isTrustedLearned()) 122 else 92,
                when {
                    candidate.isTrustedLearned() -> TRUSTED_LEARNED_TIER
                    frequency >= COMMON_WORD_FREQUENCY -> STRONG_WEIGHTED_PATH_TIER
                    else -> WEAK_RECOVERY_TIER
                },
                "path",
                "prefix"
            )
        }

        val firstPenalty = endpointPenalty(sequence.first(), cleanWord.first())
            ?: trustedEndpointPenalty(sequence, cleanWord.first(), fromStart = true, candidate)
        val lastPenalty = endpointPenalty(sequence.last(), cleanWord.last())
            ?: relaxedEndpointPenalty(sequence, cleanWord, frequency)
            ?: trustedEndpointPenalty(sequence, cleanWord.last(), fromStart = false, candidate)
        if (firstPenalty == null || lastPenalty == null) return null

        val pathScore = greedyPathScore(sequence, cleanWord, candidate) ?: return null
        val geometryScore = if (cleanWord.length >= SHAPE_MIN_WORD_LENGTH) {
            geometryShapeScore(sequence, cleanWord)
        } else {
            0
        }
        val adjusted = pathScore + geometryScore - firstPenalty - lastPenalty
        val hasExactFinalIntent = cleanWord.last() in sequence
        val shortCloseCommonPath = frequency >= COMMON_SHORT_FREQUENCY &&
            cleanWord.length <= SHORT_WORD_MAX_LENGTH &&
            kotlin.math.abs(cleanWord.length - sequence.length) <= 1 &&
            hasExactFinalIntent
        val tier = when {
            candidate.isTrustedLearned() -> TRUSTED_LEARNED_TIER
            adjusted >= STRONG_PATH_SCORE || shortCloseCommonPath -> STRONG_WEIGHTED_PATH_TIER
            else -> WEAK_RECOVERY_TIER
        }
        return SwipeMatchScore(adjusted, tier, "path", "ordered")
    }

    private fun greedyPathScore(sequence: String, word: String, candidate: SwipeWordCandidate): Int? {
        val frequency = candidate.frequency
        val trustedLearned = candidate.isTrustedLearned()
        var sequenceIndex = 0
        var wordIndex = 0
        var exactMatches = 0
        var adjacentMatches = 0
        var extraPathKeys = 0
        var missingWordKeys = 0

        while (sequenceIndex < sequence.length && wordIndex < word.length) {
            val pathKey = sequence[sequenceIndex]
            val wordKey = word[wordIndex]
            when {
                pathKey == wordKey -> {
                    exactMatches++
                    sequenceIndex++
                    wordIndex++
                }
                areAdjacent(wordKey, pathKey) -> {
                    adjacentMatches++
                    sequenceIndex++
                    wordIndex++
                }
                nextSequenceMatchesWord(sequence, sequenceIndex, wordKey) -> {
                    extraPathKeys++
                    sequenceIndex++
                }
                nextWordMatchesSequence(word, wordIndex, pathKey) -> {
                    missingWordKeys++
                    wordIndex++
                }
                else -> {
                    val maxLocalGap = when {
                        trustedLearned -> MAX_TRUSTED_LOCAL_GAP
                        frequency >= COMMON_WORD_FREQUENCY -> MAX_COMMON_LOCAL_GAP
                        else -> MAX_LOCAL_GAP
                    }
                    val sequenceGap = findUpcomingMatch(sequence, sequenceIndex + 1, wordKey, maxLocalGap)
                    val wordGap = findUpcomingMatch(word, wordIndex + 1, pathKey, maxLocalGap)
                    when {
                        sequenceGap in 1..maxLocalGap -> {
                            extraPathKeys += sequenceGap
                            sequenceIndex += sequenceGap
                        }
                        wordGap in 1..maxLocalGap -> {
                            missingWordKeys += wordGap
                            wordIndex += wordGap
                        }
                        else -> return null
                    }
                }
            }
        }

        extraPathKeys += sequence.length - sequenceIndex
        missingWordKeys += word.length - wordIndex

        val longWord = word.length >= LONG_WORD_RELAXED_LENGTH
        val strongLongSignal = longWord &&
            exactMatches >= MIN_LONG_WORD_EXACT_MATCHES &&
            adjacentMatches <= MAX_LONG_WORD_ADJACENT
        var maxExtra = when {
            trustedLearned -> 5
            frequency >= COMMON_WORD_FREQUENCY && word.length >= LONG_WORD_RELAXED_LENGTH -> 5
            frequency >= COMMON_WORD_FREQUENCY -> 5
            else -> 2
        }
        var maxMissing = when {
            trustedLearned -> 5
            frequency >= COMMON_WORD_FREQUENCY && word.length >= LONG_WORD_RELAXED_LENGTH -> 6
            frequency >= COMMON_WORD_FREQUENCY || word.length >= 6 -> 4
            else -> 2
        }
        val maxAdjacent = when {
            trustedLearned -> 4
            frequency >= COMMON_WORD_FREQUENCY && word.length >= LONG_WORD_RELAXED_LENGTH -> 4
            frequency >= COMMON_WORD_FREQUENCY -> 3
            else -> 2
        }
        if (strongLongSignal && frequency >= COMMON_WORD_FREQUENCY && !trustedLearned) {
            maxExtra += 1
            maxMissing += 1
        }
        if (extraPathKeys > maxExtra || missingWordKeys > maxMissing || adjacentMatches > maxAdjacent) return null
        if (exactMatches == 0) return null

        val coverage = exactMatches * 24 + adjacentMatches * 12
        val extraPenalty = when {
            trustedLearned -> 5
            frequency >= COMMON_WORD_FREQUENCY -> 6
            else -> 8
        } - if (strongLongSignal && frequency >= COMMON_WORD_FREQUENCY && !trustedLearned) 1 else 0
        val missingPenalty = when {
            trustedLearned -> 6
            frequency >= COMMON_WORD_FREQUENCY -> 7
            else -> 9
        } - if (strongLongSignal && frequency >= COMMON_WORD_FREQUENCY && !trustedLearned) 1 else 0
        val penalties = extraPathKeys * extraPenalty + missingWordKeys * missingPenalty + adjacentMatches * 5
        return 82 + coverage - penalties
    }

    private fun endpointPenalty(actual: Char, expected: Char): Int? = when {
        actual == expected -> 0
        areAdjacent(expected, actual) -> 10
        else -> null
    }

    private fun relaxedEndpointPenalty(sequence: String, word: String, frequency: Int): Int? {
        if (frequency < COMMON_SHORT_FREQUENCY || word.length > SHORT_WORD_MAX_LENGTH) return null
        val expected = word.last()
        val start = maxOf(0, sequence.length - ENDPOINT_LOOKBACK)
        var index = sequence.length - 2
        while (index >= start) {
            val actual = sequence[index]
            if (actual == expected) return 6
            if (areAdjacent(expected, actual)) return 18
            index--
        }
        return null
    }

    private fun trustedEndpointPenalty(
        sequence: String,
        expected: Char,
        fromStart: Boolean,
        candidate: SwipeWordCandidate
    ): Int? {
        if (!candidate.isTrustedLearned()) return null
        val confidence = endpointConfidence(sequence, expected, fromStart) ?: return null
        return maxOf(0, TRUSTED_ENDPOINT_BASE_PENALTY - confidence / 2)
    }

    private fun safeFallbackScore(sequence: String, candidate: SwipeWordCandidate): Int? {
        val word = normalizeSequence(candidate.word)
        if (word !in SAFE_FALLBACK_WORDS) return null
        if (candidate.frequency < COMMON_WORD_FREQUENCY) return null
        val maxExtraKeys = if (word.length >= LONG_SAFE_WORD_LENGTH) {
            MAX_LONG_SAFE_EXTRA_KEYS
        } else {
            MAX_SAFE_EXTRA_KEYS
        }
        if (sequence.length > word.length + maxExtraKeys) return null

        val firstScore = endpointConfidence(sequence, word.first(), fromStart = true) ?: return null
        val lastScore = endpointConfidence(sequence, word.last(), fromStart = false) ?: return null

        var sequenceIndex = 0
        var exactMatches = 0
        var adjacentMatches = 0
        var missingWordKeys = 0

        for (wordKey in word) {
            val matchIndex = findSafeFallbackMatch(sequence, sequenceIndex, wordKey)
            if (matchIndex >= 0) {
                val actual = sequence[matchIndex]
                if (actual == wordKey) {
                    exactMatches++
                } else {
                    adjacentMatches++
                }
                sequenceIndex = matchIndex + 1
            } else {
                missingWordKeys++
            }
        }

        val matchedKeys = exactMatches + adjacentMatches
        val minMatches = if (word.length >= LONG_SAFE_WORD_LENGTH) MIN_LONG_SAFE_MATCHES else MIN_SAFE_MATCHES
        if (matchedKeys < minOf(word.length, minMatches)) return null
        if (exactMatches == 0 && adjacentMatches < MIN_SAFE_ADJACENT_MATCHES) return null

        val extraPathKeys = sequence.length - matchedKeys
        val trustScore = candidate.frequency * 2 +
            candidate.acceptedCount * 16 +
            candidate.contextualFrequency * 10
        val shortBoost = if (word.length <= SHORT_WORD_MAX_LENGTH) 20 else 8
        val pathScore = firstScore + lastScore +
            exactMatches * 20 +
            adjacentMatches * 12 -
            missingWordKeys * 12 -
            extraPathKeys * 7
        return pathScore + trustScore + shortBoost
    }

    private fun keyboardShapeFallbackScore(sequence: String, word: String, candidate: SwipeWordCandidate): Int? {
        if (sequence.length < SHAPE_MIN_SEQUENCE_LENGTH) return null
        if (kotlin.math.abs(word.length - sequence.length) > SHAPE_MAX_LENGTH_DELTA) return null
        endpointPenalty(sequence.first(), word.first()) ?: return null
        endpointPenalty(sequence.last(), word.last()) ?: return null

        val distance = normalizedKeyboardPathDistance(sequence, word)
        if (distance > SHAPE_MAX_NORMALIZED_DISTANCE) return null

        var sequenceIndex = 0
        var exactMatches = 0
        var adjacentMatches = 0
        for (wordKey in word) {
            if (sequenceIndex >= sequence.length) break
            val pathKey = sequence[sequenceIndex]
            when {
                pathKey == wordKey -> {
                    exactMatches++
                    sequenceIndex++
                }
                areAdjacent(wordKey, pathKey) -> {
                    adjacentMatches++
                    sequenceIndex++
                }
            }
        }

        val matched = exactMatches + adjacentMatches
        if (matched < minOf(sequence.length, SHAPE_MIN_MATCHES)) return null
        val skippedPathKeys = sequence.length - matched
        if (skippedPathKeys > SHAPE_MAX_SKIPPED_PATH_KEYS) return null
        val missingWordKeys = word.length - matched
        val trustScore = cappedTrustScore(candidate)
        val distancePenalty = (distance * SHAPE_DISTANCE_PENALTY_SCALE).toInt()
        return 84 +
            exactMatches * 26 +
            adjacentMatches * 12 +
            trustScore -
            missingWordKeys * 5 -
            skippedPathKeys * 12 -
            distancePenalty
    }

    private fun findSafeFallbackMatch(sequence: String, startIndex: Int, target: Char): Int {
        var index = startIndex
        while (index < sequence.length && index - startIndex <= MAX_SAFE_FALLBACK_GAP) {
            if (matches(target, sequence[index])) return index
            index++
        }
        return -1
    }

    private fun endpointConfidence(sequence: String, expected: Char, fromStart: Boolean): Int? {
        val endExclusive = if (fromStart) minOf(sequence.length, ENDPOINT_LOOKBACK) else sequence.length
        val startInclusive = if (fromStart) 0 else maxOf(0, sequence.length - ENDPOINT_LOOKBACK)
        var index = if (fromStart) startInclusive else endExclusive - 1
        while (if (fromStart) index < endExclusive else index >= startInclusive) {
            val actual = sequence[index]
            val distance = if (fromStart) index - startInclusive else endExclusive - 1 - index
            val distancePenalty = distance * 4
            when {
                actual == expected -> return 24 - distancePenalty
                areAdjacent(expected, actual) -> return 16 - distancePenalty
            }
            if (fromStart) {
                index++
            } else {
                index--
            }
        }
        return null
    }

    private fun nextSequenceMatchesWord(sequence: String, index: Int, wordKey: Char): Boolean =
        index + 1 < sequence.length && matches(wordKey, sequence[index + 1])

    private fun nextWordMatchesSequence(word: String, index: Int, pathKey: Char): Boolean =
        index + 1 < word.length && matches(word[index + 1], pathKey)

    private fun findUpcomingMatch(input: String, startIndex: Int, target: Char, maxGap: Int): Int {
        var index = startIndex
        while (index < input.length && index - startIndex <= maxGap) {
            if (matches(target, input[index])) {
                return index - startIndex + 1
            }
            index++
        }
        return -1
    }

    private fun matches(expected: Char, actual: Char): Boolean =
        expected == actual || areAdjacent(expected, actual)

    private fun areAdjacent(expected: Char, actual: Char): Boolean =
        KEY_NEIGHBORS[expected]?.contains(actual) == true

    private fun geometryShapeScore(sequence: String, word: String): Int {
        if (sequence.length < MIN_SEQUENCE_LENGTH || word.length < MIN_WORD_LENGTH) return 0
        val distance = normalizedKeyboardPathDistance(sequence, word)
        return ((GEOMETRY_GOOD_DISTANCE - distance) * GEOMETRY_SCORE_SCALE)
            .toInt()
            .coerceIn(-GEOMETRY_MAX_PENALTY, GEOMETRY_MAX_BONUS)
    }

    @Synchronized
    private fun normalizedKeyboardPathDistance(sequence: String, word: String): Float {
        val rows = sequence.length + 1
        val columns = word.length + 1
        val cellCount = rows * columns
        ensureGeometryCostCapacity(cellCount)
        geometryCost.fill(Float.POSITIVE_INFINITY, 0, cellCount)
        geometryCost[0] = 0f

        for (row in 1..sequence.length) {
            for (column in 1..word.length) {
                val local = keyboardDistance(sequence[row - 1], word[column - 1])
                val previous = minOf(
                    geometryCost[(row - 1) * columns + column],
                    geometryCost[row * columns + column - 1],
                    geometryCost[(row - 1) * columns + column - 1]
                )
                geometryCost[row * columns + column] = local + previous
            }
        }

        return geometryCost[sequence.length * columns + word.length] / maxOf(sequence.length, word.length)
    }

    private fun ensureGeometryCostCapacity(cellCount: Int) {
        if (geometryCost.size >= cellCount) return
        geometryCost = FloatArray(cellCount)
    }

    private fun keyboardDistance(first: Char, second: Char): Float {
        if (first == second) return 0f
        val firstPoint = KEY_CENTERS[first] ?: return FAR_KEY_DISTANCE
        val secondPoint = KEY_CENTERS[second] ?: return FAR_KEY_DISTANCE
        val dx = firstPoint.x - secondPoint.x
        val dy = firstPoint.y - secondPoint.y
        return kotlin.math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()
    }

    private fun SwipeWordCandidate.isTrustedLearned(): Boolean =
        trustedLearned || acceptedCount > 0 || contextualFrequency >= TRUSTED_CONTEXTUAL_FREQUENCY

    private fun cappedTrustScore(candidate: SwipeWordCandidate): Int {
        val frequencyScore = minOf(candidate.frequency, MAX_TRUST_FREQUENCY) * 4
        val acceptedScore = minOf(candidate.acceptedCount, MAX_TRUST_ACCEPTED_COUNT) * 24
        val contextualScore = minOf(candidate.contextualFrequency, MAX_TRUST_CONTEXT_COUNT) * 12
        return frequencyScore + acceptedScore + contextualScore
    }

    private val KEY_NEIGHBORS = mapOf(
        'q' to "wa",
        'w' to "qase",
        'e' to "wsdr",
        'r' to "edft",
        't' to "rfgy",
        'y' to "tghu",
        'u' to "yhji",
        'i' to "ujko",
        'o' to "iklp",
        'p' to "ol",
        'a' to "qwsz",
        's' to "awedxz",
        'd' to "serfcx",
        'f' to "drtgvc",
        'g' to "ftyhbv",
        'h' to "gyujnb",
        'j' to "huikmn",
        'k' to "jiolm",
        'l' to "kop",
        'z' to "asx",
        'x' to "zsdc",
        'c' to "xdfv",
        'v' to "cfgb",
        'b' to "vghn",
        'n' to "bhjm",
        'm' to "njk"
    )

    private val KEY_CENTERS = mapOf(
        'q' to KeyPoint(0f, 0f),
        'w' to KeyPoint(1f, 0f),
        'e' to KeyPoint(2f, 0f),
        'r' to KeyPoint(3f, 0f),
        't' to KeyPoint(4f, 0f),
        'y' to KeyPoint(5f, 0f),
        'u' to KeyPoint(6f, 0f),
        'i' to KeyPoint(7f, 0f),
        'o' to KeyPoint(8f, 0f),
        'p' to KeyPoint(9f, 0f),
        'a' to KeyPoint(0.5f, 1f),
        's' to KeyPoint(1.5f, 1f),
        'd' to KeyPoint(2.5f, 1f),
        'f' to KeyPoint(3.5f, 1f),
        'g' to KeyPoint(4.5f, 1f),
        'h' to KeyPoint(5.5f, 1f),
        'j' to KeyPoint(6.5f, 1f),
        'k' to KeyPoint(7.5f, 1f),
        'l' to KeyPoint(8.5f, 1f),
        'z' to KeyPoint(1.5f, 2f),
        'x' to KeyPoint(2.5f, 2f),
        'c' to KeyPoint(3.5f, 2f),
        'v' to KeyPoint(4.5f, 2f),
        'b' to KeyPoint(5.5f, 2f),
        'n' to KeyPoint(6.5f, 2f),
        'm' to KeyPoint(7.5f, 2f)
    )

    private data class KeyPoint(
        val x: Float,
        val y: Float
    )

    private data class SwipeResolvedCandidate(
        val word: String,
        val tier: Int,
        val score: Int,
        val frequency: Int,
        val pathScore: Int,
        val trustScore: Int,
        val bonusScore: Int,
        val penaltyScore: Int,
        val source: String,
        val reason: String
    )

    private data class SwipeMatchScore(
        val score: Int,
        val tier: Int,
        val source: String,
        val reason: String
    )

    private companion object {
        const val DEFAULT_LIMIT = 3
        const val DEBUG_CANDIDATE_LIMIT = 3
        const val MAX_SEQUENCE_VARIANTS = 3
        const val MIN_SEQUENCE_LENGTH = 2
        const val MIN_WORD_LENGTH = 2
        const val MAX_WORD_LENGTH = 24
        const val MAX_LOCAL_GAP = 2
        const val MAX_COMMON_LOCAL_GAP = 3
        const val MAX_TRUSTED_LOCAL_GAP = 4
        const val COMMON_WORD_FREQUENCY = 20
        const val COMMON_SHORT_FREQUENCY = 24
        const val TRUSTED_CONTEXTUAL_FREQUENCY = 3
        const val TRUSTED_LEARNED_BOOST = 28
        const val COMMON_SHORT_BOOST = 20
        const val TRUSTED_ENDPOINT_BASE_PENALTY = 22
        const val WEIGHTED_PATH_BONUS = 8
        const val MAX_TRUST_FREQUENCY = 40
        const val MAX_TRUST_ACCEPTED_COUNT = 5
        const val MAX_TRUST_CONTEXT_COUNT = 5
        const val EXACT_PATH_TIER = 0
        const val TRUSTED_LEARNED_TIER = 1
        const val STRONG_WEIGHTED_PATH_TIER = 2
        const val STRONG_RAW_PATH_TIER = 3
        const val COMMON_FALLBACK_TIER = 4
        const val WEAK_RECOVERY_TIER = 5
        const val STRONG_PATH_SCORE = 112
        const val MIN_WEAK_RECOVERY_MARGIN = 14
        const val MIN_LOW_CONFIDENCE_WEAK_SCORE = 92
        const val SHORT_WORD_MAX_LENGTH = 4
        const val ENDPOINT_LOOKBACK = 3
        const val MIN_SCORE = 80
        const val MIN_SAFE_FALLBACK_SCORE = 125
        const val MAX_SAFE_EXTRA_KEYS = 4
        const val MAX_LONG_SAFE_EXTRA_KEYS = 5
        const val MAX_SAFE_FALLBACK_GAP = 3
        const val MIN_SAFE_MATCHES = 2
        const val MIN_LONG_SAFE_MATCHES = 4
        const val MIN_SAFE_ADJACENT_MATCHES = 2
        const val LONG_SAFE_WORD_LENGTH = 6
        const val LONG_WORD_RELAXED_LENGTH = 10
        const val MIN_LONG_WORD_EXACT_MATCHES = 4
        const val MAX_LONG_WORD_ADJACENT = 4
        const val GEOMETRY_GOOD_DISTANCE = 1.15f
        const val GEOMETRY_SCORE_SCALE = 22f
        const val GEOMETRY_MAX_BONUS = 34
        const val GEOMETRY_MAX_PENALTY = 18
        const val FAR_KEY_DISTANCE = 4f
        const val SHAPE_MIN_WORD_LENGTH = 6
        const val SHAPE_MIN_SEQUENCE_LENGTH = 4
        const val SHAPE_MIN_MATCHES = 4
        const val SHAPE_MAX_LENGTH_DELTA = 5
        const val SHAPE_MAX_SKIPPED_PATH_KEYS = 2
        const val SHAPE_MAX_NORMALIZED_DISTANCE = 1.45f
        const val SHAPE_DISTANCE_PENALTY_SCALE = 18f
        const val NO_KEY = '\u0000'
        val SAFE_FALLBACK_WORDS = setOf(
            "the",
            "this",
            "you",
            "how",
            "hello",
            "good",
            "what",
            "where",
            "because",
            "okay",
            "yeah"
        )
    }
}

data class SwipeWordCandidate(
    val word: String,
    val frequency: Int,
    val acceptedCount: Int = 0,
    val contextualFrequency: Int = 0,
    val trustedLearned: Boolean = false
)
