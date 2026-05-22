package com.example.mykeyboard

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.Gravity
import androidx.appcompat.widget.AppCompatButton

class HintKeyButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = android.R.attr.buttonStyle
) : AppCompatButton(context, attrs, defStyleAttr) {

    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xB3D6DFEA.toInt()
        textAlign = Paint.Align.RIGHT
        typeface = android.graphics.Typeface.DEFAULT_BOLD
    }
    private var symbolHint: String? = null

    fun setSymbolHint(hint: String?) {
        if (symbolHint == hint) return
        symbolHint = hint
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val hint = symbolHint ?: return
        if (hint.isEmpty()) return

        hintPaint.textSize = maxOf(9f, height * HINT_TEXT_SIZE_RATIO)
        val x = width - maxOf(5f, width * HINT_RIGHT_PADDING_RATIO)
        val y = maxOf(hintPaint.textSize + 1f, height * HINT_TOP_BASELINE_RATIO)
        canvas.drawText(hint, x, y, hintPaint)
    }

    init {
        gravity = Gravity.CENTER
    }

    private companion object {
        const val HINT_TEXT_SIZE_RATIO = 0.22f
        const val HINT_RIGHT_PADDING_RATIO = 0.13f
        const val HINT_TOP_BASELINE_RATIO = 0.32f
    }
}
