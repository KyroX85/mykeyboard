package com.example.mykeyboard

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.Drawable
import android.view.View
import android.view.animation.DecelerateInterpolator

class KeyboardKeyRgbAnimator {
    fun press(keyView: View, accent: KeyAccent = KeyAccent.NORMAL) {
        if (keyView.width <= 0 || keyView.height <= 0) return
        keyView.animate().cancel()
        keyView.animate()
            .scaleX(PRESS_SCALE)
            .scaleY(PRESS_SCALE)
            .translationY(keyView.resources.displayMetrics.density)
            .setDuration(PRESS_DURATION_MS)
            .setInterpolator(DecelerateInterpolator())
            .start()

        val drawable = KeyFlashDrawable(
            accent = accent,
            density = keyView.resources.displayMetrics.density,
            cornerRadiusPx = 8f * keyView.resources.displayMetrics.density
        ).apply {
            setBounds(0, 0, keyView.width, keyView.height)
        }
        keyView.overlay.add(drawable)
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = FLASH_DURATION_MS
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                drawable.progress = it.animatedValue as Float
                drawable.invalidateSelf()
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    keyView.overlay.remove(drawable)
                }

                override fun onAnimationCancel(animation: Animator) {
                    keyView.overlay.remove(drawable)
                }
            })
            start()
        }
    }

    fun release(keyView: View) {
        keyView.animate().cancel()
        keyView.animate()
            .scaleX(1f)
            .scaleY(1f)
            .translationY(0f)
            .setDuration(RELEASE_DURATION_MS)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private class KeyFlashDrawable(
        private val accent: KeyAccent,
        private val density: Float,
        private val cornerRadiusPx: Float
    ) : Drawable() {
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 3.8f * density
        }
        private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
        }
        private val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 6.2f * density
        }
        private val sweepPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
        }
        private val rect = RectF()
        var progress: Float = 0f

        override fun draw(canvas: Canvas) {
            val b = bounds
            if (b.width() <= 0 || b.height() <= 0) return
            val fade = if (progress < HOLD_FULL_BRIGHTNESS_UNTIL) {
                1f
            } else {
                ((1f - progress) / (1f - HOLD_FULL_BRIGHTNESS_UNTIL)).coerceIn(0f, 1f)
            }
            val inset = borderPaint.strokeWidth * 0.65f
            rect.set(inset, inset, b.width() - inset, b.height() - inset)

            glowPaint.color = accent.glowColor
            glowPaint.alpha = (96 * fade).toInt().coerceIn(0, 96)
            canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, glowPaint)

            haloPaint.color = accent.glowColor
            haloPaint.alpha = (170 * fade).toInt().coerceIn(0, 170)
            canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, haloPaint)

            borderPaint.shader = LinearGradient(
                0f,
                0f,
                b.width().toFloat(),
                0f,
                accent.borderColors,
                null,
                Shader.TileMode.CLAMP
            )
            borderPaint.alpha = (255 * fade).toInt().coerceIn(0, 255)
            canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, borderPaint)
            borderPaint.shader = null

            val sweepWidth = b.width() * 0.66f
            val left = -sweepWidth + (b.width() + sweepWidth * 2f) * progress
            sweepPaint.shader = LinearGradient(
                left,
                0f,
                left + sweepWidth,
                0f,
                intArrayOf(Color.TRANSPARENT, Color.argb((210 * fade).toInt(), 255, 255, 255), Color.TRANSPARENT),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )
            canvas.save()
            canvas.rotate(14f, b.width() * 0.5f, b.height() * 0.5f)
            canvas.drawRect(left, -b.height().toFloat(), left + sweepWidth, b.height() * 2f, sweepPaint)
            canvas.restore()
            sweepPaint.shader = null
        }

        override fun setAlpha(alpha: Int) = Unit
        override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) = Unit
        @Deprecated("Deprecated in Java")
        override fun getOpacity(): Int = android.graphics.PixelFormat.TRANSLUCENT
    }

    enum class KeyAccent(
        val glowColor: Int,
        val borderColors: IntArray
    ) {
        NORMAL(
            Color.argb(255, 18, 175, 255),
            intArrayOf(Color.rgb(22, 200, 255), Color.rgb(138, 92, 255), Color.rgb(35, 236, 155))
        ),
        MODIFIER(
            Color.argb(255, 108, 91, 255),
            intArrayOf(Color.rgb(138, 92, 255), Color.rgb(22, 200, 255), Color.rgb(138, 92, 255))
        ),
        ACTION(
            Color.argb(255, 35, 236, 155),
            intArrayOf(Color.rgb(35, 236, 155), Color.rgb(22, 200, 255), Color.rgb(35, 236, 155))
        )
    }

    private companion object {
        const val PRESS_SCALE = 0.94f
        const val PRESS_DURATION_MS = 48L
        const val RELEASE_DURATION_MS = 92L
        const val FLASH_DURATION_MS = 420L
        const val HOLD_FULL_BRIGHTNESS_UNTIL = 0.32f
    }
}
