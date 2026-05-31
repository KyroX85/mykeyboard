package com.example.mykeyboard

import android.content.SharedPreferences
import com.example.mykeyboard.predictor.BasicPredictor
import com.example.mykeyboard.swipe.SwipeWordCandidate
import com.example.mykeyboard.swipe.SwipeWordResolver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SystemHardeningGuardrailsTest {

    @Test
    fun typingHotPathExcludesBlockingPersistenceNetworkAndJsonWork() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val hotPathMethods = listOf(
            "handleTouch",
            "commitTextKey",
            "commitSwipeSequence",
            "commitSpace",
            "commitEnter",
            "commitLongPressSymbol",
            "updateSuggestions"
        )
        val forbiddenTokens = listOf(
            "logEvent(",
            "JSONObject",
            "newCall(",
            ".execute()",
            "getSharedPreferences(",
            ".edit()",
            "saveModel(",
            "scope.launch"
        )

        for (methodName in hotPathMethods) {
            val body = methodBody(source, methodName)
            val methodForbidden = if (methodName == "commitSwipeSequence") {
                forbiddenTokens - "scope.launch"
            } else {
                forbiddenTokens
            }
            for (token in methodForbidden) {
                assertFalse("$methodName must not contain $token", body.contains(token))
            }
        }
    }

    @Test
    fun hapticHotPathUsesCachedServicesAndEffects() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val hapticBody = methodBody(source, "performKeyboardTapHaptic")

        assertFalse(hapticBody.contains("getSystemService("))
        assertFalse(hapticBody.contains("VibrationEffect.createOneShot"))
        assertTrue(hapticBody.contains("performHapticFeedback"))
        assertTrue(hapticBody.contains("cachedVibrator"))
        assertTrue(hapticBody.contains("if (profile.kind == HapticKind.Normal) return"))
        assertFalse(hapticBody.contains(".cancel()"))
        assertTrue(hapticBody.contains("hapticTapGate.shouldPulse"))
    }

    @Test
    fun productSignalBridgeUsesTimeoutsAndDropsWhenBusy() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/metrics/ProductSignalBridge.kt").readText()

        assertTrue(source.contains("CONNECT_TIMEOUT_MS"))
        assertTrue(source.contains("READ_TIMEOUT_MS"))
        assertTrue(source.contains("connectTimeout = CONNECT_TIMEOUT_MS"))
        assertTrue(source.contains("readTimeout = READ_TIMEOUT_MS"))
        assertTrue(source.contains("signalInFlight.compareAndSet(false, true)"))
        assertTrue(source.contains("signalInFlight.set(false)"))
    }

    @Test
    fun keySoundHotPathUsesCachedAudioManagerAndKeyboardEffects() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val soundBody = methodBody(source, "performKeyboardTapSound")
        val effectBody = methodBody(source, "soundEffectForKey")
        val applyPress = methodBody(source, "applyKeyPressFeedback")

        assertTrue(source.contains("cachedAudioManager"))
        assertFalse(source.contains("ToneGenerator"))
        assertFalse(source.contains("cachedToneGenerator"))
        assertFalse(soundBody.contains("getSystemService("))
        assertTrue(soundBody.contains("playSoundEffect"))
        assertFalse(soundBody.contains("startTone"))
        assertTrue(source.contains("KEY_SOUND_EFFECT_VOLUME"))
        assertFalse(source.contains("KEY_TONE_VOLUME_PERCENT"))
        assertFalse(source.contains("KEY_TONE_DURATION_MS"))
        assertTrue(effectBody.contains("FX_KEYPRESS_DELETE"))
        assertTrue(effectBody.contains("FX_KEYPRESS_RETURN"))
        assertTrue(effectBody.contains("FX_KEYPRESS_SPACEBAR"))
        assertTrue(effectBody.contains("FX_KEYPRESS_STANDARD"))
        assertTrue(applyPress.indexOf("performKeyboardTapSound(key)") < applyPress.indexOf("performKeyboardTapHaptic"))
    }

    @Test
    fun keyPressFeedbackAvoidsViewPropertyAnimatorAllocation() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val applyPress = methodBody(source, "applyKeyPressFeedback")
        val releasePress = methodBody(source, "releaseKeyPressFeedback")
        val swipePress = methodBody(source, "updateSwipePressedKey")

        assertFalse(applyPress.contains("animate()"))
        assertFalse(releasePress.contains("animate()"))
        assertFalse(swipePress.contains("animate()"))
        assertTrue(applyPress.contains("jumpDrawablesToCurrentState()"))
        assertTrue(applyPress.contains("scaleX = KEY_PRESS_SCALE"))
        assertTrue(releasePress.contains("scaleX = 1f"))
    }


    @Test
    fun symbolHintRenderingDoesNotInvalidateWhenValueIsUnchanged() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/HintKeyButton.kt").readText()
        val setSymbolHint = methodBody(source, "setSymbolHint")

        assertTrue(setSymbolHint.contains("if (symbolHint == hint) return"))
    }

    @Test
    fun lifecycleCleanupCancelsTransientTypingSurfacesAndGestures() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val cleanup = methodBody(source, "cleanupInputViewState")
        val requiredCalls = listOf(
            "cancelLongPress()",
            "stopRepeatingDelete()",
            "stopRepeatingSpace()",
            "dismissKeyPreviewSafely()",
            "dismissActivePopupSafely()",
            "cancelSwipeGesture()",
            "hapticTapGate.reset()"
        )

        for (call in requiredCalls) {
            assertTrue("cleanupInputViewState must call $call", cleanup.contains(call))
        }
    }

    @Test
    fun longPressSymbolCommitCancelsSwipeBeforeCommitting() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val body = methodBody(source, "commitLongPressSymbol")

        assertTrue(body.indexOf("cancelSwipeGesture()") in 0 until body.indexOf("commitTextSafely"))
        assertTrue(body.indexOf("dismissKeyPreviewSafely()") in 0 until body.indexOf("commitTextSafely"))
    }

    @Test
    fun swipeResolverKeepsDeterministicTierOrderAndCapsScoreInputs() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/swipe/SwipeWordResolver.kt").readText()

        assertTrue(source.indexOf("EXACT_PATH_TIER = 0") < source.indexOf("TRUSTED_LEARNED_TIER = 1"))
        assertTrue(source.indexOf("TRUSTED_LEARNED_TIER = 1") < source.indexOf("STRONG_WEIGHTED_PATH_TIER = 2"))
        assertTrue(source.indexOf("STRONG_RAW_PATH_TIER = 3") < source.indexOf("COMMON_FALLBACK_TIER = 4"))
        assertTrue(source.indexOf("COMMON_FALLBACK_TIER = 4") < source.indexOf("WEAK_RECOVERY_TIER = 5"))
        assertTrue(source.contains("cappedTrustScore"))
        assertTrue(source.contains("MIN_SAFE_FALLBACK_SCORE"))
        assertTrue(source.contains("isAmbiguousWeakRecovery"))
    }

    @Test
    fun swipeResolveAndSuggestionRefreshStayWithinRegressionBudget() {
        val resolver = SwipeWordResolver()
        val candidates = hardeningCandidates()
        val predictor = BasicPredictor(TestSharedPreferences(), CoroutineScope(Dispatchers.Unconfined))

        val swipeStartedAt = System.nanoTime()
        repeat(250) {
            resolver.resolve(listOf("ho", "hwo"), candidates)
            resolver.resolve(listOf("kmsh", "kuaamjsh"), candidates)
            resolver.resolve("qazplmokn", candidates)
        }
        val swipeMs = (System.nanoTime() - swipeStartedAt) / 1_000_000
        assertTrue("swipe resolve budget exceeded: ${swipeMs}ms", swipeMs < 1_500)

        val suggestionStartedAt = System.nanoTime()
        repeat(500) {
            predictor.getSuggestions("pre")
            predictor.getSuggestions("devel")
            predictor.getSuggestions("zxq")
        }
        val suggestionMs = (System.nanoTime() - suggestionStartedAt) / 1_000_000
        assertTrue("suggestion refresh budget exceeded: ${suggestionMs}ms", suggestionMs < 2_000)
    }

    @Test
    fun externalSwipeDictionaryLookupIsCachedAndBounded() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/predictor/BasicPredictor.kt").readText()
        val prefixLookup = methodBody(source, "findExternalDictionaryPrefixMatches")
        val swipeLookup = methodBody(source, "findExternalDictionarySwipeCandidates")
        val addMatches = methodBody(source, "addExternalSwipeMatches")

        assertTrue(source.contains("EXTERNAL_PREFIX_CACHE_LIMIT"))
        assertTrue(source.contains("externalPrefixCache"))
        assertTrue(prefixLookup.contains("readExternalPrefixCache"))
        assertTrue(prefixLookup.contains("writeExternalPrefixCache"))
        assertTrue(source.contains("EXTERNAL_SWIPE_CACHE_LIMIT"))
        assertTrue(source.contains("EXTERNAL_SWIPE_TIME_BUDGET_MS"))
        assertTrue(source.contains("externalSwipeCache"))
        assertTrue(swipeLookup.contains("readExternalSwipeCache"))
        assertTrue(swipeLookup.contains("writeExternalSwipeCache"))
        assertTrue(swipeLookup.contains("take(EXTERNAL_SWIPE_SEQUENCE_LIMIT)"))
        assertTrue(addMatches.contains("deadlineNanos"))
    }

    private fun hardeningCandidates(): List<SwipeWordCandidate> = listOf(
        SwipeWordCandidate("hi", frequency = 42),
        SwipeWordCandidate("how", frequency = 40),
        SwipeWordCandidate("this", frequency = 38),
        SwipeWordCandidate("you", frequency = 46),
        SwipeWordCandidate("because", frequency = 50),
        SwipeWordCandidate("hello", frequency = 36),
        SwipeWordCandidate("good", frequency = 34),
        SwipeWordCandidate("what", frequency = 34),
        SwipeWordCandidate("where", frequency = 32),
        SwipeWordCandidate("kaamesh", frequency = 12, acceptedCount = 3, trustedLearned = true)
    )

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }

    private fun methodBody(source: String, methodName: String): String {
        val start = source.indexOf("fun $methodName")
        require(start >= 0) { "Missing method $methodName" }
        val openBrace = source.indexOf('{', start)
        require(openBrace >= 0) { "Missing method body for $methodName" }

        var depth = 0
        for (index in openBrace until source.length) {
            when (source[index]) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return source.substring(openBrace + 1, index)
                }
            }
        }
        error("Unterminated method body for $methodName")
    }
}

private class TestSharedPreferences : SharedPreferences {
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
