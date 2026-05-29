package com.example.mykeyboard

import android.app.Activity
import android.os.Bundle
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.graphics.Color
import android.text.InputType
import android.view.Gravity
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

class ProductLabInputActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.WHITE)
            setPadding(32, 96, 32, 32)
        }

        val label = TextView(this).apply {
            text = "Aritenis Product Lab"
            textSize = 20f
            setTextColor(Color.BLACK)
            gravity = Gravity.CENTER
        }

        val input = EditText(this).apply {
            hint = "scripted test phrase"
            textSize = 18f
            setSingleLine(false)
            minLines = 2
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            setTextColor(Color.BLACK)
            setHintTextColor(Color.DKGRAY)
            setBackgroundColor(Color.rgb(230, 236, 244))
            setPadding(24, 18, 24, 18)
        }

        container.addView(label, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))
        container.addView(input, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 32
        })

        setContentView(container)
        input.requestFocus()
        input.postDelayed({
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
        }, 400)
    }
}
