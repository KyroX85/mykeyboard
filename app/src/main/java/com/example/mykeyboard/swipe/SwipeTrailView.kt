package com.example.mykeyboard.swipe

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View

class SwipeTrailView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val xs = FloatArray(MAX_POINTS)
    private val ys = FloatArray(MAX_POINTS)
    private val path = Path()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(190, 92, 184, 255)
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        strokeWidth = resources.displayMetrics.density * 5f
    }
    private var pointCount = 0
    private var pointHead = 0
    private var totalPointSamples = 0
    private var totalDistancePx = 0f
    private var capHit = false

    init {
        setWillNotDraw(false)
        isClickable = false
        isFocusable = false
        alpha = 0f
    }

    fun start(x: Float, y: Float) {
        animate().cancel()
        alpha = 1f
        pointCount = 0
        pointHead = 0
        totalPointSamples = 0
        totalDistancePx = 0f
        capHit = false
        addPoint(x, y)
    }

    fun addPoint(x: Float, y: Float) {
        if (pointCount > 0) {
            val previousIndex = circularIndex(pointCount - 1)
            val previousX = xs[previousIndex]
            val previousY = ys[previousIndex]
            totalDistancePx += kotlin.math.sqrt(distanceSq(previousX, previousY, x, y).toDouble()).toFloat()
        }
        totalPointSamples++
        if (pointCount < MAX_POINTS) {
            val insertIndex = circularIndex(pointCount)
            xs[insertIndex] = x
            ys[insertIndex] = y
            pointCount++
        } else {
            capHit = true
            pointHead = (pointHead + 1) % MAX_POINTS
            val tailIndex = circularIndex(pointCount - 1)
            xs[tailIndex] = x
            ys[tailIndex] = y
        }
        postInvalidateOnAnimation()
    }

    fun fadeAndReset() {
        animate().cancel()
        animate()
            .alpha(0f)
            .setDuration(FADE_MS)
            .withEndAction {
                pointCount = 0
                pointHead = 0
                postInvalidateOnAnimation()
            }
            .start()
    }

    fun resetNow() {
        animate().cancel()
        alpha = 0f
        pointCount = 0
        pointHead = 0
        postInvalidateOnAnimation()
    }

    fun diagnosticsSnapshot(): SwipeTrailDiagnostics =
        SwipeTrailDiagnostics(
            storedPointCount = pointCount,
            totalPointSamples = totalPointSamples,
            capHit = capHit,
            gestureLengthPx = totalDistancePx
        )

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (pointCount < 2) return

        path.reset()
        val firstIndex = circularIndex(0)
        path.moveTo(xs[firstIndex], ys[firstIndex])
        for (index in 1 until pointCount) {
            val prevIndex = circularIndex(index - 1)
            val currentIndex = circularIndex(index)
            val midX = (xs[prevIndex] + xs[currentIndex]) * 0.5f
            val midY = (ys[prevIndex] + ys[currentIndex]) * 0.5f
            path.quadTo(xs[prevIndex], ys[prevIndex], midX, midY)
        }
        val lastIndex = circularIndex(pointCount - 1)
        path.lineTo(xs[lastIndex], ys[lastIndex])
        canvas.drawPath(path, paint)
    }

    private fun circularIndex(offset: Int): Int = (pointHead + offset) % MAX_POINTS

    private fun distanceSq(firstX: Float, firstY: Float, secondX: Float, secondY: Float): Float {
        val dx = secondX - firstX
        val dy = secondY - firstY
        return dx * dx + dy * dy
    }

    private companion object {
        const val MAX_POINTS = 192
        const val FADE_MS = 70L
    }
}

data class SwipeTrailDiagnostics(
    val storedPointCount: Int,
    val totalPointSamples: Int,
    val capHit: Boolean,
    val gestureLengthPx: Float
)
