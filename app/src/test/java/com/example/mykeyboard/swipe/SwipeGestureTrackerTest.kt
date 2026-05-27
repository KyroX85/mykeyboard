package com.example.mykeyboard.swipe

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SwipeGestureTrackerTest {

    @Test
    fun doesNotActivateForSmallTapMovement() {
        val tracker = SwipeGestureTracker(activationSlopPx = 18f, minSampleDistancePx = 4f)

        tracker.start(10f, 10f, 't')
        tracker.move(18f, 12f, 't')

        assertFalse(tracker.isActive)
        assertEquals("", tracker.finish())
    }

    @Test
    fun buildsSequenceWhenDragCrossesNewLetterKeys() {
        val tracker = SwipeGestureTracker(activationSlopPx = 10f, minSampleDistancePx = 4f)

        tracker.start(0f, 0f, 't')
        assertTrue(tracker.move(12f, 0f, 't'))
        assertTrue(tracker.move(28f, 4f, 'h'))
        tracker.move(32f, 6f, 'h')
        assertTrue(tracker.move(48f, 10f, 'i'))
        assertTrue(tracker.move(64f, 12f, 's'))

        assertEquals("this", tracker.finish())
    }

    @Test
    fun weightedSequenceSuppressesLowIntentTransitKeys() {
        val tracker = SwipeGestureTracker(activationSlopPx = 4f, minSampleDistancePx = 1f)

        tracker.start(0f, 0f, 'h', eventTimeMs = 0L, pressure = 0.75f, touchMajor = 12f)
        tracker.move(1f, 0f, 'h', eventTimeMs = 70L, pressure = 0.82f, touchMajor = 13f)
        tracker.move(18f, 0f, 'u', eventTimeMs = 76L, pressure = 0.25f, touchMajor = 7f)
        tracker.move(28f, 0f, 'j', eventTimeMs = 82L, pressure = 0.22f, touchMajor = 7f)
        tracker.move(34f, 0f, 'i', eventTimeMs = 152L, pressure = 0.8f, touchMajor = 13f)
        tracker.move(35f, 0f, 'i', eventTimeMs = 210L, pressure = 0.84f, touchMajor = 14f)

        assertEquals("huji", tracker.keySequence)
        assertEquals("hi", tracker.finish())
    }

    @Test
    fun finishGesturePreservesRawAndWeightedPathsForHybridResolution() {
        val tracker = SwipeGestureTracker(activationSlopPx = 4f, minSampleDistancePx = 1f)

        tracker.start(0f, 0f, 'h', eventTimeMs = 0L, pressure = 0.75f, touchMajor = 12f)
        tracker.move(1f, 0f, 'h', eventTimeMs = 70L, pressure = 0.82f, touchMajor = 13f)
        tracker.move(18f, 0f, 'u', eventTimeMs = 76L, pressure = 0.25f, touchMajor = 7f)
        tracker.move(28f, 0f, 'j', eventTimeMs = 82L, pressure = 0.22f, touchMajor = 7f)
        tracker.move(34f, 0f, 'i', eventTimeMs = 152L, pressure = 0.8f, touchMajor = 13f)
        tracker.move(35f, 0f, 'i', eventTimeMs = 210L, pressure = 0.84f, touchMajor = 14f)

        val result = tracker.finishGesture()

        assertEquals("huji", result.rawSequence)
        assertEquals("hi", result.weightedSequence)
        assertEquals(listOf("hi", "huji"), result.resolutionSequences)
    }

    @Test
    fun weightedSequenceKeepsTransitKeysWhenIntentIsAmbiguous() {
        val tracker = SwipeGestureTracker(activationSlopPx = 4f, minSampleDistancePx = 1f)

        tracker.start(0f, 0f, 'h', eventTimeMs = 0L, pressure = 0.4f, touchMajor = 8f)
        tracker.move(10f, 0f, 'h', eventTimeMs = 20L, pressure = 0.42f, touchMajor = 8f)
        tracker.move(20f, 0f, 'u', eventTimeMs = 40L, pressure = 0.4f, touchMajor = 8f)
        tracker.move(30f, 0f, 'j', eventTimeMs = 60L, pressure = 0.41f, touchMajor = 8f)
        tracker.move(40f, 0f, 'i', eventTimeMs = 80L, pressure = 0.4f, touchMajor = 8f)

        assertEquals("huji", tracker.finish())
    }

    @Test
    fun weightedSequenceKeepsDominantIntendedKeysForCommonWords() {
        val tracker = SwipeGestureTracker(activationSlopPx = 4f, minSampleDistancePx = 1f)

        tracker.start(0f, 0f, 'h', eventTimeMs = 0L, pressure = 0.72f, touchMajor = 12f)
        tracker.move(2f, 0f, 'h', eventTimeMs = 64L, pressure = 0.8f, touchMajor = 13f)
        tracker.move(16f, 0f, 'w', eventTimeMs = 70L, pressure = 0.24f, touchMajor = 7f)
        tracker.move(28f, 0f, 'o', eventTimeMs = 136L, pressure = 0.78f, touchMajor = 13f)
        tracker.move(29f, 0f, 'o', eventTimeMs = 192L, pressure = 0.84f, touchMajor = 14f)

        assertEquals("hwo", tracker.keySequence)
        assertEquals("ho", tracker.finish())
    }

    @Test
    fun longSequencesKeepAtLeastThreeIntentKeysForResolverStability() {
        val tracker = SwipeGestureTracker(activationSlopPx = 4f, minSampleDistancePx = 1f)

        tracker.start(0f, 0f, 'c', eventTimeMs = 0L, pressure = 0.72f, touchMajor = 12f)
        tracker.move(1f, 0f, 'c', eventTimeMs = 62L, pressure = 0.82f, touchMajor = 13f)
        tracker.move(10f, 0f, 'o', eventTimeMs = 70L, pressure = 0.22f, touchMajor = 7f)
        tracker.move(20f, 0f, 'n', eventTimeMs = 78L, pressure = 0.22f, touchMajor = 7f)
        tracker.move(30f, 0f, 'v', eventTimeMs = 130L, pressure = 0.76f, touchMajor = 12f)
        tracker.move(40f, 0f, 'e', eventTimeMs = 138L, pressure = 0.22f, touchMajor = 7f)
        tracker.move(50f, 0f, 'r', eventTimeMs = 146L, pressure = 0.22f, touchMajor = 7f)
        tracker.move(60f, 0f, 's', eventTimeMs = 198L, pressure = 0.8f, touchMajor = 13f)

        val gesture = tracker.finishGesture()
        assertTrue(gesture.rawSequence.length >= 6)
        assertTrue(gesture.weightedSequence.length >= 2)
        assertTrue(gesture.resolutionSequences.size >= 2)
    }

    @Test
    fun boundsStoredPointsDuringLongGesture() {
        val tracker = SwipeGestureTracker(
            activationSlopPx = 1f,
            minSampleDistancePx = 1f,
            maxPoints = 8
        )

        tracker.start(0f, 0f, 'a')
        for (index in 1..40) {
            tracker.move(index.toFloat(), 0f, 'a')
        }

        assertTrue(tracker.pointCount <= 8)
    }

    @Test
    fun reportsPointCapWhenLongGestureExceedsStorageBudget() {
        val tracker = SwipeGestureTracker(
            activationSlopPx = 1f,
            minSampleDistancePx = 1f,
            maxPoints = 8
        )
        val keys = charArrayOf('a', 'r', 'c', 'h', 'i', 't', 'e', 'c', 't', 'u', 'r', 'e')

        tracker.start(0f, 0f, keys.first())
        for (index in 1..60) {
            tracker.move(
                index.toFloat(),
                0f,
                keys[index % keys.size],
                eventTimeMs = index * 8L,
                pressure = 0.5f,
                touchMajor = 10f
            )
        }

        val result = tracker.finishGesture()

        assertTrue(result.pointCapHit)
        assertEquals(8, result.storedPointCount)
        assertTrue(result.sampledPointCount > result.storedPointCount)
        assertTrue(result.gestureLengthPx > 0f)
    }
}
