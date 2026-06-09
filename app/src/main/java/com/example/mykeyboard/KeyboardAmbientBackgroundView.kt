package com.example.mykeyboard

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View
import kotlin.math.sin

class KeyboardAmbientBackgroundView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val edgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(1.6f)
        alpha = 92
    }
    private val particlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val ripplePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val micWavePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val panelRect = RectF()
    private val tapRipples = Array(MAX_TAP_RIPPLES) { TapRipple() }
    private val particles = Array(PARTICLE_COUNT) { index -> Particle(index) }

    private var edgeGradient: LinearGradient? = null
    private var startedAtMs = SystemClock.uptimeMillis()
    private var lastWidth = 0
    private var lastHeight = 0
    private var reducedMotion = false
    private var micReactive = false
    private val locationOnScreen = IntArray(2)

    init {
        alpha = AMBIENT_LAYER_ALPHA
        setWillNotDraw(false)
    }

    fun setAmbientEnabled(enabled: Boolean) {
        if (reducedMotion == !enabled) return
        reducedMotion = !enabled
        if (enabled) {
            startedAtMs = SystemClock.uptimeMillis()
            postInvalidateOnAnimation()
        } else {
            invalidate()
        }
    }

    fun setMicReactive(active: Boolean) {
        if (micReactive == active) return
        micReactive = active
        postInvalidateOnAnimation()
    }

    fun recordTapFromRaw(rawX: Float, rawY: Float) {
        if (reducedMotion || width == 0 || height == 0) return
        getLocationOnScreen(locationOnScreen)
        val localX = rawX - locationOnScreen[0]
        val localY = rawY - locationOnScreen[1]
        if (localX !in 0f..width.toFloat() || localY !in 0f..height.toFloat()) return
        val target = tapRipples.minBy { it.startedAtMs }
        target.x = localX
        target.y = localY
        target.startedAtMs = SystemClock.uptimeMillis()
        target.color = TAP_COLORS[(target.colorIndex++) % TAP_COLORS.size]
        postInvalidateOnAnimation()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w != lastWidth || h != lastHeight) {
            lastWidth = w
            lastHeight = h
            edgeGradient = LinearGradient(
                0f,
                0f,
                w.toFloat().coerceAtLeast(1f),
                0f,
                intArrayOf(
                    Color.rgb(23, 201, 255),
                    Color.rgb(112, 86, 255),
                    Color.rgb(41, 240, 156),
                    Color.rgb(23, 201, 255)
                ),
                null,
                Shader.TileMode.MIRROR
            )
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width == 0 || height == 0) return

        val now = SystemClock.uptimeMillis()
        val elapsed = (now - startedAtMs).coerceAtLeast(0L)
        drawEdgeGlow(canvas, elapsed)
        drawParticles(canvas, elapsed)
        drawTapRipples(canvas, now)
        if (micReactive) {
            drawMicWave(canvas, elapsed)
        }

        if (!reducedMotion || hasLiveRipple(now) || micReactive) {
            postInvalidateOnAnimation()
        }
    }

    private fun drawEdgeGlow(canvas: Canvas, elapsedMs: Long) {
        panelRect.set(
            EDGE_INSET_PX,
            EDGE_INSET_PX,
            width - EDGE_INSET_PX,
            height - EDGE_INSET_PX
        )
        edgePaint.shader = edgeGradient
        edgePaint.alpha = if (reducedMotion) 46 else (58 + wave(elapsedMs, 3_800L, 34f)).toInt()
        canvas.save()
        if (!reducedMotion) {
            canvas.translate(wave(elapsedMs, 5_600L, 18f), 0f)
        }
        canvas.drawRoundRect(panelRect, dp(20f), dp(20f), edgePaint)
        canvas.restore()
        edgePaint.shader = null
    }

    private fun drawParticles(canvas: Canvas, elapsedMs: Long) {
        val widthF = width.toFloat().coerceAtLeast(1f)
        val heightF = height.toFloat().coerceAtLeast(1f)
        particles.forEach { particle ->
            val progress = if (reducedMotion) {
                particle.seed
            } else {
                (particle.seed + elapsedMs / particle.durationMs.toFloat()) % 1f
            }
            val x = widthF * particle.xFactor + wave(elapsedMs + particle.phaseMs, particle.durationMs, particle.driftPx)
            val y = heightF * ((particle.yFactor + progress * 0.12f) % 1f)
            particlePaint.color = particle.color
            particlePaint.alpha = particle.alpha
            canvas.drawCircle(x.coerceIn(0f, widthF), y.coerceIn(0f, heightF), particle.radiusPx, particlePaint)
        }
    }

    private fun drawTapRipples(canvas: Canvas, nowMs: Long) {
        tapRipples.forEach { ripple ->
            val age = nowMs - ripple.startedAtMs
            if (age !in 0..TAP_RIPPLE_DURATION_MS) return@forEach
            val progress = age / TAP_RIPPLE_DURATION_MS.toFloat()
            ripplePaint.color = ripple.color
            ripplePaint.alpha = ((1f - progress) * 72).toInt().coerceIn(0, 72)
            canvas.drawCircle(ripple.x, ripple.y, dp(18f) + dp(52f) * progress, ripplePaint)
        }
    }

    private fun drawMicWave(canvas: Canvas, elapsedMs: Long) {
        val centerX = width * 0.5f
        val centerY = height * 0.35f
        val pulse = 0.55f + wave(elapsedMs, 1_300L, 0.45f)
        micWavePaint.color = Color.rgb(42, 232, 160)
        micWavePaint.alpha = 30
        canvas.drawCircle(centerX, centerY, dp(78f) * pulse, micWavePaint)
        micWavePaint.color = Color.rgb(22, 180, 255)
        micWavePaint.alpha = 22
        canvas.drawCircle(centerX, centerY, dp(128f) * pulse, micWavePaint)
    }

    private fun hasLiveRipple(nowMs: Long): Boolean =
        tapRipples.any { nowMs - it.startedAtMs in 0..TAP_RIPPLE_DURATION_MS }

    private fun wave(elapsedMs: Long, periodMs: Long, amplitude: Float): Float {
        if (periodMs <= 0L) return 0f
        val radians = (elapsedMs % periodMs) / periodMs.toFloat() * TWO_PI
        return sin(radians) * amplitude
    }

    private fun dp(value: Float): Float =
        value * resources.displayMetrics.density

    private data class TapRipple(
        var x: Float = 0f,
        var y: Float = 0f,
        var startedAtMs: Long = 0L,
        var color: Int = TAP_COLORS.first(),
        var colorIndex: Int = 0
    )

    private inner class Particle(index: Int) {
        val seed = ((index * 37) % 100) / 100f
        val xFactor = 0.08f + ((index * 19) % 84) / 100f
        val yFactor = 0.12f + ((index * 29) % 76) / 100f
        val durationMs = 5_600L + index * 410L
        val phaseMs = index * 733L
        val driftPx = dp(4f + (index % 5) * 2f)
        val radiusPx = dp(0.9f + (index % 3) * 0.35f)
        val alpha = 26 + (index % 4) * 7
        val color = PARTICLE_COLORS[index % PARTICLE_COLORS.size]
    }

    private companion object {
        const val AMBIENT_LAYER_ALPHA = 0.82f
        const val MAX_TAP_RIPPLES = 6
        const val PARTICLE_COUNT = 16
        const val TAP_RIPPLE_DURATION_MS = 460L
        const val TWO_PI = 6.2831855f
        const val EDGE_INSET_PX = 1.5f
        val TAP_COLORS = intArrayOf(
            Color.rgb(21, 190, 255),
            Color.rgb(112, 98, 255),
            Color.rgb(42, 232, 160)
        )
        val PARTICLE_COLORS = intArrayOf(
            Color.rgb(81, 218, 255),
            Color.rgb(148, 119, 255),
            Color.rgb(61, 240, 171)
        )
    }
}
