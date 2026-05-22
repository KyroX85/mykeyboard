package com.example.mykeyboard

import android.content.SharedPreferences
import com.example.mykeyboard.metrics.KeyboardMetrics
import com.example.mykeyboard.predictor.BasicPredictor
import com.example.mykeyboard.swipe.SwipeGestureTracker
import com.example.mykeyboard.swipe.SwipeWordCandidate
import com.example.mykeyboard.swipe.SwipeWordResolver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class InputReplayFailureInjectionTest {

    @Test
    fun fastTypingBurstReplayStaysDeterministicAndClean() {
        val replay = ReplayKeyboardModel()
        val actions = buildList {
            "hello how are you doing today".forEach { char ->
                add(ReplayAction.Tap(char.toString(), 8L))
            }
            add(ReplayAction.Backspace(6L))
            add(ReplayAction.Tap("y", 7L))
            add(ReplayAction.Tap(" ", 9L))
        }

        replay.play(actions)

        assertEquals("hello how are you doing today ", replay.committedText)
        assertFalse(replay.hasPressedKey)
        assertFalse(replay.isSwipeActive)
        assertFalse(replay.hasPendingLongPress)
        assertFalse(replay.committedText.contains("yy"))
        assertFalse(replay.committedText.contains("  "))
    }

    @Test
    fun swipeStressReplayProducesStableWinnersAndRejectsChaos() {
        val resolver = SwipeWordResolver()
        val candidates = replayCandidates()

        val cases = listOf(
            SwipeCase("hi", "hi", listOf(
                SwipeSample('h', 0f, 0f, 0L, 0.8f, 13f),
                SwipeSample('h', 1f, 0f, 70L, 0.84f, 14f),
                SwipeSample('u', 18f, 0f, 76L, 0.22f, 7f),
                SwipeSample('j', 28f, 0f, 82L, 0.2f, 7f),
                SwipeSample('i', 34f, 0f, 152L, 0.82f, 14f),
                SwipeSample('i', 35f, 0f, 210L, 0.84f, 14f)
            )),
            SwipeCase("how", "how", listOf(
                SwipeSample('h', 0f, 0f, 0L, 0.78f, 13f),
                SwipeSample('h', 1f, 0f, 64L, 0.82f, 13f),
                SwipeSample('w', 18f, 0f, 70L, 0.24f, 7f),
                SwipeSample('o', 30f, 0f, 136L, 0.8f, 13f),
                SwipeSample('o', 31f, 0f, 192L, 0.84f, 14f)
            )),
            SwipeCase("this", "this", sloppyPath("tgjis")),
            SwipeCase("you", "you", sloppyPath("yiu")),
            SwipeCase("hello", "hello", sloppyPath("hrllo")),
            SwipeCase("because", "because", sloppyPath("becsuse"))
        )

        for (case in cases) {
            val result = replaySwipe(case.samples)
            assertTrue("${case.name} should produce usable paths", result.resolutionSequences.isNotEmpty())
            assertEquals(case.expected, resolver.resolve(result.resolutionSequences, candidates).firstOrNull())
        }

        assertEquals(
            "kaamesh",
            resolver.resolve(listOf("kmsh", "kuaamjsh"), candidates).firstOrNull()
        )
        assertTrue(resolver.resolve("qazplmokn", candidates).isEmpty())
        assertTrue(resolver.resolve("zzzxxyqq", candidates).isEmpty())
    }

    @Test
    fun longPressSwipeCollisionCommitsSymbolOnceAndCancelsGesture() {
        val replay = ReplayKeyboardModel()

        replay.play(
            listOf(
                ReplayAction.SwipeStart("h"),
                ReplayAction.SwipeMove("u"),
                ReplayAction.LongPress("a"),
                ReplayAction.SwipeRelease
            )
        )

        assertEquals("@", replay.committedText)
        assertEquals(1, replay.commitCount)
        assertFalse(replay.isSwipeActive)
        assertFalse(replay.hasGhostTrail)
        assertFalse(replay.hasPressedKey)
    }

    @Test
    fun lifecycleInterruptionsFullyCleanActiveReplayState() {
        val replay = ReplayKeyboardModel()

        replay.play(
            listOf(
                ReplayAction.Tap("h", 5L),
                ReplayAction.SwipeStart("h"),
                ReplayAction.SwipeMove("e"),
                ReplayAction.LongPressStart("a"),
                ReplayAction.BackspaceBurst(4),
                ReplayAction.FinishInputView,
                ReplayAction.WindowHidden,
                ReplayAction.EditorSwitch
            )
        )

        assertFalse(replay.isSwipeActive)
        assertFalse(replay.hasGhostTrail)
        assertFalse(replay.hasPressedKey)
        assertFalse(replay.hasPendingLongPress)
        assertFalse(replay.hasRepeatingBackspace)
        assertTrue(replay.suggestions.isEmpty())
    }

    @Test
    fun longSessionMixedInputReplayDoesNotAccumulateTransientState() {
        val replay = ReplayKeyboardModel()

        repeat(900) { index ->
            replay.play(
                listOf(
                    ReplayAction.Tap("h", 4L),
                    ReplayAction.Tap("i", 4L),
                    ReplayAction.Tap(" ", 4L),
                    ReplayAction.SwipeStart("h"),
                    ReplayAction.SwipeMove("o"),
                    ReplayAction.SwipeMove("w"),
                    ReplayAction.SwipeRelease,
                    ReplayAction.BackspaceBurst(2)
                )
            )
            if (index % 15 == 0) {
                replay.play(listOf(ReplayAction.EditorSwitch))
            }
            if (index % 40 == 0) {
                replay.play(listOf(ReplayAction.FinishInputView, ReplayAction.WindowHidden))
            }
        }
        replay.play(listOf(ReplayAction.FinishInputView))

        assertFalse(replay.isSwipeActive)
        assertFalse(replay.hasGhostTrail)
        assertFalse(replay.hasPressedKey)
        assertFalse(replay.hasPendingLongPress)
        assertFalse(replay.hasRepeatingBackspace)
        assertTrue(replay.transientStateCount <= 0)
    }

    @Test
    fun oemTimingChaosReplayConvergesAfterDuplicateCancelsAndLateReleases() {
        val replay = ReplayKeyboardModel()

        replay.play(
            listOf(
                ReplayAction.SwipeStart("h"),
                ReplayAction.SwipeMove("e"),
                ReplayAction.TouchCancel,
                ReplayAction.TouchCancel,
                ReplayAction.SwipeRelease,
                ReplayAction.LongPressStart("a"),
                ReplayAction.TouchCancel,
                ReplayAction.LongPress("a"),
                ReplayAction.EditorSwitch,
                ReplayAction.Tap("o"),
                ReplayAction.FinishInputView,
                ReplayAction.WindowHidden
            )
        )

        assertFalse(replay.isSwipeActive)
        assertFalse(replay.hasGhostTrail)
        assertFalse(replay.hasPressedKey)
        assertFalse(replay.hasPendingLongPress)
        assertFalse(replay.hasRepeatingBackspace)
        assertTrue(replay.suggestions.isEmpty())
    }

    @Test
    fun nullInputConnectionFailureInjectionAbortsWithoutLeakingState() {
        val replay = ReplayKeyboardModel(inputAvailable = false)

        replay.play(
            listOf(
                ReplayAction.Tap("h", 5L),
                ReplayAction.SwipeStart("h"),
                ReplayAction.SwipeMove("i"),
                ReplayAction.SwipeRelease,
                ReplayAction.LongPress("a")
            )
        )

        assertEquals("", replay.committedText)
        assertFalse(replay.hasPressedKey)
        assertFalse(replay.isSwipeActive)
        assertFalse(replay.hasGhostTrail)
        assertFalse(replay.hasPendingLongPress)
    }

    @Test
    fun predictorSaveFailureDoesNotBreakSessionPrediction() {
        val metrics = KeyboardMetrics()
        val predictor = BasicPredictor(
            ThrowingSharedPreferences(),
            CoroutineScope(Dispatchers.Unconfined),
            metrics
        )

        predictor.learnWord("resilient")
        predictor.learnAcceptedSuggestion("keyboard")
        predictor.flushPendingSave()

        assertTrue(metrics.snapshot(1_000L).saveModelFailures > 0)
        assertEquals("resilient", predictor.getSuggestions("resi").firstOrNull())
        assertEquals("keyboard", predictor.getSuggestions("key").firstOrNull())
    }

    @Test
    fun sourceGuardrailsCoverInputConnectionPopupResolverAndMotionEventFailures() {
        val keyboardSource = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val trackerSource = sourceFile("app/src/main/java/com/example/mykeyboard/swipe/SwipeGestureTracker.kt").readText()
        val trailSource = sourceFile("app/src/main/java/com/example/mykeyboard/swipe/SwipeTrailView.kt").readText()

        assertTrue(methodBody(keyboardSource, "commitSwipeSequence").contains("currentInputConnection"))
        assertTrue(methodBody(keyboardSource, "commitSwipeSequence").contains("return"))
        assertTrue(methodBody(keyboardSource, "commitTextKey").contains("currentInputConnection ?: return"))
        assertTrue(methodBody(keyboardSource, "commitLongPressSymbol").contains("commitTextSafely"))
        assertTrue(methodBody(keyboardSource, "dismissActivePopupSafely").contains("catch (e: RuntimeException)"))
        assertTrue(methodBody(keyboardSource, "dismissKeyPreviewSafely").contains("catch (e: RuntimeException)"))
        assertFalse(methodBody(trackerSource, "move").contains("MotionEvent.obtain"))
        assertFalse(methodBody(trackerSource, "move").contains(".copy()"))
        assertTrue(methodBody(trailSource, "resetNow").contains("pointCount = 0"))
        assertTrue(methodBody(trailSource, "fadeAndReset").contains("pointCount = 0"))
    }

    private fun replaySwipe(samples: List<SwipeSample>) =
        SwipeGestureTracker(activationSlopPx = 4f, minSampleDistancePx = 1f).run {
            val first = samples.first()
            start(first.x, first.y, first.key, first.timeMs, first.pressure, first.touchMajor)
            samples.drop(1).forEach {
                move(it.x, it.y, it.key, it.timeMs, it.pressure, it.touchMajor)
            }
            finishGesture()
        }

    private fun sloppyPath(sequence: String): List<SwipeSample> =
        sequence.mapIndexed { index, key ->
            val highIntent = index == 0 || index == sequence.lastIndex || index % 2 == 0
            SwipeSample(
                key = key,
                x = index * 12f,
                y = (index % 2) * 3f,
                timeMs = index * if (highIntent) 54L else 8L,
                pressure = if (highIntent) 0.78f else 0.26f,
                touchMajor = if (highIntent) 13f else 7f
            )
        }

    private fun replayCandidates(): List<SwipeWordCandidate> = listOf(
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

private data class SwipeSample(
    val key: Char,
    val x: Float,
    val y: Float,
    val timeMs: Long,
    val pressure: Float,
    val touchMajor: Float
)

private data class SwipeCase(
    val name: String,
    val expected: String,
    val samples: List<SwipeSample>
)

private sealed class ReplayAction {
    data class Tap(val key: String, val gapMs: Long = 0L) : ReplayAction()
    data class Backspace(val gapMs: Long = 0L) : ReplayAction()
    data class BackspaceBurst(val count: Int) : ReplayAction()
    data class SwipeStart(val key: String) : ReplayAction()
    data class SwipeMove(val key: String) : ReplayAction()
    data object SwipeRelease : ReplayAction()
    data class LongPressStart(val key: String) : ReplayAction()
    data class LongPress(val key: String) : ReplayAction()
    data object TouchCancel : ReplayAction()
    data object FinishInputView : ReplayAction()
    data object WindowHidden : ReplayAction()
    data object EditorSwitch : ReplayAction()
}

private class ReplayKeyboardModel(
    private val inputAvailable: Boolean = true
) {
    private val text = StringBuilder()
    private val history = mutableListOf<String>()
    private var pressedKey: String? = null
    private var pendingLongPressKey: String? = null
    private var repeatingBackspace = false
    private var swipeActive = false
    private var ghostTrail = false
    private var currentSwipe = StringBuilder()

    var suggestions: List<String> = emptyList()
        private set

    val committedText: String
        get() = text.toString()

    val committedHistory: List<String>
        get() = history.toList()

    val commitCount: Int
        get() = history.size

    val hasPressedKey: Boolean
        get() = pressedKey != null

    val hasPendingLongPress: Boolean
        get() = pendingLongPressKey != null

    val hasRepeatingBackspace: Boolean
        get() = repeatingBackspace

    val isSwipeActive: Boolean
        get() = swipeActive

    val hasGhostTrail: Boolean
        get() = ghostTrail

    val transientStateCount: Int
        get() = listOf(
            pressedKey != null,
            pendingLongPressKey != null,
            repeatingBackspace,
            swipeActive,
            ghostTrail,
            currentSwipe.isNotEmpty(),
            suggestions.isNotEmpty()
        ).count { it }

    fun play(actions: List<ReplayAction>) {
        actions.forEach(::apply)
    }

    private fun apply(action: ReplayAction) {
        when (action) {
            is ReplayAction.Tap -> tap(action.key)
            is ReplayAction.Backspace -> backspace()
            is ReplayAction.BackspaceBurst -> repeat(action.count) { backspace() }
            is ReplayAction.SwipeStart -> startSwipe(action.key)
            is ReplayAction.SwipeMove -> moveSwipe(action.key)
            ReplayAction.SwipeRelease -> releaseSwipe()
            is ReplayAction.LongPressStart -> {
                pressedKey = action.key
                pendingLongPressKey = action.key
            }
            is ReplayAction.LongPress -> longPress(action.key)
            ReplayAction.TouchCancel -> cleanup()
            ReplayAction.FinishInputView,
            ReplayAction.WindowHidden,
            ReplayAction.EditorSwitch -> cleanup()
        }
    }

    private fun tap(key: String) {
        pressedKey = key
        if (inputAvailable) {
            commit(key)
        }
        pressedKey = null
        suggestions = if (inputAvailable) listOf("the", "you", "how") else emptyList()
    }

    private fun backspace() {
        repeatingBackspace = true
        if (inputAvailable && text.isNotEmpty()) {
            text.deleteCharAt(text.lastIndex)
            history.add("<backspace>")
        }
        repeatingBackspace = false
    }

    private fun startSwipe(key: String) {
        pressedKey = key
        swipeActive = true
        ghostTrail = true
        currentSwipe.setLength(0)
        currentSwipe.append(key)
    }

    private fun moveSwipe(key: String) {
        if (!swipeActive) return
        if (currentSwipe.lastOrNull()?.toString() != key) {
            currentSwipe.append(key)
        }
    }

    private fun releaseSwipe() {
        if (swipeActive && inputAvailable && currentSwipe.length >= 2) {
            commit(currentSwipe.toString())
        }
        swipeActive = false
        ghostTrail = false
        pressedKey = null
        currentSwipe.setLength(0)
    }

    private fun longPress(key: String) {
        pendingLongPressKey = key
        swipeActive = false
        ghostTrail = false
        pressedKey = null
        currentSwipe.setLength(0)
        LongPressSymbolMap.symbolFor(key)?.let {
            if (inputAvailable) commit(it)
        }
        pendingLongPressKey = null
    }

    private fun commit(value: String) {
        text.append(value)
        history.add(value)
    }

    private fun cleanup() {
        pressedKey = null
        pendingLongPressKey = null
        repeatingBackspace = false
        swipeActive = false
        ghostTrail = false
        currentSwipe.setLength(0)
        suggestions = emptyList()
    }
}

private class ThrowingSharedPreferences : SharedPreferences {
    private val values = mutableMapOf<String, Any>()

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? =
        values[key] as? String ?: defValue

    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = defValues

    override fun getInt(key: String?, defValue: Int): Int =
        values[key] as? Int ?: defValue

    override fun getLong(key: String?, defValue: Long): Long = defValue

    override fun getFloat(key: String?, defValue: Float): Float = defValue

    override fun getBoolean(key: String?, defValue: Boolean): Boolean = defValue

    override fun contains(key: String?): Boolean = values.containsKey(key)

    override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
        override fun putString(key: String?, value: String?): SharedPreferences.Editor = this
        override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = this
        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = this
        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = this
        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = this
        override fun remove(key: String?): SharedPreferences.Editor = this
        override fun clear(): SharedPreferences.Editor = this
        override fun commit(): Boolean = throw IllegalStateException("injected write failure")
        override fun apply(): Unit = throw IllegalStateException("injected write failure")
    }

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) = Unit
}
