package com.example.mykeyboard.swipe

class SwipeGestureTracker(
    private val activationSlopPx: Float,
    private val minSampleDistancePx: Float,
    private val maxPoints: Int = DEFAULT_MAX_POINTS,
    private val maxSequenceLength: Int = DEFAULT_MAX_SEQUENCE_LENGTH
) {
    private val xs = FloatArray(maxPoints)
    private val ys = FloatArray(maxPoints)
    private val sequence = StringBuilder(maxSequenceLength)
    private val weightedSequence = StringBuilder(maxSequenceLength)
    private val intentDebugBuilder = StringBuilder(maxSequenceLength * 12)
    private val keyDwellMs = LongArray(KEY_COUNT)
    private val keySampleCounts = IntArray(KEY_COUNT)
    private val keyPressureTotals = FloatArray(KEY_COUNT)
    private val keyTouchMajorTotals = FloatArray(KEY_COUNT)
    private val keySlowdownTotals = FloatArray(KEY_COUNT)
    private val activationSlopSq = activationSlopPx * activationSlopPx
    private val minSampleDistanceSq = minSampleDistancePx * minSampleDistancePx

    private var startX = 0f
    private var startY = 0f
    private var lastSampleX = 0f
    private var lastSampleY = 0f
    private var lastMoveX = 0f
    private var lastMoveY = 0f
    private var lastEventTimeMs = 0L
    private var currentIntentKey: Char = NO_KEY
    private var lastKey: Char = NO_KEY
    private var hasIntentSignals = false
    private var pointCapHit = false
    private var totalPointSamples = 0
    private var totalDistancePx = 0f

    var isActive: Boolean = false
        private set

    var pointCount: Int = 0
        private set

    val keySequence: String
        get() = sequence.toString()

    fun start(x: Float, y: Float, key: Char) {
        start(x, y, key, eventTimeMs = 0L, pressure = 0f, touchMajor = 0f)
        hasIntentSignals = false
    }

    fun start(x: Float, y: Float, key: Char, eventTimeMs: Long, pressure: Float, touchMajor: Float) {
        reset()
        startX = x
        startY = y
        lastSampleX = x
        lastSampleY = y
        lastMoveX = x
        lastMoveY = y
        lastEventTimeMs = eventTimeMs
        lastKey = cleanKey(key)
        currentIntentKey = lastKey
        hasIntentSignals = eventTimeMs > 0L || pressure > 0f || touchMajor > 0f
        recordIntentSample(lastKey, pressure, touchMajor, slowdown = 0f)
        appendPoint(x, y)
    }

    fun move(x: Float, y: Float, key: Char): Boolean {
        return move(x, y, key, eventTimeMs = 0L, pressure = 0f, touchMajor = 0f)
    }

    fun move(x: Float, y: Float, key: Char, eventTimeMs: Long, pressure: Float, touchMajor: Float): Boolean {
        val cleanKey = cleanKey(key)
        updateIntentSignals(x, y, cleanKey, eventTimeMs, pressure, touchMajor)
        var appendedNewKey = false
        val movedSq = distanceSq(startX, startY, x, y)
        if (!isActive && movedSq >= activationSlopSq) {
            isActive = true
            appendedNewKey = appendKey(lastKey)
        }

        if (!isActive) return false

        if (distanceSq(lastSampleX, lastSampleY, x, y) >= minSampleDistanceSq) {
            appendPoint(x, y)
            lastSampleX = x
            lastSampleY = y
        }

        appendedNewKey = appendKey(cleanKey) || appendedNewKey
        if (cleanKey != NO_KEY) {
            lastKey = cleanKey
        }
        lastMoveX = x
        lastMoveY = y
        if (eventTimeMs > 0L) {
            lastEventTimeMs = eventTimeMs
        }
        return appendedNewKey
    }

    fun finish(): String {
        return finishGesture().weightedSequence
    }

    fun finishGesture(): SwipeGestureResult {
        val result = if (isActive && sequence.length >= MIN_SEQUENCE_LENGTH) {
            val raw = sequence.toString()
            val weighted = buildWeightedSequence()
            SwipeGestureResult(
                rawSequence = raw,
                weightedSequence = weighted,
                compressedSequence = compressedSequence(raw),
                sampledPointCount = totalPointSamples,
                storedPointCount = pointCount,
                pointCapHit = pointCapHit,
                gestureLengthPx = totalDistancePx
            )
        } else {
            SwipeGestureResult.EMPTY
        }
        reset()
        return result
    }

    fun cancel() {
        reset()
    }

    private fun reset() {
        isActive = false
        pointCount = 0
        sequence.setLength(0)
        weightedSequence.setLength(0)
        lastKey = NO_KEY
        currentIntentKey = NO_KEY
        lastEventTimeMs = 0L
        hasIntentSignals = false
        pointCapHit = false
        totalPointSamples = 0
        totalDistancePx = 0f
        for (index in 0 until KEY_COUNT) {
            keyDwellMs[index] = 0L
            keySampleCounts[index] = 0
            keyPressureTotals[index] = 0f
            keyTouchMajorTotals[index] = 0f
            keySlowdownTotals[index] = 0f
        }
    }

    private fun appendPoint(x: Float, y: Float) {
        if (pointCount > 0) {
            val previousX = xs[pointCount - 1]
            val previousY = ys[pointCount - 1]
            totalDistancePx += kotlin.math.sqrt(distanceSq(previousX, previousY, x, y).toDouble()).toFloat()
        }
        totalPointSamples++
        if (pointCount < maxPoints) {
            xs[pointCount] = x
            ys[pointCount] = y
            pointCount++
            return
        }

        pointCapHit = true
        rollTail()
        xs[maxPoints - 1] = x
        ys[maxPoints - 1] = y
    }

    private fun rollTail() {
        for (index in 1 until maxPoints) {
            xs[index - 1] = xs[index]
            ys[index - 1] = ys[index]
        }
    }

    private fun appendKey(key: Char): Boolean {
        if (key == NO_KEY || sequence.length >= maxSequenceLength) return false
        if (sequence.isNotEmpty() && sequence[sequence.length - 1] == key) return false
        sequence.append(key)
        return true
    }

    private fun updateIntentSignals(
        x: Float,
        y: Float,
        cleanKey: Char,
        eventTimeMs: Long,
        pressure: Float,
        touchMajor: Float
    ) {
        if (eventTimeMs > 0L || pressure > 0f || touchMajor > 0f) {
            hasIntentSignals = true
        }

        val elapsedMs = if (eventTimeMs > 0L && lastEventTimeMs > 0L) {
            (eventTimeMs - lastEventTimeMs).coerceIn(0L, MAX_DWELL_DELTA_MS)
        } else {
            0L
        }
        addDwell(currentIntentKey, elapsedMs)

        val slowdown = if (elapsedMs > 0L) {
            val distance = kotlin.math.sqrt(distanceSq(lastMoveX, lastMoveY, x, y).toDouble()).toFloat()
            val velocity = distance / elapsedMs
            (1f - (velocity / FAST_TRANSIT_VELOCITY_PX_PER_MS)).coerceIn(0f, 1f)
        } else {
            0f
        }
        recordIntentSample(cleanKey, pressure, touchMajor, slowdown)

        if (cleanKey != NO_KEY) {
            currentIntentKey = cleanKey
        }
    }

    private fun addDwell(key: Char, dwellMs: Long) {
        val index = keyIndex(key)
        if (index >= 0 && dwellMs > 0L) {
            keyDwellMs[index] += dwellMs
        }
    }

    private fun recordIntentSample(key: Char, pressure: Float, touchMajor: Float, slowdown: Float) {
        val index = keyIndex(key)
        if (index < 0) return
        keySampleCounts[index]++
        keyPressureTotals[index] += pressure.coerceIn(0f, 1.5f)
        keyTouchMajorTotals[index] += touchMajor.coerceAtLeast(0f)
        keySlowdownTotals[index] += slowdown.coerceIn(0f, 1f)
    }

    private fun buildWeightedSequence(): String {
        if (!hasIntentSignals) return sequence.toString()

        var maxWeight = 0f
        var minWeight = 1f
        var totalWeight = 0f
        for (index in 0 until sequence.length) {
            val weight = intentWeight(sequence[index])
            maxWeight = maxOf(maxWeight, weight)
            minWeight = minOf(minWeight, weight)
            totalWeight += weight
        }

        if (maxWeight - minWeight < MIN_INTENT_SPREAD) return sequence.toString()

        val averageWeight = totalWeight / sequence.length
        val threshold = maxOf(MIN_KEEP_WEIGHT, averageWeight * INTENT_KEEP_AVERAGE_RATIO)
        weightedSequence.setLength(0)
        intentDebugBuilder.setLength(0)
        for (index in 0 until sequence.length) {
            val key = sequence[index]
            val weight = intentWeight(key)
            if (intentDebugBuilder.isNotEmpty()) {
                intentDebugBuilder.append(' ')
            }
            intentDebugBuilder
                .append(key)
                .append(":d=")
                .append(keyDwellMs[keyIndex(key)])
                .append(",w=")
                .append(((weight * 100f).toInt() / 100f))
            if (weight >= threshold || index == 0 || index == sequence.length - 1) {
                weightedSequence.append(key)
            }
        }

        if (weightedSequence.length < MIN_SEQUENCE_LENGTH) return sequence.toString()
        return weightedSequence.toString()
    }

    private fun compressedSequence(input: String): String {
        if (input.length < MIN_SEQUENCE_LENGTH) return input
        weightedSequence.setLength(0)
        var previous = NO_KEY
        for (char in input) {
            if (char == previous) continue
            weightedSequence.append(char)
            previous = char
        }
        return weightedSequence.toString()
    }

    fun intentDebugSummary(): String = intentDebugBuilder.toString()

    private fun intentWeight(key: Char): Float {
        val index = keyIndex(key)
        if (index < 0) return 0f
        val samples = keySampleCounts[index].coerceAtLeast(1)
        val dwellScore = (keyDwellMs[index].toFloat() / STRONG_DWELL_MS).coerceIn(0f, 1f)
        val sampleScore = (samples.toFloat() / STRONG_SAMPLE_COUNT).coerceIn(0f, 1f)
        val pressureScore = (keyPressureTotals[index] / samples).coerceIn(0f, 1f)
        val touchScore = ((keyTouchMajorTotals[index] / samples) / STRONG_TOUCH_MAJOR_PX).coerceIn(0f, 1f)
        val slowdownScore = (keySlowdownTotals[index] / samples).coerceIn(0f, 1f)
        return dwellScore * 0.36f +
            sampleScore * 0.18f +
            pressureScore * 0.24f +
            touchScore * 0.12f +
            slowdownScore * 0.10f
    }

    private fun cleanKey(key: Char): Char =
        if (key in 'a'..'z') key else NO_KEY

    private fun keyIndex(key: Char): Int =
        if (key in 'a'..'z') key - 'a' else -1

    private fun distanceSq(firstX: Float, firstY: Float, secondX: Float, secondY: Float): Float {
        val dx = secondX - firstX
        val dy = secondY - firstY
        return dx * dx + dy * dy
    }

    private companion object {
        const val DEFAULT_MAX_POINTS = 192
        const val DEFAULT_MAX_SEQUENCE_LENGTH = 32
        const val KEY_COUNT = 26
        const val MIN_SEQUENCE_LENGTH = 2
        const val NO_KEY = '\u0000'
        const val MAX_DWELL_DELTA_MS = 120L
        const val STRONG_DWELL_MS = 75f
        const val STRONG_SAMPLE_COUNT = 3f
        const val STRONG_TOUCH_MAJOR_PX = 14f
        const val FAST_TRANSIT_VELOCITY_PX_PER_MS = 1.2f
        const val MIN_INTENT_SPREAD = 0.18f
        const val MIN_KEEP_WEIGHT = 0.52f
        const val INTENT_KEEP_AVERAGE_RATIO = 0.75f
    }
}

data class SwipeGestureResult(
    val rawSequence: String,
    val weightedSequence: String,
    val compressedSequence: String,
    val sampledPointCount: Int = 0,
    val storedPointCount: Int = 0,
    val pointCapHit: Boolean = false,
    val gestureLengthPx: Float = 0f
) {
    val resolutionSequences: List<String>
        get() {
            val output = ArrayList<String>(3)
            addIfUsable(output, weightedSequence)
            addIfUsable(output, rawSequence)
            addIfUsable(output, compressedSequence)
            return output
        }

    private fun addIfUsable(output: MutableList<String>, sequence: String) {
        if (sequence.length >= 2 && sequence !in output) {
            output.add(sequence)
        }
    }

    companion object {
        val EMPTY = SwipeGestureResult("", "", "")
    }
}
