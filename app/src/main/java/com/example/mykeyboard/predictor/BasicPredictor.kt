package com.example.mykeyboard.predictor

import android.content.Context
import android.content.SharedPreferences
import com.example.mykeyboard.metrics.KeyboardMetrics
import com.example.mykeyboard.swipe.SwipeWordCandidate
import com.example.mykeyboard.swipe.SwipeWordResolver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import rita.RiTa
import java.util.regex.Pattern

class BasicPredictor internal constructor(
    private val prefs: SharedPreferences,
    private val ioScope: CoroutineScope,
    private val metrics: KeyboardMetrics? = null,
    private val loadPersistedModelAsync: Boolean = false
) {

    constructor(
        context: Context,
        ioScope: CoroutineScope,
        metrics: KeyboardMetrics? = null
    ) : this(
        context.getSharedPreferences("keyboard_predictions", Context.MODE_PRIVATE),
        ioScope,
        metrics,
        loadPersistedModelAsync = true
    )

    private val nextWordCounts = mutableMapOf<String, MutableMap<String, Int>>()
    private val unigramCounts = mutableMapOf<String, Int>()
    private val acceptedSuggestionCounts = mutableMapOf<String, Int>()
    private val rejectedSuggestionCounts = mutableMapOf<String, Int>()
    private val sessionWordCounts = linkedMapOf<String, Int>()
    private val sessionPairCounts = mutableMapOf<String, MutableMap<String, Int>>()
    private val modelLock = Any()
    private val swipeWordResolver = SwipeWordResolver()
    private var saveJob: Job? = null
    @Volatile
    private var pendingSaveMutations = 0
    @Volatile
    private var hasUnsavedModelChanges = false
    @Volatile
    private var topUnigramCache = listOf<String>()
    private var lastSuggestionSnapshot = SuggestionSnapshot()

    companion object {
        private const val PREFS_MODEL_KEY = "predictor_model_v2"
        private const val PREFS_BIGRAM_KEY = "bigram_model" // Legacy key
        private const val PREFS_COUNT_KEY = "word_count"
        private const val SAVE_DEBOUNCE_MS = 15_000L
        private const val MAX_MODEL_SIZE = 1500
        private const val MAX_ROW_SIZE = 64
        private const val MAX_SESSION_WORDS = 96
        private const val MAX_SESSION_PAIR_ROWS = 64
        private const val MAX_PERSISTED_MODEL_CHARS = 120_000
        private const val MODEL_SCHEMA_VERSION = 3
        private const val TOP_CACHE_SIZE = 96
        private const val MAX_TYPO_SCAN = 96
        private const val MAX_PREFIX_SCAN = 320
        private const val MAX_SWIPE_SCAN = 160
        private const val MAX_SWIPE_SEQUENCE_VARIANTS = 3
        private const val DEBUG_POOL_WORD_LIMIT = 8
        private const val MAX_AUTOCORRECT_SCAN = 128
        private const val EXTERNAL_DICTIONARY_PREFIX_MIN_LENGTH = 4
        private const val EXTERNAL_DICTIONARY_LIMIT = 6
        private const val EXTERNAL_DICTIONARY_COUNT = 6
        private const val MIN_LEARN_WORD_LENGTH = 2
        private const val MAX_LEARN_WORD_LENGTH = 24
        private const val MANUAL_LEARN_WEIGHT = 1
        private const val ACCEPTED_LEARN_WEIGHT = 4
        private const val ACCEPTED_PAIR_WEIGHT = 5
        private const val CORRECTION_PENALTY_WEIGHT = 3
        private const val MIN_TYPED_PREFIX_FOR_TYPO = 3
        private const val MIN_AUTOCORRECT_LENGTH = 3
        private const val MIN_AUTOCORRECT_SCORE = 72
        private const val MIN_AUTOCORRECT_MARGIN = 12
        private const val MIN_SHORT_AUTOCORRECT_SCORE = 82
        private const val MIN_SHORT_AUTOCORRECT_MARGIN = 16
        private const val STABILITY_BONUS = 18

        private val FALLBACK_SUGGESTIONS = listOf("the", "and", "to")
        private val VOWELS = setOf('a', 'e', 'i', 'o', 'u')
        private val COMMON_AUTOCORRECT_COUNTS = linkedMapOf(
            "hi" to 18,
            "the" to 28,
            "this" to 22,
            "you" to 26,
            "hello" to 20,
            "gboard" to 14
        )
        private val BUILT_IN_WORD_COUNTS = linkedMapOf(
            "about" to 18,
            "after" to 16,
            "again" to 16,
            "almost" to 12,
            "already" to 12,
            "always" to 14,
            "another" to 14,
            "around" to 12,
            "available" to 14,
            "beautiful" to 22,
            "because" to 20,
            "before" to 16,
            "between" to 14,
            "business" to 12,
            "call" to 18,
            "can" to 24,
            "comfortable" to 14,
            "confidence" to 18,
            "consequence" to 6,
            "consequences" to 6,
            "conjuring" to 6,
            "consider" to 14,
            "considering" to 12,
            "continue" to 14,
            "continued" to 12,
            "community" to 12,
            "conversation" to 24,
            "decision" to 14,
            "describe" to 12,
            "difficult" to 12,
            "different" to 16,
            "development" to 24,
            "dictionary" to 12,
            "education" to 12,
            "effective" to 12,
            "environment" to 12,
            "everything" to 16,
            "experience" to 16,
            "explain" to 14,
            "favorite" to 14,
            "familiar" to 12,
            "function" to 12,
            "future" to 14,
            "good" to 34,
            "government" to 10,
            "happened" to 12,
            "hello" to 32,
            "hi" to 42,
            "hippopotamus" to 20,
            "how" to 40,
            "important" to 16,
            "information" to 16,
            "architecture" to 16,
            "keyboard" to 18,
            "language" to 14,
            "learning" to 14,
            "location" to 12,
            "message" to 16,
            "morning" to 16,
            "necessary" to 12,
            "notification" to 12,
            "okay" to 28,
            "opportunity" to 12,
            "performance" to 18,
            "possible" to 16,
            "prediction" to 24,
            "problem" to 16,
            "process" to 14,
            "probably" to 14,
            "production" to 16,
            "question" to 16,
            "reason" to 14,
            "received" to 12,
            "remember" to 14,
            "response" to 14,
            "result" to 14,
            "send" to 18,
            "sentence" to 14,
            "something" to 16,
            "sometimes" to 14,
            "stability" to 14,
            "suggestion" to 14,
            "support" to 14,
            "system" to 14,
            "the" to 48,
            "this" to 38,
            "together" to 14,
            "tomorrow" to 16,
            "typing" to 20,
            "understand" to 16,
            "understanding" to 18,
            "update" to 14,
            "usually" to 14,
            "what" to 30,
            "where" to 26,
            "without" to 14,
            "wonderful" to 12,
            "yeah" to 26,
            "you" to 46
        )

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

        private val CONVERSATIONAL_PAIRS = listOf(
            "how" to "are",
            "are" to "you",
            "thank" to "you",
            "see" to "you",
            "good" to "morning",
            "good" to "night",
            "let" to "me",
            "talk" to "soon",
            "call" to "me",
            "sounds" to "good",
            "i" to "am",
            "i" to "will",
            "you" to "are",
            "we" to "can",
            "can" to "you",
            "please" to "send"
        )

        private val SEED_PHRASES = listOf(
            "hello", "how", "are", "you", "thank", "you", "please", "sorry",
            "good", "morning", "afternoon", "evening", "night", "bye", "see",
            "what", "when", "where", "why", "who", "how", "which", "that",
            "this", "these", "those", "is", "am", "are", "was", "were", "be",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "must", "can", "cannot", "need", "dare",
            "ought", "shall", "let", "make", "get", "give", "take", "keep",
            "put", "set", "go", "come", "run", "walk", "talk", "speak", "say",
            "tell", "ask", "answer", "think", "know", "understand", "believe",
            "feel", "want", "like", "love", "hate", "hope", "wish", "need",
            "try", "work", "play", "study", "learn", "teach", "read", "write",
            "listen", "watch", "look", "see", "hear", "smell", "taste", "touch",
            "eat", "drink", "sleep", "wake", "stand", "sit", "lie", "rise",
            "fall", "buy", "sell", "pay", "cost", "spend", "save", "earn",
            "lose", "find", "search", "look", "wait", "stay", "leave", "arrive",
            "depart", "return", "call", "phone", "email", "text", "message",
            "send", "receive", "open", "close", "start", "stop", "begin", "end",
            "finish", "complete", "continue", "repeat", "change", "move", "turn",
            "grow", "become", "seem", "appear", "sound", "smell", "taste",
            "look", "feel", "be", "have", "do", "say", "get", "make", "go",
            "know", "take", "see", "come", "think", "look", "want", "give",
            "use", "find", "tell", "ask", "work", "seem", "feel", "try",
            "leave", "call", "good", "new", "first", "last", "long", "great",
            "little", "own", "other", "old", "right", "big", "high", "different",
            "small", "large", "next", "early", "young", "important", "few",
            "public", "bad", "same", "able", "time", "day", "year", "people",
            "way", "thing", "man", "world", "life", "hand", "part", "child",
            "eye", "woman", "place", "week", "case", "point", "government",
            "company", "number", "group", "problem", "fact", "best", "home",
            "water", "room", "mother", "area", "money", "story", "fact", "month",
            "lot", "right", "study", "book", "eye", "job", "word", "business",
            "issue", "side", "kind", "head", "house", "service", "friend", "father",
            "power", "hour", "game", "line", "end", "member", "law", "car",
            "city", "community", "name", "president", "team", "minute", "idea",
            "kid", "body", "information", "back", "parent", "face", "others",
            "level", "office", "door", "health", "person", "art", "war", "history",
            "party", "result", "change", "morning", "reason", "research", "girl",
            "guy", "food", "moment", "air", "teacher", "education", "music",
            "data", "help", "thank", "very", "just", "also", "now", "well",
            "back", "even", "still", "only", "here", "there", "where", "then",
            "once", "never", "always", "often", "sometimes", "usually", "maybe",
            "perhaps", "probably", "certainly", "definitely", "actually", "really",
            "truly", "honestly", "clearly", "obviously", "simply", "basically",
            "essentially", "ultimately", "finally", "meanwhile", "however", "therefore",
            "otherwise", "besides", "anyway", "anyhow", "anywhere", "anytime",
            "anyone", "anything", "everything", "everyone", "everywhere", "somewhere",
            "someone", "something", "nowhere", "noone", "nothing", "yes", "no",
            "not", "never", "always", "forever", "forevermore", "forevermore",
            "forevermore", "forevermore", "forevermore", "forevermore", "forevermore"
        )
    }

    init {
        if (loadPersistedModelAsync) {
            ioScope.launch {
                loadModel(skipIfDirty = true)
                seedModel()
            }
        } else {
            loadModel()
            seedModel()
        }
    }

    private fun seedModel() {
        var seeded = false
        synchronized(modelLock) {
            if (nextWordCounts.isNotEmpty() || unigramCounts.isNotEmpty()) return
            for ((first, second) in CONVERSATIONAL_PAIRS) {
                incrementUnigram(first, 2)
                incrementUnigram(second, 2)
                incrementBigram(first, second, 6)
            }
            for (i in 0 until SEED_PHRASES.size - 1) {
                val current = SEED_PHRASES[i]
                val next = SEED_PHRASES[i + 1]
                incrementUnigram(current)
                incrementBigram(current, next)
            }
            incrementUnigram(SEED_PHRASES.last())
            rebuildTopUnigramCacheLocked()
            seeded = true
        }
        if (seeded) scheduleSaveModel()
    }

    fun getSuggestions(currentWord: String, previousWord: String? = null): List<String> {
        val prefix = currentWord.trim().lowercase()
        val prev = previousWord?.trim()?.lowercase().orEmpty()
        val ranked = mutableMapOf<String, CandidateScore>()
        val externalPrefixMatches = findExternalDictionaryPrefixMatches(prefix)

        synchronized(modelLock) {
            if (prefix.isNotEmpty()) {
                val contextual = if (prev.isNotEmpty()) nextWordCounts[prev] else null
                collectPrefixMatches(prefix, prev, contextual, CandidateSource.CONTEXTUAL, ranked)
                collectPrefixMatches(prefix, prev, sessionWordCounts, CandidateSource.SESSION, ranked)
                collectPrefixMatches(prefix, prev, BUILT_IN_WORD_COUNTS, CandidateSource.UNIGRAM, ranked)
                collectExternalDictionaryPrefixMatches(prefix, prev, externalPrefixMatches, ranked)
                collectPrefixMatches(prefix, prev, unigramCounts, CandidateSource.UNIGRAM, ranked)
                collectTypoMatches(prefix, prev, contextual, CandidateSource.CONTEXTUAL, ranked)
                collectTypoMatches(prefix, prev, BUILT_IN_WORD_COUNTS, CandidateSource.UNIGRAM, ranked)
                collectTypoMatches(prefix, prev, topUnigramCountsLocked(), CandidateSource.UNIGRAM, ranked)
            } else if (prev.isNotEmpty()) {
                collectNextWordMatches(prev, nextWordCounts[prev], ranked)
            }

            val suggestions = rankCandidates(prefix, prev, ranked)
            lastSuggestionSnapshot = SuggestionSnapshot(prefix, prev, suggestions)

            if (suggestions.isNotEmpty()) {
                return suggestions
            }
        }

        if (prefix.isEmpty()) {
            val suggestions = LinkedHashSet<String>(3)
            for (word in topUnigramCache.take(16)) {
                if (suggestions.size == 3) break
                suggestions.add(word)
            }
            for (fallback in FALLBACK_SUGGESTIONS) {
                if (suggestions.size == 3) break
                suggestions.add(fallback)
            }
            return suggestions.take(3)
        }

        return emptyList()
    }

    fun getAutocorrection(currentWord: String, previousWord: String? = null): String? {
        val typed = currentWord.trim().lowercase()
        val prev = previousWord?.trim()?.lowercase().orEmpty()
        if (!isAutocorrectEligible(typed)) return null

        val candidates = mutableMapOf<String, AutocorrectCandidate>()
        synchronized(modelLock) {
            collectAutocorrectCandidates(prev, nextWordCounts[prev], contextual = true, candidates)
            collectAutocorrectCandidates(prev, sessionPairCounts[prev], contextual = true, candidates)
            collectAutocorrectCandidates(prev, BUILT_IN_WORD_COUNTS, contextual = false, candidates)
            collectAutocorrectCandidates(prev, unigramCounts, contextual = false, candidates)
            collectAutocorrectCandidates(prev, sessionWordCounts, contextual = false, candidates)
            for ((word, count) in COMMON_AUTOCORRECT_COUNTS) {
                addAutocorrectCandidate(prev, word, count, contextual = false, candidates)
            }
            for (word in topUnigramCache) {
                if (candidates.size >= MAX_AUTOCORRECT_SCAN) break
                addAutocorrectCandidate(prev, word, unigramCounts[word] ?: continue, contextual = false, candidates)
            }
        }

        val ranked = candidates.values
            .asSequence()
            .mapNotNull { candidate ->
                val typoPenalty = autocorrectTypoPenalty(typed, candidate.word) ?: return@mapNotNull null
                val trust = autocorrectTrustScore(candidate)
                CorrectionScore(candidate.word, trust - typoPenalty, candidate.count)
            }
            .filter { it.word != typed && it.score >= MIN_AUTOCORRECT_SCORE }
            .sortedWith(
                compareByDescending<CorrectionScore> { it.score }
                    .thenByDescending { it.count }
                    .thenBy { it.word }
            )
            .take(2)
            .toList()

        val best = ranked.firstOrNull() ?: return null
        val runnerUp = ranked.getOrNull(1)
        val minScore = if (typed.length <= 4) MIN_SHORT_AUTOCORRECT_SCORE else MIN_AUTOCORRECT_SCORE
        val minMargin = if (typed.length <= 4) MIN_SHORT_AUTOCORRECT_MARGIN else MIN_AUTOCORRECT_MARGIN
        if (best.score < minScore) return null
        if (runnerUp != null && best.score - runnerUp.score < minMargin) return null
        if (shouldSuppressLowTrustAutocorrect(typed, candidates[best.word], best)) return null
        return best.word
    }

    fun getSwipeSuggestions(sequence: String, previousWord: String? = null): List<String> {
        return getSwipeSuggestions(listOf(sequence), previousWord)
    }

    fun getSwipeSuggestions(
        sequences: List<String>,
        previousWord: String? = null,
        debugReporter: ((String) -> Unit)? = null
    ): List<String> {
        val diagnostics = collectSwipeDiagnostics(sequences, previousWord, debugReporter = debugReporter)
        return diagnostics.resolved
    }

    fun diagnoseSwipeSuggestions(
        sequences: List<String>,
        previousWord: String? = null,
        intendedWord: String? = null
    ): SwipeSuggestionDiagnostics =
        collectSwipeDiagnostics(sequences, previousWord, intendedWord = intendedWord)

    private fun collectSwipeDiagnostics(
        sequences: List<String>,
        previousWord: String? = null,
        intendedWord: String? = null,
        debugReporter: ((String) -> Unit)? = null
    ): SwipeSuggestionDiagnostics {
        val prev = previousWord?.trim()?.lowercase().orEmpty()
        val cleanSequences = cleanSwipeSequences(sequences)
        if (cleanSequences.isEmpty()) {
            return SwipeSuggestionDiagnostics.EMPTY
        }
        val candidates = LinkedHashMap<String, SwipeCandidateAccumulator>(MAX_SWIPE_SCAN)
        synchronized(modelLock) {
            if (prev.isNotEmpty()) {
                collectSwipeCandidates(nextWordCounts[prev], candidates, contextual = true, learned = true)
                collectSwipeCandidates(sessionPairCounts[prev], candidates, contextual = true, learned = true)
            }
            collectSwipeCandidates(BUILT_IN_WORD_COUNTS, candidates, contextual = false, learned = false)
            collectSwipeCandidates(unigramCounts, candidates, contextual = false, learned = true)
            collectSwipeCandidates(sessionWordCounts, candidates, contextual = false, learned = true)
            for (word in topUnigramCache) {
                if (candidates.size >= MAX_SWIPE_SCAN) break
                val count = unigramCounts[word] ?: continue
                candidates.getOrPut(word) { SwipeCandidateAccumulator(word) }.let {
                    it.frequency += count
                    it.learnedFrequency += count
                }
            }
        }

        val intended = intendedWord?.trim()?.lowercase().orEmpty()
        val intendedInPool = intended.isNotEmpty() && candidates.containsKey(intended)
        val intendedState = if (intended.isEmpty()) "unknown" else intendedInPool.toString()
        debugReporter?.invoke(
            "swipe pool size=${candidates.size}" +
                " paths=${cleanSequences.joinToString("|")}" +
                " intendedInPool=$intendedState" +
                " top=${candidates.keys.take(DEBUG_POOL_WORD_LIMIT).joinToString(",")}"
        )
        val resolved = swipeWordResolver.resolve(
            cleanSequences,
            candidates.values.map {
                SwipeWordCandidate(
                    word = it.word,
                    frequency = it.frequency,
                    acceptedCount = it.acceptedCount,
                    contextualFrequency = it.contextualFrequency,
                    trustedLearned = it.acceptedCount > 0 || it.contextualFrequency >= 3 || it.learnedFrequency >= 3
                )
            },
            debugReporter = debugReporter
        )
        return SwipeSuggestionDiagnostics(
            cleanSequences = cleanSequences,
            candidatePoolSize = candidates.size,
            intendedInCandidatePool = intendedInPool,
            intendedResolvedRank = if (intended.isEmpty()) -1 else resolved.indexOf(intended),
            resolved = resolved,
            topCandidatePoolWords = candidates.keys.take(DEBUG_POOL_WORD_LIMIT).toList()
        )
    }

    private fun cleanSwipeSequences(sequences: List<String>): List<String> =
        sequences
            .asSequence()
            .map { it.trim().lowercase() }
            .filter { it.length >= 2 }
            .distinct()
            .take(MAX_SWIPE_SEQUENCE_VARIANTS)
            .toList()

    fun learnWord(word: String, previousWord: String? = null) {
        val cleanWord = normalizeWordForLearning(word) ?: return

        synchronized(modelLock) {
            incrementUnigram(cleanWord, MANUAL_LEARN_WEIGHT)
            incrementSessionWord(cleanWord, MANUAL_LEARN_WEIGHT)
            previousWord?.let {
                val cleanPrev = normalizeWordForLearning(it)
                if (cleanPrev != null) {
                    incrementBigram(cleanPrev, cleanWord, MANUAL_LEARN_WEIGHT)
                    incrementSessionPair(cleanPrev, cleanWord, MANUAL_LEARN_WEIGHT)
                }
            }
            trimModelLocked()
            rebuildTopUnigramCacheLocked()
        }
        scheduleSaveModel()
    }

    fun learnAcceptedSuggestion(word: String, previousWord: String? = null) {
        val cleanWord = normalizeWordForLearning(word) ?: return

        synchronized(modelLock) {
            acceptedSuggestionCounts[cleanWord] = (acceptedSuggestionCounts[cleanWord] ?: 0) + 1
            incrementUnigram(cleanWord, ACCEPTED_LEARN_WEIGHT)
            incrementSessionWord(cleanWord, ACCEPTED_LEARN_WEIGHT)
            previousWord?.let {
                val cleanPrev = normalizeWordForLearning(it)
                if (cleanPrev != null) {
                    incrementBigram(cleanPrev, cleanWord, ACCEPTED_PAIR_WEIGHT)
                    incrementSessionPair(cleanPrev, cleanWord, ACCEPTED_PAIR_WEIGHT)
                }
            }
            trimModelLocked()
            rebuildTopUnigramCacheLocked()
        }
        scheduleSaveModel()
    }

    fun reduceAcceptedSuggestionConfidence(word: String, previousWord: String? = null) {
        val cleanWord = normalizeWordForLearning(word) ?: return

        synchronized(modelLock) {
            rejectedSuggestionCounts[cleanWord] = (rejectedSuggestionCounts[cleanWord] ?: 0) + 1
            acceptedSuggestionCounts[cleanWord] = maxOf(0, (acceptedSuggestionCounts[cleanWord] ?: 0) - 1)
            decrementCount(unigramCounts, cleanWord, CORRECTION_PENALTY_WEIGHT)
            decrementCount(sessionWordCounts, cleanWord, CORRECTION_PENALTY_WEIGHT)
            previousWord?.let {
                val cleanPrev = normalizeWordForLearning(it)
                if (cleanPrev != null) {
                    decrementNestedCount(nextWordCounts, cleanPrev, cleanWord, CORRECTION_PENALTY_WEIGHT)
                    decrementNestedCount(sessionPairCounts, cleanPrev, cleanWord, CORRECTION_PENALTY_WEIGHT)
                }
            }
            rebuildTopUnigramCacheLocked()
        }
        scheduleSaveModel()
    }

    fun resetSessionMemory() {
        synchronized(modelLock) {
            sessionWordCounts.clear()
            sessionPairCounts.clear()
            lastSuggestionSnapshot = SuggestionSnapshot()
        }
    }

    private fun incrementUnigram(word: String, amount: Int = 1) {
        unigramCounts[word] = (unigramCounts[word] ?: 0) + amount
    }

    private fun incrementBigram(first: String, second: String, amount: Int = 1) {
        val row = nextWordCounts.getOrPut(first) { mutableMapOf() }
        row[second] = (row[second] ?: 0) + amount
        trimRow(row)
    }

    private fun incrementSessionWord(word: String, amount: Int) {
        sessionWordCounts[word] = (sessionWordCounts[word] ?: 0) + amount
        while (sessionWordCounts.size > MAX_SESSION_WORDS) {
            sessionWordCounts.remove(sessionWordCounts.keys.first())
        }
    }

    private fun incrementSessionPair(first: String, second: String, amount: Int) {
        val row = sessionPairCounts.getOrPut(first) { mutableMapOf() }
        row[second] = (row[second] ?: 0) + amount
        trimRow(row)
        while (sessionPairCounts.size > MAX_SESSION_PAIR_ROWS) {
            sessionPairCounts.remove(sessionPairCounts.keys.first())
        }
    }

    private fun decrementCount(counts: MutableMap<String, Int>, key: String, amount: Int) {
        val updated = (counts[key] ?: return) - amount
        if (updated > 0) {
            counts[key] = updated
        } else {
            counts.remove(key)
        }
    }

    private fun decrementNestedCount(
        counts: MutableMap<String, MutableMap<String, Int>>,
        first: String,
        second: String,
        amount: Int
    ) {
        val row = counts[first] ?: return
        decrementCount(row, second, amount)
        if (row.isEmpty()) {
            counts.remove(first)
        }
    }

    private fun trimModelLocked() {
        if (nextWordCounts.size > MAX_MODEL_SIZE) {
            val keysToRemove = nextWordCounts.keys.take(nextWordCounts.size - MAX_MODEL_SIZE)
            keysToRemove.forEach { key ->
                val removed = nextWordCounts.remove(key)
                if (removed != null) {
                    for (word in removed.keys) {
                        if ((unigramCounts[word] ?: 0) <= 0) {
                            unigramCounts.remove(word)
                        }
                    }
                }
            }
        }
        trimFlatMap(unigramCounts, MAX_MODEL_SIZE)
        trimFlatMap(acceptedSuggestionCounts, MAX_MODEL_SIZE)
        trimFlatMap(rejectedSuggestionCounts, MAX_MODEL_SIZE)
        for (row in nextWordCounts.values) {
            trimRow(row)
        }
        trimSessionModelLocked()
    }

    private fun trimSessionModelLocked() {
        while (sessionWordCounts.size > MAX_SESSION_WORDS) {
            sessionWordCounts.remove(sessionWordCounts.keys.first())
        }
        while (sessionPairCounts.size > MAX_SESSION_PAIR_ROWS) {
            sessionPairCounts.remove(sessionPairCounts.keys.first())
        }
        for (row in sessionPairCounts.values) {
            trimRow(row)
        }
    }

    private fun rebuildTopUnigramCacheLocked() {
        topUnigramCache = unigramCounts.entries
            .asSequence()
            .sortedWith(
                compareByDescending<Map.Entry<String, Int>> { wordTrustScore(it.key, null, it.value, CandidateSource.UNIGRAM, false) }
                    .thenByDescending { it.value }
                    .thenBy { it.key }
            )
            .map { it.key }
            .take(TOP_CACHE_SIZE)
            .toList()
    }

    private fun collectNextWordMatches(
        previousWord: String,
        counts: Map<String, Int>?,
        output: MutableMap<String, CandidateScore>
    ) {
        if (counts.isNullOrEmpty()) return

        for ((word, count) in counts) {
            if (isLoopingSuggestion(previousWord, word)) continue
            val sessionCount = sessionPairCounts[previousWord]?.get(word) ?: 0
            val score = wordTrustScore(word, previousWord, count + sessionCount, CandidateSource.CONTEXTUAL, false)
            if (score > 0) {
                addCandidate(output, word, score, count, false)
            }
        }
    }

    private fun collectPrefixMatches(
        prefix: String,
        previousWord: String,
        counts: Map<String, Int>?,
        source: CandidateSource,
        output: MutableMap<String, CandidateScore>
    ) {
        if (counts.isNullOrEmpty()) return

        var scanned = 0
        for ((word, count) in counts) {
            if (scanned >= MAX_PREFIX_SCAN) break
            scanned++
            if (!word.startsWith(prefix)) continue
            if (isLoopingSuggestion(previousWord, word)) continue
            val score = wordTrustScore(word, previousWord, count, source, false)
            addCandidate(output, word, score, count, false)
        }
    }

    private fun findExternalDictionaryPrefixMatches(prefix: String): List<String> {
        if (prefix.length < EXTERNAL_DICTIONARY_PREFIX_MIN_LENGTH) return emptyList()

        val options = mapOf(
            "limit" to EXTERNAL_DICTIONARY_LIMIT,
            "minLength" to prefix.length,
            "maxLength" to MAX_LEARN_WORD_LENGTH,
            "shuffle" to false
        )
        val pattern = Pattern.compile("^${Pattern.quote(prefix)}[a-z]*$")
        return try {
            RiTa.search(pattern, options).toList()
        } catch (e: RuntimeException) {
            emptyList()
        }
    }

    private fun collectExternalDictionaryPrefixMatches(
        prefix: String,
        previousWord: String,
        words: List<String>,
        output: MutableMap<String, CandidateScore>
    ) {
        for (rawWord in words) {
            val word = normalizeWordForLearning(rawWord) ?: continue
            if (!word.startsWith(prefix) || isLoopingSuggestion(previousWord, word)) continue
            val score = wordTrustScore(
                word,
                previousWord,
                EXTERNAL_DICTIONARY_COUNT,
                CandidateSource.EXTERNAL,
                false
            )
            addCandidate(output, word, score, EXTERNAL_DICTIONARY_COUNT, false)
        }
    }

    private fun collectTypoMatches(
        prefix: String,
        previousWord: String,
        counts: Map<String, Int>?,
        source: CandidateSource,
        output: MutableMap<String, CandidateScore>
    ) {
        if (counts.isNullOrEmpty() || prefix.length < MIN_TYPED_PREFIX_FOR_TYPO) return

        var scanned = 0
        for ((word, count) in counts) {
            if (scanned >= MAX_TYPO_SCAN) break
            scanned++
            if (word.startsWith(prefix) || isLoopingSuggestion(previousWord, word)) continue
            val distancePenalty = typoPenalty(prefix, word) ?: continue
            val score = wordTrustScore(word, previousWord, count, source, true) - distancePenalty
            if (score > 0) {
                addCandidate(output, word, score, count, true)
            }
        }
    }

    private fun collectSwipeCandidates(
        counts: Map<String, Int>?,
        output: LinkedHashMap<String, SwipeCandidateAccumulator>,
        contextual: Boolean,
        learned: Boolean
    ) {
        if (counts.isNullOrEmpty()) return
        for ((word, count) in counts) {
            if (output.size >= MAX_SWIPE_SCAN && !output.containsKey(word)) break
            val accumulator = output.getOrPut(word) { SwipeCandidateAccumulator(word) }
            accumulator.frequency += count
            accumulator.acceptedCount += acceptedSuggestionCounts[word] ?: 0
            if (contextual) {
                accumulator.contextualFrequency += count
            }
            if (learned) {
                accumulator.learnedFrequency += count
            }
        }
    }

    private fun collectAutocorrectCandidates(
        previousWord: String,
        counts: Map<String, Int>?,
        contextual: Boolean,
        output: MutableMap<String, AutocorrectCandidate>
    ) {
        if (counts.isNullOrEmpty()) return
        var scanned = 0
        for ((word, count) in counts) {
            if (scanned >= MAX_AUTOCORRECT_SCAN) break
            scanned++
            addAutocorrectCandidate(previousWord, word, count, contextual, output)
        }
    }

    private fun addAutocorrectCandidate(
        previousWord: String,
        word: String,
        count: Int,
        contextual: Boolean,
        output: MutableMap<String, AutocorrectCandidate>
    ) {
        if (count <= 0 || isLoopingSuggestion(previousWord, word)) return
        if (word.length !in MIN_LEARN_WORD_LENGTH..MAX_LEARN_WORD_LENGTH) return
        val candidate = output.getOrPut(word) { AutocorrectCandidate(word) }
        candidate.count += count
        candidate.acceptedCount += acceptedSuggestionCounts[word] ?: 0
        if (contextual) {
            candidate.contextualCount += count
        }
    }

    private fun topUnigramCountsLocked(): Map<String, Int> {
        val output = LinkedHashMap<String, Int>(topUnigramCache.size)
        for (word in topUnigramCache) {
            unigramCounts[word]?.let { output[word] = it }
        }
        return output
    }

    private fun rankCandidates(
        prefix: String,
        previousWord: String,
        candidates: Map<String, CandidateScore>
    ): List<String> {
        if (candidates.isEmpty()) return emptyList()
        return candidates.values
            .asSequence()
            .map {
                if (
                    lastSuggestionSnapshot.previousWord == previousWord &&
                    prefix.startsWith(lastSuggestionSnapshot.prefix) &&
                    it.word in lastSuggestionSnapshot.suggestions
                ) {
                    it.copy(score = it.score + STABILITY_BONUS)
                } else {
                    it
                }
            }
            .filter { it.score >= minimumConfidence(prefix, it.typoMatch) }
            .sortedWith(
                compareByDescending<CandidateScore> { it.score }
                    .thenBy { it.typoMatch }
                    .thenByDescending { it.count }
                    .thenBy { it.word }
            )
            .map { it.word }
            .take(3)
            .toList()
    }

    private fun addCandidate(
        output: MutableMap<String, CandidateScore>,
        word: String,
        score: Int,
        count: Int,
        typoMatch: Boolean
    ) {
        val existing = output[word]
        if (existing == null || score > existing.score) {
            output[word] = CandidateScore(word, score, count, typoMatch)
        }
    }

    private fun wordTrustScore(
        word: String,
        previousWord: String?,
        rawCount: Int,
        source: CandidateSource,
        typoMatch: Boolean
    ): Int {
        // Prevent one-off words from jumping to the top immediately.
        val base = if (rawCount <= 1) 0 else rawCount - 1
        val acceptedBoost = (acceptedSuggestionCounts[word] ?: 0) * 14
        val rejectedPenalty = (rejectedSuggestionCounts[word] ?: 0) * 20
        val sessionBoost = (sessionWordCounts[word] ?: 0) * 5
        val sessionPairBoost = previousWord
            ?.let { sessionPairCounts[it]?.get(word) }
            ?.times(8)
            ?: 0
        val sourceBoost = when (source) {
            CandidateSource.CONTEXTUAL -> 36
            CandidateSource.SESSION -> 100
            CandidateSource.EXTERNAL -> 8
            CandidateSource.UNIGRAM -> 12
        }
        val typoPenalty = if (typoMatch) 14 else 0

        return base * when (source) {
            CandidateSource.CONTEXTUAL -> 8
            CandidateSource.SESSION -> 10
            CandidateSource.EXTERNAL -> 3
            CandidateSource.UNIGRAM -> 4
        } + sourceBoost + acceptedBoost + sessionBoost + sessionPairBoost - rejectedPenalty - typoPenalty
    }

    private fun minimumConfidence(prefix: String, typoMatch: Boolean): Int {
        if (prefix.isEmpty()) return 12
        return if (typoMatch) 16 else 12
    }

    private fun isLoopingSuggestion(previousWord: String, candidate: String): Boolean =
        previousWord.isNotEmpty() && previousWord == candidate

    private fun typoPenalty(prefix: String, word: String): Int? {
        if (word.length < prefix.length - 1) return null
        if (hasSingleMissingLetter(prefix, word)) return 10
        if (hasAdjacentKeyMistake(prefix, word)) return 14
        if (hasSingleAdjacentInsertedLetter(prefix, word)) return 12
        if (collapseRepeatedLetters(prefix) == collapseRepeatedLetters(word.take(prefix.length + 1))) return 16
        if (hasNearbySwap(prefix, word)) return 18
        return null
    }

    private fun hasSingleMissingLetter(prefix: String, word: String): Boolean {
        if (word.length < prefix.length + 1) return false
        var typedIndex = 0
        var wordIndex = 0
        var skipped = 0
        while (typedIndex < prefix.length && wordIndex < word.length) {
            if (prefix[typedIndex] == word[wordIndex]) {
                typedIndex++
                wordIndex++
            } else {
                skipped++
                if (skipped > 1) return false
                wordIndex++
            }
        }
        return typedIndex == prefix.length && skipped <= 1
    }

    private fun hasAdjacentKeyMistake(prefix: String, word: String): Boolean {
        if (prefix.length > word.length) return false
        var mistakes = 0
        for (index in prefix.indices) {
            val expected = word[index]
            val actual = prefix[index]
            if (actual == expected) continue
            if (KEY_NEIGHBORS[expected]?.contains(actual) == true) {
                mistakes++
                if (mistakes > 1) return false
            } else {
                return false
            }
        }
        return mistakes == 1
    }

    private fun isAutocorrectEligible(typed: String): Boolean {
        if (typed.length < MIN_AUTOCORRECT_LENGTH || typed.length > MAX_LEARN_WORD_LENGTH + 1) return false
        if (!typed.all { it in 'a'..'z' }) return false
        return true
    }

    private fun autocorrectTrustScore(candidate: AutocorrectCandidate): Int {
        val commonBoost = (COMMON_AUTOCORRECT_COUNTS[candidate.word] ?: 0) * 3
        val acceptedBoost = candidate.acceptedCount * 18
        val contextualBoost = candidate.contextualCount * 10
        val learnedBoost = kotlin.math.min(candidate.count, 24) * 3
        val rejectedPenalty = (rejectedSuggestionCounts[candidate.word] ?: 0) * 24
        return 34 + commonBoost + acceptedBoost + contextualBoost + learnedBoost - rejectedPenalty
    }

    private fun autocorrectTypoPenalty(typed: String, word: String): Int? {
        if (typed == word) return null
        if (kotlin.math.abs(typed.length - word.length) > 1) return null
        if (hasSingleAdjacentInsertedLetter(typed, word)) return 12
        if (hasAdjacentKeyMistake(typed, word)) return 18
        if (collapseRepeatedLetters(typed) == word) return 10
        if (collapseRepeatedLetters(typed) == collapseRepeatedLetters(word)) return 14
        if (hasNearbySwap(typed, word)) return 20
        return null
    }

    private fun shouldSuppressLowTrustAutocorrect(
        typed: String,
        candidate: AutocorrectCandidate?,
        best: CorrectionScore
    ): Boolean {
        val current = candidate ?: return true
        val hasTrustSignal =
            current.acceptedCount > 0 ||
                current.contextualCount > 0 ||
                (COMMON_AUTOCORRECT_COUNTS[current.word] ?: 0) > 0
        if (hasTrustSignal) return false
        if (typed.length <= 4 && current.count < 12) return true
        return best.count < 8 && best.score < (MIN_AUTOCORRECT_SCORE + 10)
    }

    private fun hasSingleAdjacentInsertedLetter(typed: String, word: String): Boolean {
        if (typed.length != word.length + 1) return false

        var typedIndex = 0
        var wordIndex = 0
        var insertedIndex = -1
        while (typedIndex < typed.length && wordIndex < word.length) {
            if (typed[typedIndex] == word[wordIndex]) {
                typedIndex++
                wordIndex++
            } else {
                if (insertedIndex >= 0) return false
                insertedIndex = typedIndex
                typedIndex++
            }
        }

        if (insertedIndex < 0) {
            insertedIndex = typed.length - 1
        }
        return isPlausibleAdjacentInsertion(typed, word, insertedIndex)
    }

    private fun isPlausibleAdjacentInsertion(typed: String, word: String, insertedIndex: Int): Boolean {
        val inserted = typed[insertedIndex]
        val previous = word.getOrNull(insertedIndex - 1)
        val next = word.getOrNull(insertedIndex)
        return previous?.let { KEY_NEIGHBORS[it]?.contains(inserted) == true } == true ||
            next?.let { KEY_NEIGHBORS[it]?.contains(inserted) == true } == true ||
            previous == inserted ||
            next == inserted
    }

    private fun hasNearbySwap(prefix: String, word: String): Boolean {
        if (prefix.length > word.length) return false
        var index = 0
        var swaps = 0
        while (index < prefix.length) {
            if (prefix[index] == word[index]) {
                index++
                continue
            }
            if (
                index + 1 < prefix.length &&
                prefix[index] == word[index + 1] &&
                prefix[index + 1] == word[index]
            ) {
                swaps++
                if (swaps > 1) return false
                index += 2
            } else {
                return false
            }
        }
        return swaps == 1
    }

    private fun collapseRepeatedLetters(input: String): String {
        if (input.isEmpty()) return input
        val output = StringBuilder(input.length)
        var previous: Char? = null
        for (char in input) {
            if (char != previous) {
                output.append(char)
            }
            previous = char
        }
        return output.toString()
    }

    private fun normalizeWordForLearning(input: String?): String? {
        val trimmed = input?.trim()?.lowercase() ?: return null
        if (trimmed.isEmpty()) return null
        if (trimmed.length !in MIN_LEARN_WORD_LENGTH..MAX_LEARN_WORD_LENGTH) return null
        if (isLowQualityToken(trimmed)) return null
        return trimmed
    }

    private fun isLowQualityToken(word: String): Boolean {
        if (word.contains("http") || word.contains("www")) return true
        if (word.contains('/') || word.contains('\\') || word.contains('@')) return true
        var letterCount = 0
        var digitCount = 0
        var punctuationCount = 0
        var vowelCount = 0
        var prevChar: Char? = null
        var runLength = 1

        for (char in word) {
            when {
                char.isLetter() -> {
                    letterCount++
                    if (char in VOWELS) vowelCount++
                }
                char.isDigit() -> digitCount++
                char == '\'' || char == '-' || char == '_' -> punctuationCount++
                else -> return true
            }

            if (prevChar == char) {
                runLength++
                if (runLength >= 4) return true
            } else {
                runLength = 1
            }
            prevChar = char
        }

        if (letterCount == 0) return true
        if (digitCount > 0) return true
        if (punctuationCount > word.length / 2) return true
        if (word.length >= 5 && vowelCount == 0) return true

        if (isAlternatingTwoCharPattern(word)) return true
        if (isLikelyConsonantSpam(word)) return true

        return false
    }

    private fun isAlternatingTwoCharPattern(word: String): Boolean {
        if (word.length < 4) return false
        val first = word[0]
        val second = word[1]
        if (first == second) return false
        for (index in word.indices) {
            val expected = if (index % 2 == 0) first else second
            if (word[index] != expected) return false
        }
        return true
    }

    private fun isLikelyConsonantSpam(word: String): Boolean {
        if (word.length != 3) return false
        if (!word.all { it.isLetter() }) return false
        return word[0] == word[1] && word[1] == word[2] // e.g., "kkk"
    }

    private fun trimFlatMap(counts: MutableMap<String, Int>, maxSize: Int) {
        if (counts.size <= maxSize) return
        val keysToRemove = counts.entries
            .sortedWith(compareBy<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .take(counts.size - maxSize)
            .map { it.key }
        keysToRemove.forEach(counts::remove)
    }

    private fun trimRow(row: MutableMap<String, Int>) {
        if (row.size <= MAX_ROW_SIZE) return
        val keysToRemove = row.entries
            .sortedWith(compareBy<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .take(row.size - MAX_ROW_SIZE)
            .map { it.key }
        keysToRemove.forEach(row::remove)
    }

    private fun scheduleSaveModel() {
        hasUnsavedModelChanges = true
        pendingSaveMutations++
        if (saveJob != null) {
            return
        }

        saveJob = ioScope.launch {
            delay(SAVE_DEBOUNCE_MS)
            saveModel()
        }
    }

    private fun saveModel() {
        try {
            val snapshot: PersistedModelSnapshot
            var size = 0
            synchronized(modelLock) {
                trimModelLocked()
                snapshot = PersistedModelSnapshot(
                    bigrams = snapshotNestedCounts(nextWordCounts, MAX_MODEL_SIZE, MAX_ROW_SIZE),
                    unigrams = snapshotFlatCounts(unigramCounts, MAX_MODEL_SIZE),
                    accepted = snapshotFlatCounts(acceptedSuggestionCounts, MAX_MODEL_SIZE),
                    rejected = snapshotFlatCounts(rejectedSuggestionCounts, MAX_MODEL_SIZE)
                )
                size = snapshot.bigrams.size
            }

            val json = JSONObject()
            json.put("schema", MODEL_SCHEMA_VERSION)
            json.put("bigrams", snapshotNestedJson(snapshot.bigrams))
            json.put("unigrams", snapshotFlatJson(snapshot.unigrams))
            json.put("accepted", snapshotFlatJson(snapshot.accepted))
            json.put("rejected", snapshotFlatJson(snapshot.rejected))

            val serialized = json.toString()
            if (serialized.length > MAX_PERSISTED_MODEL_CHARS) {
                metrics?.recordSaveModelFailure("model-size-cap")
                return
            }

            prefs.edit()
                .putString(PREFS_MODEL_KEY, serialized)
                .putString(PREFS_BIGRAM_KEY, serialized) // Keep legacy key updated
                .putInt(PREFS_COUNT_KEY, size)
                .apply()
            pendingSaveMutations = 0
            hasUnsavedModelChanges = false
        } catch (e: Exception) {
            metrics?.recordSaveModelFailure(e.javaClass.simpleName.ifEmpty { "unknown" })
        } finally {
            saveJob = null
        }
    }

    private fun loadModel(skipIfDirty: Boolean = false) {
        try {
            val jsonString = prefs.getString(PREFS_MODEL_KEY, null)
                ?: prefs.getString(PREFS_BIGRAM_KEY, null)
                ?: return
            if (jsonString.length > MAX_PERSISTED_MODEL_CHARS) {
                metrics?.recordPredictorLoadFailure("model-size-cap")
                clearPersistedModel()
                return
            }
            
            val json = try {
                JSONObject(jsonString)
            } catch (e: Exception) {
                metrics?.recordPredictorLoadFailure(e.javaClass.simpleName.ifEmpty { "json" })
                if (!attemptOldFormatMigration(jsonString)) {
                    clearPersistedModel()
                }
                return
            }

            synchronized(modelLock) {
                if (skipIfDirty && hasSessionLearningLocked()) {
                    return
                }
                nextWordCounts.clear()
                unigramCounts.clear()
                acceptedSuggestionCounts.clear()
                rejectedSuggestionCounts.clear()

                val bigramsObject = json.optJSONObject("bigrams")
                val unigramsObject = json.optJSONObject("unigrams")
                val acceptedObject = json.optJSONObject("accepted")
                val rejectedObject = json.optJSONObject("rejected")

                if (bigramsObject != null) {
                    val keys = bigramsObject.keys()
                    var rowsLoaded = 0
                    while (keys.hasNext()) {
                        if (rowsLoaded >= MAX_MODEL_SIZE) break
                        val key = keys.next()
                        val cleanKey = normalizeWordForLearning(key) ?: continue
                        val rowObj = bigramsObject.optJSONObject(key) ?: continue
                        val rowMap = mutableMapOf<String, Int>()
                        val rowKeys = rowObj.keys()
                        var rowItemsLoaded = 0
                        while (rowKeys.hasNext()) {
                            if (rowItemsLoaded >= MAX_ROW_SIZE) break
                            val word = rowKeys.next()
                            val cleanWord = normalizeWordForLearning(word) ?: continue
                            val count = rowObj.optInt(word, 0)
                            if (count > 0) {
                                rowMap[cleanWord] = count
                                rowItemsLoaded++
                            }
                        }
                        if (rowMap.isNotEmpty()) {
                            nextWordCounts[cleanKey] = rowMap
                            rowsLoaded++
                        }
                    }
                } else {
                    // Backward compatibility with legacy flat key -> [word1, word2]
                    loadLegacyBigramArrays(json)
                }

                if (unigramsObject != null) {
                    val keys = unigramsObject.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        val count = unigramsObject.optInt(key, 0)
                        if (count > 0) {
                            unigramCounts[key] = count
                        }
                    }
                } else {
                    rebuildUnigramsFromBigramsLocked()
                }

                loadFlatCountObject(acceptedObject, acceptedSuggestionCounts)
                loadFlatCountObject(rejectedObject, rejectedSuggestionCounts)
                trimModelLocked()
                rebuildTopUnigramCacheLocked()
            }
        } catch (e: Exception) {
            metrics?.recordPredictorLoadFailure(e.javaClass.simpleName.ifEmpty { "unknown" })
            clearPersistedModel()
        }
    }

    private fun hasSessionLearningLocked(): Boolean =
        hasUnsavedModelChanges ||
            pendingSaveMutations > 0 ||
            sessionWordCounts.isNotEmpty() ||
            sessionPairCounts.isNotEmpty()

    private fun loadFlatCountObject(source: JSONObject?, target: MutableMap<String, Int>) {
        target.clear()
        val objectKeys = source?.keys() ?: return
        while (objectKeys.hasNext()) {
            val key = objectKeys.next()
            val cleanKey = normalizeWordForLearning(key) ?: continue
            val count = source.optInt(key, 0)
            if (count > 0) {
                target[cleanKey] = count
            }
        }
    }

    private fun loadLegacyBigramArrays(json: JSONObject) {
        val keys = json.keys()
        var rowsLoaded = 0
        while (keys.hasNext()) {
            if (rowsLoaded >= MAX_MODEL_SIZE) break
            val key = keys.next()
            val cleanKey = normalizeWordForLearning(key) ?: continue
            val array = json.optJSONArray(key) ?: continue
            val rowMap = mutableMapOf<String, Int>()
            for (i in 0 until array.length()) {
                if (rowMap.size >= MAX_ROW_SIZE) break
                val next = array.optString(i).trim().lowercase()
                val cleanNext = normalizeWordForLearning(next)
                if (cleanNext != null) {
                    rowMap[cleanNext] = (rowMap[cleanNext] ?: 0) + 1
                }
            }
            if (rowMap.isNotEmpty()) {
                nextWordCounts[cleanKey] = rowMap
                rowsLoaded++
            }
        }
    }

    private fun rebuildUnigramsFromBigramsLocked() {
        unigramCounts.clear()
        for ((first, row) in nextWordCounts) {
            incrementUnigram(first)
            for ((next, count) in row) {
                unigramCounts[next] = (unigramCounts[next] ?: 0) + count
            }
        }
    }

    private fun attemptOldFormatMigration(oldData: String): Boolean =
        try {
            var migrated = false
            val pairs = oldData.trim('{', '}').split("],")
            synchronized(modelLock) {
                nextWordCounts.clear()
                unigramCounts.clear()
                for (pair in pairs) {
                    val colonIndex = pair.indexOf(":")
                    if (colonIndex > 0) {
                        val key = pair.substring(1, colonIndex - 1)
                        val valuesStr = pair.substring(colonIndex + 2)
                        val values = valuesStr
                            .replace("\"", "")
                            .replace("[", "")
                            .replace("]", "")
                            .split(",")
                            .filter { it.isNotEmpty() }
                            .toList()
                        
                        if (values.isNotEmpty()) {
                            val row = mutableMapOf<String, Int>()
                            values.forEach { value ->
                                val clean = value.trim().lowercase()
                                if (clean.isNotEmpty()) {
                                    row[clean] = (row[clean] ?: 0) + 1
                                }
                            }
                            if (row.isNotEmpty()) {
                                nextWordCounts[key] = row
                                migrated = true
                            }
                        }
                    }
                }
                rebuildUnigramsFromBigramsLocked()
                rebuildTopUnigramCacheLocked()
            }
            migrated
        } catch (e: Exception) {
            metrics?.recordPredictorLoadFailure(e.javaClass.simpleName.ifEmpty { "legacy" })
            clearPersistedModel()
            false
        }

    private fun snapshotNestedCounts(
        source: Map<String, Map<String, Int>>,
        maxRows: Int,
        maxRowSize: Int
    ): Map<String, Map<String, Int>> =
        source.entries
            .asSequence()
            .filter { normalizeWordForLearning(it.key) != null }
            .take(maxRows)
            .associate { (key, row) ->
                key to snapshotFlatCounts(row, maxRowSize)
            }
            .filterValues { it.isNotEmpty() }

    private fun snapshotFlatCounts(source: Map<String, Int>, maxSize: Int): Map<String, Int> =
        source.entries
            .asSequence()
            .filter { it.value > 0 && normalizeWordForLearning(it.key) != null }
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .take(maxSize)
            .associate { it.key to it.value }

    private fun snapshotNestedJson(source: Map<String, Map<String, Int>>): JSONObject {
        val output = JSONObject()
        for ((key, row) in source) {
            output.put(key, snapshotFlatJson(row))
        }
        return output
    }

    private fun snapshotFlatJson(source: Map<String, Int>): JSONObject {
        val output = JSONObject()
        for ((word, count) in source) {
            output.put(word, count)
        }
        return output
    }

    private fun clearPersistedModel() {
        try {
            prefs.edit()
                .remove(PREFS_MODEL_KEY)
                .remove(PREFS_BIGRAM_KEY)
                .remove(PREFS_COUNT_KEY)
                .apply()
        } catch (e: Exception) {
            metrics?.recordSaveModelFailure(e.javaClass.simpleName.ifEmpty { "clear" })
        }
    }

    fun clearModel() {
        saveJob?.cancel()
        saveJob = null
        pendingSaveMutations = 0
        hasUnsavedModelChanges = false
        synchronized(modelLock) {
            nextWordCounts.clear()
            unigramCounts.clear()
            acceptedSuggestionCounts.clear()
            rejectedSuggestionCounts.clear()
            sessionWordCounts.clear()
            sessionPairCounts.clear()
            topUnigramCache = emptyList()
            lastSuggestionSnapshot = SuggestionSnapshot()
        }
        prefs.edit()
            .remove(PREFS_MODEL_KEY)
            .remove(PREFS_BIGRAM_KEY)
            .remove(PREFS_COUNT_KEY)
            .apply()
    }

    fun flushPendingSave() {
        saveJob?.cancel()
        saveJob = null
        if (hasUnsavedModelChanges || pendingSaveMutations > 0) {
            saveModel()
        }
    }

    private data class CandidateScore(
        val word: String,
        val score: Int,
        val count: Int,
        val typoMatch: Boolean
    )

    private data class SwipeCandidateAccumulator(
        val word: String,
        var frequency: Int = 0,
        var acceptedCount: Int = 0,
        var contextualFrequency: Int = 0,
        var learnedFrequency: Int = 0
    )

    private data class AutocorrectCandidate(
        val word: String,
        var count: Int = 0,
        var acceptedCount: Int = 0,
        var contextualCount: Int = 0
    )

    private data class CorrectionScore(
        val word: String,
        val score: Int,
        val count: Int
    )

    private data class SuggestionSnapshot(
        val prefix: String = "",
        val previousWord: String = "",
        val suggestions: List<String> = emptyList()
    )

    private data class PersistedModelSnapshot(
        val bigrams: Map<String, Map<String, Int>>,
        val unigrams: Map<String, Int>,
        val accepted: Map<String, Int>,
        val rejected: Map<String, Int>
    )

    private enum class CandidateSource {
        CONTEXTUAL,
        SESSION,
        EXTERNAL,
        UNIGRAM
    }
}

data class SwipeSuggestionDiagnostics(
    val cleanSequences: List<String>,
    val candidatePoolSize: Int,
    val intendedInCandidatePool: Boolean,
    val intendedResolvedRank: Int,
    val resolved: List<String>,
    val topCandidatePoolWords: List<String>
) {
    companion object {
        val EMPTY = SwipeSuggestionDiagnostics(
            cleanSequences = emptyList(),
            candidatePoolSize = 0,
            intendedInCandidatePool = false,
            intendedResolvedRank = -1,
            resolved = emptyList(),
            topCandidatePoolWords = emptyList()
        )
    }
}
