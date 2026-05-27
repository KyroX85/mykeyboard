package com.example.mykeyboard.predictor

import android.content.SharedPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BasicPredictorTest {

    @Test
    fun prioritizesConversationalContext() {
        val predictor = newPredictor()

        val suggestions = predictor.getSuggestions("", "thank")

        assertEquals("you", suggestions.first())
    }

    @Test
    fun acceptedSuggestionsOutrankManualOneOffWords() {
        val predictor = newPredictor()
        predictor.clearModel()

        predictor.learnWord("yellow", "thank")
        predictor.learnAcceptedSuggestion("you", "thank")

        val suggestions = predictor.getSuggestions("y", "thank")

        assertEquals("you", suggestions.first())
    }

    @Test
    fun supportsBoundedTypoToleranceForTrustedWords() {
        val predictor = newPredictor()
        predictor.clearModel()

        predictor.learnAcceptedSuggestion("because")
        predictor.learnAcceptedSuggestion("hello")

        assertTrue(predictor.getSuggestions("becuase").contains("because"))
        assertTrue(predictor.getSuggestions("helo").contains("hello"))
    }

    @Test
    fun predictsCommonLongWordsFromBuiltInDictionary() {
        val predictor = newPredictor()

        assertEquals("hippopotamus", predictor.getSuggestions("hippo").firstOrNull())
        assertEquals("prediction", predictor.getSuggestions("pred").firstOrNull())
        assertEquals("beautiful", predictor.getSuggestions("beau").firstOrNull())
        assertEquals("conversation", predictor.getSuggestions("conver").firstOrNull())
        assertEquals("development", predictor.getSuggestions("devel").firstOrNull())
    }

    @Test
    fun builtInDictionarySupportsSwipeCandidates() {
        val predictor = newPredictor()

        assertEquals("conversation", predictor.getSwipeSuggestions("conversation").firstOrNull())
        assertEquals("development", predictor.getSwipeSuggestions("development").firstOrNull())
        assertEquals("architecture", predictor.getSwipeSuggestions("architecture").firstOrNull())
        assertEquals("understanding", predictor.getSwipeSuggestions("understanding").firstOrNull())
        assertEquals("information", predictor.getSwipeSuggestions("information").firstOrNull())
        assertEquals("confidence", predictor.getSwipeSuggestions("confidence").firstOrNull())
        assertEquals("between", predictor.getSwipeSuggestions("between").firstOrNull())
        assertEquals("tomorrow", predictor.getSwipeSuggestions("tomorrow").firstOrNull())
    }

    @Test
    fun swipeDiagnosticsExposeCandidatePresenceAndResolverRank() {
        val predictor = newPredictor()
        predictor.clearModel()

        val diagnostics = predictor.diagnoseSwipeSuggestions(
            sequences = listOf("arxhitecture"),
            intendedWord = "architecture"
        )

        assertTrue(diagnostics.candidatePoolSize > 0)
        assertTrue(diagnostics.intendedInCandidatePool)
        assertEquals(0, diagnostics.intendedResolvedRank)
        assertEquals("architecture", diagnostics.resolved.firstOrNull())
    }

    @Test
    fun builtInDictionaryRecoversNoisyCommonSwipeSequences() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertEquals("hi", predictor.getSwipeSuggestions("hui").firstOrNull())
        assertEquals("hi", predictor.getSwipeSuggestions("hji").firstOrNull())
        assertEquals("how", predictor.getSwipeSuggestions("hwo").firstOrNull())
        assertEquals("what", predictor.getSwipeSuggestions("wjat").firstOrNull())
        assertEquals("where", predictor.getSwipeSuggestions("whwre").firstOrNull())
        assertEquals("this", predictor.getSwipeSuggestions("tjis").firstOrNull())
        assertEquals("you", predictor.getSwipeSuggestions("yiu").firstOrNull())
        assertEquals("good", predictor.getSwipeSuggestions("gppd").firstOrNull())
        assertEquals("hello", predictor.getSwipeSuggestions("hrllo").firstOrNull())
        assertEquals("because", predictor.getSwipeSuggestions("becsuse").firstOrNull())
    }

    @Test
    fun learnedCustomWordsOutrankSafeFallbacksForPlausibleSwipeIntent() {
        val predictor = newPredictor()
        predictor.clearModel()

        repeat(4) {
            predictor.learnWord("kaamesh")
        }
        repeat(2) {
            predictor.learnAcceptedSuggestion("kaamesh")
        }

        assertEquals("kaamesh", predictor.getSwipeSuggestions("kqamesj").firstOrNull())
        assertEquals("kaamesh", predictor.getSwipeSuggestions("kamesh").firstOrNull())
        assertEquals("kaamesh", predictor.getSwipeSuggestions("kuaamjsh").firstOrNull())
        assertEquals("kaamesh", predictor.getSwipeSuggestions("kmsh").firstOrNull())
    }

    @Test
    fun builtInDictionaryBalancesMessySwipeToleranceWithGarbageRejection() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertEquals("hello", predictor.getSwipeSuggestions("hujello").firstOrNull())
        assertEquals("this", predictor.getSwipeSuggestions("tgjis").firstOrNull())
        assertEquals("good", predictor.getSwipeSuggestions("gipoid").firstOrNull())
        assertTrue(predictor.getSwipeSuggestions("qazplmokn").isEmpty())
        assertTrue(predictor.getSwipeSuggestions("zzzxxyqq").isEmpty())
    }

    @Test
    fun builtInDictionaryUsesSafeFallbackForWeakNoisySwipes() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertEquals("you", predictor.getSwipeSuggestions("uop").firstOrNull())
        assertEquals("what", predictor.getSwipeSuggestions("wjqt").firstOrNull())
    }

    @Test
    fun commonSwipeDictionaryDoesNotReturnEmptyForDailyWords() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertTrue(predictor.getSwipeSuggestions("hello").isNotEmpty())
        assertTrue(predictor.getSwipeSuggestions("keyboard").isNotEmpty())
        assertTrue(predictor.getSwipeSuggestions("typing").isNotEmpty())
        assertTrue(predictor.getSwipeSuggestions("because").isNotEmpty())
        assertTrue(predictor.getSwipeSuggestions("where").isNotEmpty())
    }

    @Test
    fun commonWordPrefixesDoNotReturnEmptySuggestions() {
        val predictor = newPredictor()

        assertTrue(predictor.getSuggestions("hippo").isNotEmpty())
        assertTrue(predictor.getSuggestions("pred").isNotEmpty())
        assertTrue(predictor.getSuggestions("beau").isNotEmpty())
        assertTrue(predictor.getSuggestions("conver").isNotEmpty())
        assertTrue(predictor.getSuggestions("devel").isNotEmpty())
    }

    @Test
    fun autocorrectsObviousNeighborKeyTypos() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertEquals("hi", predictor.getAutocorrection("hui"))
        assertEquals("hi", predictor.getAutocorrection("hji"))
        assertEquals("this", predictor.getAutocorrection("tjis"))
        assertEquals("you", predictor.getAutocorrection("yiu"))
        assertEquals("the", predictor.getAutocorrection("teh"))
    }

    @Test
    fun autocorrectsRepeatedLettersConservatively() {
        val predictor = newPredictor()
        predictor.clearModel()
        predictor.learnAcceptedSuggestion("gboard")

        assertEquals("hello", predictor.getAutocorrection("helllo"))
        assertEquals("gboard", predictor.getAutocorrection("gboardd"))
    }

    @Test
    fun keepsLowConfidenceAndUserWordsUnchanged() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertEquals(null, predictor.getAutocorrection("kaamesh"))
        assertEquals(null, predictor.getAutocorrection("bgmi"))
        assertEquals(null, predictor.getAutocorrection("valorant"))

        predictor.learnWord("kaamesh")
        predictor.learnWord("bgmi")
        predictor.learnWord("valorant")

        assertEquals(null, predictor.getAutocorrection("kaamesh"))
        assertEquals(null, predictor.getAutocorrection("bgmi"))
        assertEquals(null, predictor.getAutocorrection("valorant"))
    }

    @Test
    fun suppressesLowTrustShortAutocorrectsToReduceImmediateUndoRisk() {
        val predictor = newPredictor()
        predictor.clearModel()

        predictor.learnWord("hive")
        predictor.learnWord("hire")
        predictor.learnWord("hide")

        assertEquals(null, predictor.getAutocorrection("hie"))
    }

    @Test
    fun keepsHighConfidenceNeighborTypoAutocorrects() {
        val predictor = newPredictor()
        predictor.clearModel()

        assertEquals("you", predictor.getAutocorrection("yiu"))
        assertEquals("this", predictor.getAutocorrection("tjis"))
    }

    @Test
    fun suppressesUnrelatedFillerWhileTyping() {
        val predictor = newPredictor()
        predictor.clearModel()
        predictor.learnAcceptedSuggestion("pipeline")

        val suggestions = predictor.getSuggestions("zxq")

        assertTrue(suggestions.isEmpty())
    }

    @Test
    fun resolvesSwipeSequenceFromLocalDictionary() {
        val predictor = newPredictor()
        predictor.clearModel()
        repeat(3) {
            predictor.learnAcceptedSuggestion("this")
        }
        predictor.learnWord("thus")

        val suggestions = predictor.getSwipeSuggestions("ths")

        assertEquals("this", suggestions.firstOrNull())
    }

    @Test
    fun resolvesSwipeSequenceWithExtraIntermediateKeys() {
        val predictor = newPredictor()
        predictor.clearModel()
        repeat(3) {
            predictor.learnAcceptedSuggestion("this")
        }

        val suggestions = predictor.getSwipeSuggestions("tghis")

        assertEquals("this", suggestions.firstOrNull())
    }

    @Test
    fun rejectsNoisyTokensFromLearning() {
        val predictor = newPredictor()
        predictor.clearModel()

        predictor.learnWord("https://example.com")
        predictor.learnWord("kkkk")
        predictor.learnWord("abc123")

        assertTrue(predictor.getSuggestions("htt").isEmpty())
        assertTrue(predictor.getSuggestions("kkk").isEmpty())
        assertTrue(predictor.getSuggestions("abc").isEmpty())
    }

    @Test
    fun backspaceAfterAcceptanceReducesSuggestionConfidence() {
        val predictor = newPredictor()
        predictor.clearModel()

        repeat(2) {
            predictor.learnAcceptedSuggestion("pipeline", "automation")
        }
        predictor.learnAcceptedSuggestion("pilot", "automation")
        assertEquals("pipeline", predictor.getSuggestions("pi", "automation").first())

        repeat(3) {
            predictor.reduceAcceptedSuggestionConfidence("pipeline", "automation")
        }

        assertFalse(predictor.getSuggestions("pi", "automation").first() == "pipeline")
    }

    @Test
    fun learnedWordsDoNotRewriteModelUntilExplicitFlush() {
        val prefs = InMemorySharedPreferences()
        val predictor = BasicPredictor(prefs, CoroutineScope(Dispatchers.Unconfined))
        predictor.clearModel()

        predictor.learnWord("pipeline")
        predictor.learnAcceptedSuggestion("keyboard")

        assertFalse(prefs.contains("predictor_model_v2"))

        predictor.flushPendingSave()

        assertTrue(prefs.contains("predictor_model_v2"))
    }

    @Test
    fun persistedModelRemainsBoundedAfterLargeLearningSession() {
        val prefs = InMemorySharedPreferences()
        val predictor = BasicPredictor(prefs, CoroutineScope(Dispatchers.Unconfined))
        predictor.clearModel()

        repeat(2_500) { index ->
            val word = boundedWord(index)
            predictor.learnWord(word)
            predictor.learnAcceptedSuggestion(word)
        }

        predictor.flushPendingSave()

        val persisted = prefs.getString("predictor_model_v2", null)
        assertTrue(persisted != null)
        assertTrue(persisted!!.length <= 120_000)
    }

    @Test
    fun oversizedOrCorruptPersistedModelIsClearedSafely() {
        val oversizedPrefs = InMemorySharedPreferences()
        oversizedPrefs.edit()
            .putString("predictor_model_v2", "x".repeat(120_001))
            .apply()

        BasicPredictor(oversizedPrefs, CoroutineScope(Dispatchers.Unconfined))

        assertFalse(oversizedPrefs.contains("predictor_model_v2"))

        val corruptPrefs = InMemorySharedPreferences()
        corruptPrefs.edit()
            .putString("predictor_model_v2", "{not-json")
            .apply()

        BasicPredictor(corruptPrefs, CoroutineScope(Dispatchers.Unconfined))

        assertFalse(corruptPrefs.contains("predictor_model_v2"))
    }

    private fun newPredictor(): BasicPredictor =
        BasicPredictor(InMemorySharedPreferences(), CoroutineScope(Dispatchers.Unconfined))

    private fun boundedWord(index: Int): String {
        val first = 'a' + (index % 26)
        val second = 'a' + ((index / 26) % 26)
        val third = 'a' + ((index / (26 * 26)) % 26)
        return "wa${first}${second}${third}"
    }
}

