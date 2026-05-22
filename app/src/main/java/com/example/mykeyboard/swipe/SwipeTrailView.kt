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
        totalPointSamples = 0
        totalDistancePx = 0f
        capHit = false
        addPoint(x, y)
    }

    fun addPoint(x: Float, y: Float) {
        if (pointCount > 0) {
            val previousX = xs[pointCount - 1]
            val previousY = ys[pointCount - 1]
            totalDistancePx += kotlin.math.sqrt(distanceSq(previousX, previousY, x, y).toDouble()).toFloat()
        }
        totalPointSamples++
        if (pointCount < MAX_POINTS) {
            xs[pointCount] = x
            ys[pointCount] = y
            pointCount++
        } else {
            capHit = true
            rollTail()
            xs[MAX_POINTS - 1] = x
            ys[MAX_POINTS - 1] = y
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
                postInvalidateOnAnimation()
            }
            .start()
    }

    fun resetNow() {
        animate().cancel()
        alpha = 0f
        pointCount = 0
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
        path.moveTo(xs[0], ys[0])
        for (index in 1 until pointCount) {
            val midX = (xs[index - 1] + xs[index]) * 0.5f
            val midY = (ys[index - 1] + ys[index]) * 0.5f
            path.quadTo(xs[index - 1], ys[index - 1], midX, midY)
        }
        path.lineTo(xs[pointCount - 1], ys[pointCount - 1])
        canvas.drawPath(path, paint)
    }

    private fun rollTail() {
        for (index in 1 until MAX_POINTS) {
            xs[index - 1] = xs[index]
            ys[index - 1] = ys[index]
        }
    }

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
