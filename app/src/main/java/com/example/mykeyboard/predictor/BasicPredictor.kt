package com.example.mykeyboard.predictor

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class BasicPredictor(
    context: Context,
    private val ioScope: CoroutineScope
) {

    private val prefs = context.getSharedPreferences("keyboard_predictions", Context.MODE_PRIVATE)
    private val bigramModel = mutableMapOf<String, MutableList<String>>()
    private val modelLock = Any()
    private var saveJob: Job? = null

    companion object {
        private const val PREFS_BIGRAM_KEY = "bigram_model"
        private const val PREFS_COUNT_KEY = "word_count"
        private const val SAVE_DEBOUNCE_MS = 250L

        private val FALLBACK_SUGGESTIONS = listOf("hello", "thanks", "please")

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
        loadModel()
        seedModel()
    }

    private fun seedModel() {
        if (bigramModel.isEmpty()) {
            for (i in 0 until SEED_PHRASES.size - 1) {
                val current = SEED_PHRASES[i]
                val next = SEED_PHRASES[i + 1]
                addBigram(current, next)
            }
            scheduleSaveModel()
        }
    }

    fun getSuggestions(currentWord: String, previousWord: String? = null): List<String> {
        val suggestions = ArrayList<String>(3)

        val key = if (currentWord.isEmpty()) {
            previousWord ?: ""
        } else {
            currentWord.lowercase()
        }

        if (key.isNotEmpty()) {
            synchronized(modelLock) {
                val predictions = bigramModel[key]
                if (predictions != null) {
                    val count = minOf(3, predictions.size)
                    for (index in 0 until count) {
                        suggestions.add(predictions[index])
                    }
                }
            }
        }

        if (suggestions.size < 3) {
            for (fallback in FALLBACK_SUGGESTIONS) {
                if (suggestions.size == 3) break
                if (!suggestions.contains(fallback)) {
                    suggestions.add(fallback)
                }
            }
        }

        return suggestions
    }

    fun learnWord(word: String, previousWord: String? = null) {
        val cleanWord = word.trim().lowercase()
        if (cleanWord.length < 2) return

        var changed = false
        previousWord?.let {
            val cleanPrev = it.trim().lowercase()
            if (cleanPrev.isNotEmpty()) {
                changed = addBigram(cleanPrev, cleanWord)
            }
        }

        if (changed) {
            scheduleSaveModel()
        }
    }

    private fun addBigram(first: String, second: String): Boolean {
        synchronized(modelLock) {
            val list = bigramModel.getOrPut(first) { mutableListOf() }
            if (!list.contains(second)) {
                list.add(second)
                return true
            }
        }
        return false
    }

    private fun scheduleSaveModel() {
        saveJob?.cancel()
        saveJob = ioScope.launch {
            delay(SAVE_DEBOUNCE_MS)
            saveModel()
        }
    }

    private fun saveModel() {
        try {
            val json = StringBuilder()
            json.append("{")
            var first = true
            var size = 0

            synchronized(modelLock) {
                size = bigramModel.size
                for ((key, value) in bigramModel) {
                    if (!first) json.append(",")
                    json.append("\"$key\":[")
                    value.forEachIndexed { index, word ->
                        if (index > 0) json.append(",")
                        json.append("\"$word\"")
                    }
                    json.append("]")
                    first = false
                }
            }

            json.append("}")

            prefs.edit()
                .putString(PREFS_BIGRAM_KEY, json.toString())
                .putInt(PREFS_COUNT_KEY, size)
                .apply()
        } catch (e: Exception) {
        }
    }

    private fun loadModel() {
        try {
            val json = prefs.getString(PREFS_BIGRAM_KEY, null) ?: return

            val pairs = json.substring(1, json.length - 1).split("],")
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
                        .toMutableList()

                    if (values.isNotEmpty()) {
                        synchronized(modelLock) {
                            bigramModel[key] = values
                        }
                    }
                }
            }
        } catch (e: Exception) {
        }
    }

    fun clearModel() {
        saveJob?.cancel()
        synchronized(modelLock) {
            bigramModel.clear()
        }
        prefs.edit()
            .remove(PREFS_BIGRAM_KEY)
            .remove(PREFS_COUNT_KEY)
            .apply()
    }
}