private class InMemorySharedPreferences : SharedPreferences {
    private val values = mutableMapOf<String, Any>()

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? =
        values[key] as? String ?: defValue

    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
        @Suppress("UNCHECKED_CAST")
        (values[key] as? Set<String>)?.toMutableSet() ?: defValues

    override fun getInt(key: String?, defValue: Int): Int =
        values[key] as? Int ?: defValue

    override fun getLong(key: String?, defValue: Long): Long =
        values[key] as? Long ?: defValue

    override fun getFloat(key: String?, defValue: Float): Float =
        values[key] as? Float ?: defValue

    override fun getBoolean(key: String?, defValue: Boolean): Boolean =
        values[key] as? Boolean ?: defValue

    override fun contains(key: String?): Boolean = values.containsKey(key)

    override fun edit(): SharedPreferences.Editor = Editor()

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) = Unit

    private inner class Editor : SharedPreferences.Editor {
        private val updates = mutableMapOf<String, Any?>()
        private var clearAll = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = value
        }

        override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = values?.toSet()
        }

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = value
        }

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = value
        }

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = value
        }

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = value
        }

        override fun remove(key: String?): SharedPreferences.Editor = apply {
            if (key != null) updates[key] = null
        }

        override fun clear(): SharedPreferences.Editor = apply {
            clearAll = true
        }

        override fun commit(): Boolean {
            apply()
            return true
        }

        override fun apply() {
            if (clearAll) values.clear()
            for ((key, value) in updates) {
                if (value == null) {
                    values.remove(key)
                } else {
                    values[key] = value
                }
            }
        }
    }
}
