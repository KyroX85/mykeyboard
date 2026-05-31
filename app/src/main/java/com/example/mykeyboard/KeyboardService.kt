package com.example.mykeyboard

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.inputmethodservice.InputMethodService
import android.media.AudioManager
import android.provider.MediaStore
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.GridView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import android.widget.Toast
import android.view.ViewGroup
import android.widget.AbsListView
import java.util.Locale
import com.example.mykeyboard.haptics.HapticKind
import com.example.mykeyboard.haptics.HapticProfile
import com.example.mykeyboard.haptics.HapticTapGate
import com.example.mykeyboard.ime.ImeAction
import com.example.mykeyboard.ime.ImeActionMapper
import com.example.mykeyboard.metrics.KeyConfidenceZone
import com.example.mykeyboard.metrics.KeyboardMetrics
import com.example.mykeyboard.metrics.KeyboardMetricsSnapshot
import com.example.mykeyboard.metrics.ProductSignalBridge
import com.example.mykeyboard.predictor.BasicPredictor
import com.example.mykeyboard.swipe.SwipeGestureTracker
import com.example.mykeyboard.swipe.SwipeGestureResult
import com.example.mykeyboard.swipe.SwipeTrailDiagnostics
import com.example.mykeyboard.swipe.SwipeTrailView
import kotlinx.coroutines.CancellationException
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
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger
import java.net.SocketTimeoutException
import java.util.EnumMap
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class KeyboardService : InputMethodService() {

    private lateinit var root: FrameLayout
    private lateinit var mainContainer: LinearLayout
    private lateinit var keyboardPanel: FrameLayout
    private lateinit var keyboardContent: LinearLayout
    private lateinit var suggestionBar: LinearLayout
    private lateinit var numberRow: LinearLayout
    private lateinit var keyboardLayout: LinearLayout
    private lateinit var keyboardBottomSpacer: View
    private lateinit var swipeTrailView: SwipeTrailView
    private lateinit var executionHandle: View
    private lateinit var executionLayer: LinearLayout
    private lateinit var executionCommandText: TextView
    private lateinit var executionStatusText: TextView
    private var executionVoiceButton: TextView? = null
    private var executionOverlayRoot: FrameLayout? = null

    private lateinit var emojiContainer: LinearLayout
    private lateinit var emojiGrid: GridView
    private lateinit var emojiCategoryBar: LinearLayout
    private lateinit var emojiBackButton: Button
    private lateinit var emojiBottomSpacer: View

    private val keyButtons = mutableListOf<Button>()
    private val suggestionButtons = mutableListOf<TextView>()
    private var voiceSuggestionButton: TextView? = null
    private val renderedSuggestionTexts = Array(3) { "" }

    private enum class Mode { LETTERS, NUMBERS, SYMBOLS }
    private enum class ShiftState { OFF, ON, CAPS }

    private val keyboardRowsByMode = EnumMap<Mode, List<LinearLayout>>(Mode::class.java)
    private val keyboardButtonsByMode = EnumMap<Mode, List<Button>>(Mode::class.java)
    private val numberRowButtons = mutableListOf<Button>()
    private var cachedKeyboardSizing: KeyboardSizingProfile? = null
    private var navigationBottomInsetPx = 0

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
    private var repeatingSpace: Runnable? = null
    private var longPressRunnable: Runnable? = null
    private var isLongPressActive = false
    private var activePopup: PopupWindow? = null
    private var selectedEmojiCategoryIndex = 0
    private var keyPreviewPopup: PopupWindow? = null
    private var keyPreviewText: TextView? = null
    private var routedTouchButton: Button? = null
    private var routedTouchKey: String? = null
    private var swipeTrackingStarted = false
    private var swipePressedButton: Button? = null
    private val recentEmojis = ArrayList<String>(40)
    private val emojiGlyphPaint by lazy { Paint(Paint.ANTI_ALIAS_FLAG) }
    private val swipeTracker by lazy {
        SwipeGestureTracker(
            activationSlopPx = dp(SWIPE_ACTIVATION_SLOP_DP).toFloat(),
            minSampleDistancePx = dp(SWIPE_SAMPLE_DISTANCE_DP).toFloat()
        )
    }
    private val swipeHapticGate = HapticTapGate(SWIPE_HAPTIC_MIN_INTERVAL_MS)
    private val screenLocationBuffer = IntArray(2)
    private var swipePanelX = 0f
    private var swipePanelY = 0f

    private val httpClient = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val metrics = KeyboardMetrics()
    private val hapticTapGate = HapticTapGate(HAPTIC_MIN_INTERVAL_MS)
    private val cachedAudioManager: AudioManager by lazy {
        getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private val cachedVibrator: Vibrator by lazy { resolveVibrator() }
    private val normalVibrationEffect: VibrationEffect? by lazy {
        createVibrationEffect(HapticProfile.forKey("a"))
    }
    private val backspaceVibrationEffect: VibrationEffect? by lazy {
        createVibrationEffect(HapticProfile.forKey(KEY_BACKSPACE))
    }
    private val actionVibrationEffect: VibrationEffect? by lazy {
        createVibrationEffect(HapticProfile.forKey(KEY_ENTER))
    }
    private val spaceVibrationEffect: VibrationEffect? by lazy {
        createVibrationEffect(HapticProfile.forKey(KEY_SPACE))
    }
    private val logEventCounter = AtomicInteger(0)
    private var lastConfigErrorLogAtMs = 0L
    private var lastKeyDownAtMs = 0L
    private var pendingSuggestionImpression = false
    private var lastAcceptedSuggestion: String? = null
    private var lastAcceptedSuggestionPreviousWord: String? = null
    private var lastMetricsFlushAtMs = 0L
    private var currentImeAction = ImeAction.Enter
    private var lastSuggestionQueryPrefix = SUGGESTION_QUERY_UNSET
    private var lastSuggestionQueryPreviousWord = SUGGESTION_QUERY_UNSET
    private val suggestionExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "KeyboardSuggestions").apply { isDaemon = true }
    }
    private val autocorrectExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "KeyboardAutocorrect").apply { isDaemon = true }
    }
    private var suggestionLookupFuture: Future<*>? = null
    private var autocorrectPrefetchFuture: Future<*>? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isVoiceTypingActive = false
    private var isExecutionVoiceCommandActive = false
    private var voiceRecordingPulse = false
    private var lastVoicePartial = ""
    private var pendingSpaceCommit = false
    private var executionLayerOpen = false
    private var executionHandleDownY = 0f
    private var executionHandleActivated = false
    private val executionCommand = StringBuilder()
    private var autocorrectGeneration = 0
    private var autocorrectPrefetchWord: String? = null
    private var autocorrectPrefetchPreviousWord: String? = null
    private var autocorrectPrefetchResult: String? = null
    private var swipeResolveGeneration = 0
    private val cachedKeyBounds = mutableMapOf<Button, CachedKeyBounds>()
    private var cachedPanelScreenX = 0
    private var cachedPanelScreenY = 0

    private val supabaseUrl: String by lazy { BuildConfig.SUPABASE_URL }
    private val supabaseKey: String by lazy { BuildConfig.SUPABASE_ANON_KEY }
    private val cachedUserId: String by lazy { loadOrCreateUserId() }

    private companion object {
        const val KEY_SHIFT = KeyboardSymbols.SHIFT
        const val KEY_BACKSPACE = KeyboardSymbols.BACKSPACE
        const val KEY_ENTER = KeyboardSymbols.ENTER
        const val KEY_EMOJI = KeyboardSymbols.EMOJI
        const val KEY_MIC = KeyboardSymbols.MIC
        const val KEY_SPACE = KeyboardSymbols.SPACE
        const val DOUBLE_TAP_TIMEOUT = 300L
        const val TOUCH_SLOP_HORIZONTAL_DP = 20
        const val TOUCH_SLOP_VERTICAL_DP = 22
        const val DELETE_REPEAT_INITIAL_DELAY_MS = 285L
        const val DELETE_REPEAT_START_INTERVAL_MS = 105L
        const val DELETE_REPEAT_MIN_INTERVAL_MS = 45L
        const val DELETE_REPEAT_ACCELERATION_MS = 5L
        const val LOG_TAG = "KeyboardSupabase"
        const val METRICS_TAG = "KeyboardMetrics"
        const val SWIPE_DEBUG_TAG = "SwipeDebug"
        const val INPUT_CONNECTION_TAG = "KeyboardInputConnection"
        const val LOG_SUCCESS_SAMPLE_EVERY = 40
        const val LOG_CONFIG_THROTTLE_MS = 30_000L
        const val METRICS_FLUSH_INTERVAL_MS = 60_000L
        const val MAX_RECENT_EMOJIS = 40
        const val PREFS_EMOJI_RECENTS_KEY = "emoji_recents_v1"
        const val RECENT_DELIMITER = "\u0001"
        const val KEY_PRESS_SCALE = 0.965f
        const val KEY_PREVIEW_WIDTH_DP = 60
        const val KEY_PREVIEW_HEIGHT_DP = 80
        const val HAPTIC_MIN_INTERVAL_MS = 18L
        const val KEY_SOUND_EFFECT_VOLUME = 0.85f
        const val SWIPE_HAPTIC_MIN_INTERVAL_MS = 36L
        const val SWIPE_ACTIVATION_SLOP_DP = 18
        const val SWIPE_SAMPLE_DISTANCE_DP = 5
        const val SWIPE_RESOLVE_WARN_MS = 32L
        const val MAX_NAVIGATION_BOTTOM_PADDING_DP = 8
        const val SHIFT_LONG_PRESS_DELAY_MS = 300L
        const val SYMBOL_LONG_PRESS_DELAY_MS = 230L
        const val SPACE_REPEAT_INITIAL_DELAY_MS = 260L
        const val SPACE_REPEAT_INTERVAL_MS = 88L
        const val EXECUTION_HANDLE_PULL_THRESHOLD_DP = 42
        const val SUGGESTION_QUERY_UNSET = "\u0000"
        val NUMBER_ROW_KEYS = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0")
        val EXECUTION_APP_ALIASES = mapOf(
            "instagram" to listOf("com.instagram.android"),
            "whatsapp" to listOf("com.whatsapp", "com.whatsapp.w4b"),
            "chrome" to listOf("com.android.chrome"),
            "google chrome" to listOf("com.android.chrome"),
            "phonepe" to listOf("com.phonepe.app"),
            "phone pe" to listOf("com.phonepe.app"),
            "paytm" to listOf("net.one97.paytm")
        )
    }

    override fun onCreate() {
        super.onCreate()
        predictor = BasicPredictor(this, scope, metrics)
        cachedAudioManager
        cachedVibrator
        normalVibrationEffect
        backspaceVibrationEffect
        actionVibrationEffect
        spaceVibrationEffect
    }

    override fun onEvaluateFullscreenMode(): Boolean = false

    override fun onUpdateExtractingViews(ei: EditorInfo?) {
        // No-op to prevent fullscreen extract UI
    }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        cleanupInputViewState()
        updateImeAction(attribute)
        if (!restarting) {
            resetInputSessionState()
        }
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        cleanupInputViewState()
        updateImeAction(info)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        rebuildKeyboardForConfigurationChange()
    }

    private fun rebuildKeyboardForConfigurationChange() {
        cachedKeyboardSizing = null
        if (::keyboardLayout.isInitialized) {
            clearCachedKeyboardViews()
            buildKeyboard()
            setupSuggestionBar()
        }
    }

    override fun onCreateInputView(): View {
        cleanupInputViewState()
        suggestionButtons.clear()
        renderedSuggestionTexts.fill("")
        keyButtons.clear()
        clearCachedKeyboardViews()

        val layout = layoutInflater.inflate(R.layout.keyboard_container, null)
        root = layout as FrameLayout
        navigationBottomInsetPx = 0
        setupSystemInsetHandling()
        
        mainContainer = layout.findViewById(R.id.mainContainer)
        keyboardPanel = layout.findViewById(R.id.keyboardPanel)
        keyboardPanel.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            refreshCachedKeyBounds()
            syncSwipeTrailToMeasuredPanel()
        }
        keyboardContent = layout.findViewById(R.id.keyboardContent)
        suggestionBar = layout.findViewById(R.id.suggestionBar)
        numberRow = layout.findViewById(R.id.numberRow)
        keyboardLayout = layout.findViewById(R.id.lettersLayout)
        keyboardBottomSpacer = layout.findViewById(R.id.keyboardBottomSpacer)
        swipeTrailView = SwipeTrailView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                0
            )
        }
        keyboardPanel.addView(swipeTrailView)
        
        emojiContainer = layout.findViewById(R.id.emojiContainer)
        emojiGrid = layout.findViewById(R.id.emojiPanel)
        emojiCategoryBar = layout.findViewById(R.id.emojiCategoryBar)
        emojiBackButton = layout.findViewById(R.id.backToKeyboard)
        emojiBottomSpacer = layout.findViewById(R.id.emojiBottomSpacer)
        applyImeBottomSpacers()

        setupSuggestionBar()
        setupEmojiPanelContent()

        buildKeyboard()
        setupExecutionLayerShell()
        return root
    }

    private fun setupSystemInsetHandling() {
        root.setOnApplyWindowInsetsListener { _, insets ->
            val bottomInset = navigationBottomInset(insets).coerceAtMost(dp(MAX_NAVIGATION_BOTTOM_PADDING_DP))
            if (navigationBottomInsetPx != bottomInset) {
                navigationBottomInsetPx = bottomInset
                cachedKeyboardSizing = null
                if (::keyboardLayout.isInitialized) {
                    clearCachedKeyboardViews()
                    buildKeyboard()
                    setupSuggestionBar()
                }
                applyImeBottomSpacers()
            }
            insets
        }
    }

    private fun navigationBottomInset(insets: WindowInsets): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            insets.getInsets(WindowInsets.Type.navigationBars()).bottom
        } else {
            @Suppress("DEPRECATION")
            insets.systemWindowInsetBottom
        }

    private fun applyImeBottomSpacers() {
        val bottomInset = navigationBottomInsetPx.coerceAtMost(dp(MAX_NAVIGATION_BOTTOM_PADDING_DP))
        if (::keyboardBottomSpacer.isInitialized) {
            keyboardBottomSpacer.updateHeight(bottomInset)
        }
        if (::emojiBottomSpacer.isInitialized) {
            emojiBottomSpacer.updateHeight(bottomInset)
        }
    }

    private fun setupSuggestionBar() {
        suggestionBar.removeAllViews()
        suggestionButtons.clear()
        voiceSuggestionButton = null
        val sizing = currentKeyboardSizing()
        suggestionBar.setPadding(
            sizing.suggestionHorizontalPaddingPx,
            0,
            sizing.suggestionHorizontalPaddingPx,
            0
        )
        repeat(3) {
            val suggestionBtn = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    1f
                ).apply {
                    setMargins(
                        sizing.suggestionChipHorizontalMarginPx,
                        sizing.suggestionChipVerticalMarginPx,
                        sizing.suggestionChipHorizontalMarginPx,
                        sizing.suggestionChipVerticalMarginPx
                    )
                }
                text = ""
                textSize = 13f
                setTextColor(Color.rgb(218, 224, 232))
                gravity = Gravity.CENTER
                setIncludeFontPadding(false)
                setSingleLine(true)
                background = ColorDrawable(Color.TRANSPARENT)
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    val suggestion = text.toString()
                    if (suggestion.isNotEmpty()) {
                        acceptSuggestion(suggestion)
                    }
                }
            }

            suggestionBar.addView(suggestionBtn)
            suggestionButtons.add(suggestionBtn)
        }
        val micButton = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                dp(42),
                LinearLayout.LayoutParams.MATCH_PARENT
            ).apply {
                setMargins(
                    sizing.suggestionChipHorizontalMarginPx,
                    sizing.suggestionChipVerticalMarginPx,
                    sizing.suggestionChipHorizontalMarginPx,
                    sizing.suggestionChipVerticalMarginPx
                )
            }
            text = KEY_MIC
            textSize = 15f
            setTextColor(textColorForKey(KEY_MIC))
            gravity = Gravity.CENTER
            setIncludeFontPadding(false)
            setSingleLine(true)
            background = ColorDrawable(Color.TRANSPARENT)
            contentDescription = KeyboardSymbols.accessibilityLabelForKey(KEY_MIC, currentImeAction.label)
            isClickable = true
            isFocusable = true
            setOnClickListener { toggleVoiceTyping() }
        }
        suggestionBar.addView(micButton)
        voiceSuggestionButton = micButton
        updateVoiceKeyUI()
    }

    private fun setupExecutionLayerShell() {
        executionHandle = View(this).apply {
            alpha = 0.82f
            background = lightBlueGlassDrawable(Color.argb(190, 152, 232, 255), dp(18))
            contentDescription = "Open Aritenis execution layer"
            setOnTouchListener { _, event -> handleExecutionHandleTouch(event) }
        }
        keyboardPanel.addView(
            executionHandle,
            FrameLayout.LayoutParams(dp(58), dp(8), Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply {
                topMargin = dp(3)
            }
        )

        executionLayer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setPadding(dp(18), dp(20), dp(18), dp(16))
            background = lightBlueGlassDrawable(Color.argb(224, 132, 224, 255), dp(26), Color.argb(155, 238, 252, 255))
        }

        val title = TextView(this).apply {
            text = "Aritenis Execution"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(8, 38, 55))
            setIncludeFontPadding(false)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(26)
            )
        }
        executionLayer.addView(title)

        executionCommandText = TextView(this).apply {
            text = "What do you want done?"
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(52, 87, 108))
            gravity = Gravity.CENTER_VERTICAL
            setSingleLine(true)
            setIncludeFontPadding(false)
            setPadding(dp(16), 0, dp(16), 0)
            background = lightBlueGlassDrawable(Color.argb(224, 238, 252, 255), dp(20), Color.argb(190, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            ).apply { topMargin = dp(10) }
        }
        executionLayer.addView(executionCommandText)

        executionStatusText = TextView(this).apply {
            text = "Type with your keyboard. Nothing is sent automatically."
            textSize = 12f
            setTextColor(Color.rgb(24, 71, 96))
            setIncludeFontPadding(false)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(34)
            ).apply { topMargin = dp(10) }
        }
        executionLayer.addView(executionStatusText)

        val hintRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(42)
            ).apply { topMargin = dp(8) }
        }
        listOf("Find", "Check", "Send", "Make").forEach { label ->
            hintRow.addView(TextView(this).apply {
                text = label
                textSize = 13f
                setTextColor(Color.rgb(22, 65, 96))
                gravity = Gravity.CENTER
                setSingleLine(true)
                setIncludeFontPadding(false)
                background = lightBlueGlassDrawable(Color.argb(150, 246, 253, 255), dp(14), Color.argb(150, 255, 255, 255))
                layoutParams = LinearLayout.LayoutParams(0, dp(34), 1f).apply {
                    setMargins(dp(3), 0, dp(3), 0)
                }
            })
        }
        executionLayer.addView(hintRow)

        executionVoiceButton = TextView(this).apply {
            text = "Speak: Open Instagram"
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(12, 54, 82))
            gravity = Gravity.CENTER
            setIncludeFontPadding(false)
            background = lightBlueGlassDrawable(Color.argb(180, 246, 253, 255), dp(15), Color.argb(165, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(42)
            ).apply { topMargin = dp(10) }
            setOnClickListener { startExecutionVoiceCommand() }
        }
        executionLayer.addView(executionVoiceButton)

        val cancel = TextView(this).apply {
            text = "Cancel"
            textSize = 14f
            setTextColor(Color.rgb(18, 45, 67))
            gravity = Gravity.CENTER
            setIncludeFontPadding(false)
            background = lightBlueGlassDrawable(Color.argb(170, 246, 253, 255), dp(14), Color.argb(145, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(42)
            ).apply { topMargin = dp(14) }
            setOnClickListener { closeExecutionLayer() }
        }
        executionLayer.addView(cancel)

        root.addView(
            executionLayer,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.BOTTOM
            )
        )
    }

    private fun lightBlueGlassDrawable(
        color: Int,
        radiusPx: Int,
        strokeColor: Int = Color.argb(95, 255, 255, 255)
    ): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = radiusPx.toFloat()
        setColor(color)
        setStroke(dp(1), strokeColor)
    }

    private fun handleExecutionHandleTouch(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                executionHandleDownY = event.rawY
                executionHandleActivated = false
                executionHandle.alpha = 1f
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val pullDistance = event.rawY - executionHandleDownY
                if (!executionHandleActivated && pullDistance >= dp(EXECUTION_HANDLE_PULL_THRESHOLD_DP)) {
                    executionHandleActivated = true
                    executionHandle.performHapticFeedback(
                        HapticFeedbackConstants.CONFIRM,
                        HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING
                    )
                    openExecutionLayer()
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                executionHandle.alpha = 0.82f
                executionHandleActivated = false
                return true
            }
        }
        return true
    }

    private fun openExecutionLayer() {
        if (!::executionLayer.isInitialized) return
        if (canDrawExecutionOverlay()) {
            showFullScreenExecutionOverlay()
            return
        }
        openExecutionOverlayPermissionSettings()
        Toast.makeText(this, "Allow Display over other apps for full-screen execution", Toast.LENGTH_LONG).show()
        showKeyboardBoundExecutionLayer()
    }

    private fun showFullScreenExecutionOverlay() {
        if (executionOverlayRoot != null) {
            executionLayerOpen = true
            renderExecutionCommand()
            return
        }

        val overlayRoot = FrameLayout(this).apply {
            alpha = 0f
            setPadding(dp(14), dp(44), dp(14), dp(18))
            background = ColorDrawable(Color.argb(92, 26, 178, 226))
        }

        val overlaySurface = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(16))
            background = lightBlueGlassDrawable(Color.argb(214, 120, 225, 255), dp(30), Color.argb(180, 238, 252, 255))
        }

        val title = TextView(this).apply {
            text = "Aritenis Execution"
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(7, 38, 55))
            setIncludeFontPadding(false)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(28)
            )
        }
        overlaySurface.addView(title)

        executionCommandText = TextView(this).apply {
            text = "What do you want done?"
            textSize = 19f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER_VERTICAL
            setSingleLine(true)
            setIncludeFontPadding(false)
            setTextColor(Color.rgb(52, 87, 108))
            setPadding(dp(16), 0, dp(16), 0)
            background = lightBlueGlassDrawable(Color.argb(232, 238, 252, 255), dp(22), Color.argb(210, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(58)
            ).apply { topMargin = dp(14) }
        }
        overlaySurface.addView(executionCommandText)

        executionStatusText = TextView(this).apply {
            text = "Type with your keyboard. Nothing is sent automatically."
            textSize = 12f
            setTextColor(Color.rgb(20, 69, 96))
            setIncludeFontPadding(false)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(34)
            ).apply { topMargin = dp(12) }
        }
        overlaySurface.addView(executionStatusText)

        val chipRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(46)
            ).apply { topMargin = dp(10) }
        }
        listOf("Find", "Check", "Send", "Make").forEach { label ->
            chipRow.addView(TextView(this).apply {
                text = label
                textSize = 13f
                gravity = Gravity.CENTER
                setSingleLine(true)
                setIncludeFontPadding(false)
                setTextColor(Color.rgb(20, 65, 96))
                background = lightBlueGlassDrawable(Color.argb(155, 246, 253, 255), dp(15), Color.argb(155, 255, 255, 255))
                layoutParams = LinearLayout.LayoutParams(0, dp(36), 1f).apply {
                    setMargins(dp(3), 0, dp(3), 0)
                }
            })
        }
        overlaySurface.addView(chipRow)

        executionVoiceButton = TextView(this).apply {
            text = "Speak: Open Instagram"
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(12, 54, 82))
            setIncludeFontPadding(false)
            background = lightBlueGlassDrawable(Color.argb(178, 246, 253, 255), dp(16), Color.argb(165, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(46)
            ).apply { topMargin = dp(10) }
            setOnClickListener { startExecutionVoiceCommand() }
        }
        overlaySurface.addView(executionVoiceButton)

        val spacer = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        overlaySurface.addView(spacer)

        val cancel = TextView(this).apply {
            text = "Cancel"
            textSize = 14f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(18, 45, 67))
            setIncludeFontPadding(false)
            background = lightBlueGlassDrawable(Color.argb(180, 246, 253, 255), dp(16), Color.argb(160, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(44)
            )
            setOnClickListener { closeExecutionLayer() }
        }
        overlaySurface.addView(cancel)

        overlayRoot.addView(
            overlaySurface,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            )
        )

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            flags,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            setTitle("AritenisExecutionLayer")
        }

        try {
            val manager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            manager.addView(overlayRoot, params)
            executionOverlayRoot = overlayRoot
            executionLayerOpen = true
            if (::executionLayer.isInitialized) {
                executionLayer.visibility = View.GONE
            }
            overlayRoot.animate().alpha(1f).setDuration(160L).start()
            renderExecutionCommand()
        } catch (e: SecurityException) {
            executionOverlayRoot = null
            Log.w(LOG_TAG, "Execution overlay permission missing", e)
            openExecutionOverlayPermissionSettings()
        } catch (e: RuntimeException) {
            executionOverlayRoot = null
            Log.w(LOG_TAG, "Unable to show execution overlay", e)
        }
    }

    private fun canDrawExecutionOverlay(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

    private fun openExecutionOverlayPermissionSettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(intent)
        } catch (e: RuntimeException) {
            Log.w(LOG_TAG, "Unable to open overlay permission settings", e)
        }
    }

    private fun showKeyboardBoundExecutionLayer() {
        executionLayerOpen = true
        executionLayer.visibility = View.VISIBLE
        renderExecutionCommand()
    }

    private fun closeExecutionLayer() {
        if (isExecutionVoiceCommandActive) {
            stopVoiceTyping(cancel = true)
        }
        executionLayerOpen = false
        executionCommand.clear()
        executionOverlayRoot?.let { overlay ->
            try {
                val manager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
                manager.removeView(overlay)
            } catch (e: RuntimeException) {
                Log.w(LOG_TAG, "Unable to remove execution overlay", e)
            } finally {
                executionOverlayRoot = null
            }
        }
        if (::executionLayer.isInitialized) {
            executionLayer.visibility = View.GONE
        }
    }

    private fun renderExecutionCommand() {
        if (!::executionCommandText.isInitialized) return
        val command = executionCommand.toString()
        executionCommandText.text = command.ifBlank { "What do you want done?" }
        executionCommandText.setTextColor(
            if (command.isBlank()) Color.rgb(72, 100, 122) else Color.rgb(9, 37, 58)
        )
    }

    private fun renderExecutionStatus(message: String) {
        if (::executionStatusText.isInitialized) {
            executionStatusText.text = message
        }
    }

    private fun renderExecutionVoiceButton() {
        executionVoiceButton?.let { button ->
            button.text = if (isExecutionVoiceCommandActive) "Listening..." else "Speak: Open Instagram"
            button.setTextColor(
                if (isExecutionVoiceCommandActive) Color.rgb(0, 120, 72) else Color.rgb(12, 54, 82)
            )
        }
    }

    private fun setupNumberRow(sizing: KeyboardSizingProfile = currentKeyboardSizing()) {
        val stripKeys = stripKeysForMode(mode)
        if (stripKeys.isEmpty()) {
            numberRow.visibility = View.GONE
            numberRow.layoutParams = numberRow.layoutParams.apply {
                height = 0
            }
            numberRow.removeAllViews()
            numberRowButtons.clear()
            return
        }
        numberRow.visibility = View.VISIBLE
        numberRow.layoutParams = numberRow.layoutParams.apply {
            height = sizing.numberRowHeightPx
        }
        numberRow.setPadding(sizing.numberRowHorizontalPaddingPx, 0, sizing.numberRowHorizontalPaddingPx, 0)
        if (numberRowButtons.size == stripKeys.size && numberRow.childCount == stripKeys.size) {
            stripKeys.forEachIndexed { index, key ->
                configureStripKeyButton(numberRowButtons[index], key, sizing)
            }
            return
        }

        numberRow.removeAllViews()
        numberRowButtons.clear()
        stripKeys.forEach { key ->
            val button = HintKeyButton(this).apply {
                isAllCaps = false
                stateListAnimator = null
                elevation = 0f
                minWidth = 0
                minimumWidth = 0
                minHeight = 0
                minimumHeight = 0
                setPadding(0, 0, 0, 0)
                gravity = Gravity.CENTER
                setIncludeFontPadding(false)
                setSingleLine(true)
            }
            configureStripKeyButton(button, key, sizing)
            numberRow.addView(button)
            numberRowButtons.add(button)
        }
    }

    private fun configureStripKeyButton(button: Button, key: String, sizing: KeyboardSizingProfile) {
        button.apply {
            text = key
            tag = key
            contentDescription = if (key.length == 1 && key[0].isDigit()) {
                KeyboardSymbols.numberAccessibilityLabel(key)
            } else {
                KeyboardSymbols.accessibilityLabelForKey(key, currentImeAction.label)
            }
            (this as? HintKeyButton)?.setSymbolHint(null)
            textSize = 14.5f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(textColorForKey(key))
            background = resources.getDrawable(keyBackgroundResForKey(key), theme)
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            ).apply {
                setMargins(sizing.keyHorizontalMarginPx, 0, sizing.keyHorizontalMarginPx, 0)
            }
            setOnTouchListener { view, event -> handleTouch(view as Button, key, event) }
        }
    }

    private fun acceptSuggestion(suggestion: String) {
        val ic = currentInputConnection ?: return
        val partialLength = currentWord.length
        if (partialLength > 0) {
            if (!deleteSurroundingTextSafely(ic, partialLength, 0, "suggestion")) return
        }

        val committedWord = suggestion.trim().lowercase()
        val previousWord = contextWords.lastOrNull()
        if (!commitTextSafely(ic, "$suggestion ", "suggestion")) return
        metrics.recordSuggestionAccepted(committedWord, partialLength)
        pendingSuggestionImpression = false

        if (committedWord.length >= 2) {
            predictor.learnAcceptedSuggestion(committedWord, previousWord)
            lastAcceptedSuggestion = committedWord
            lastAcceptedSuggestionPreviousWord = previousWord
            contextWords.add(committedWord)
            if (contextWords.size > 2) {
                contextWords.removeAt(0)
            }
        }

        currentWord.clear()
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun setupEmojiPanelContent() {
        if (recentEmojis.isEmpty()) {
            loadRecentEmojis()
        }
        val baseCategories = KeyboardSymbols.EMOJI_CATEGORIES.map { category ->
            category.copy(emojis = sanitizeEmojiList(category.emojis))
        }
        var categories = buildEmojiCategories(baseCategories)
        var currentEmojis = categories.firstOrNull()?.emojis ?: sanitizeEmojiList(KeyboardSymbols.EMOJI_PANEL)
        val emojiCellSize = dp(34)

        emojiGrid.numColumns = 9
        emojiGrid.stretchMode = GridView.STRETCH_COLUMN_WIDTH
        emojiGrid.verticalSpacing = dp(2)
        emojiGrid.horizontalSpacing = dp(1)
        emojiGrid.setPadding(dp(4), dp(5), dp(4), dp(2))
        emojiGrid.clipToPadding = false

        val emojiAdapter = EmojiGridAdapter(currentEmojis, emojiCellSize)
        emojiGrid.adapter = emojiAdapter
        emojiGrid.setOnItemClickListener { _, _, pos, _ ->
            val selected = currentEmojis.getOrNull(pos) ?: return@setOnItemClickListener
            if (commitTextSafely(currentInputConnection, selected, "emoji")) {
                recordRecentEmoji(selected)
                recordCommitLatency()
                maybeFlushMetrics()
            }
        }

        fun rebuildCategoryTabs() {
            categories = buildEmojiCategories(baseCategories)
            if (selectedEmojiCategoryIndex >= categories.size) {
                selectedEmojiCategoryIndex = 0
            }
            emojiCategoryBar.removeAllViews()
            categories.forEachIndexed { index, category ->
                val tab = TextView(this).apply {
                    text = category.icon
                    textSize = 18f
                    gravity = Gravity.CENTER
                    setPadding(dp(8), dp(3), dp(8), dp(3))
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(dp(2), dp(4), dp(2), dp(4))
                    }
                    background = resources.getDrawable(R.drawable.key_bg, theme)
                    contentDescription = emojiCategoryAccessibilityLabel(category, index)
                    alpha = if (index == selectedEmojiCategoryIndex) 1f else 0.66f
                    setOnClickListener {
                        selectedEmojiCategoryIndex = index
                        currentEmojis = category.emojis
                        emojiAdapter.updateEmojis(currentEmojis)
                        for (childIndex in 0 until emojiCategoryBar.childCount) {
                            emojiCategoryBar.getChildAt(childIndex).alpha =
                                if (childIndex == selectedEmojiCategoryIndex) 1f else 0.66f
                        }
                    }
                }
                emojiCategoryBar.addView(tab)
            }
            currentEmojis = categories.getOrNull(selectedEmojiCategoryIndex)?.emojis.orEmpty()
            emojiAdapter.updateEmojis(currentEmojis)
        }
        rebuildCategoryTabs()

        emojiBackButton.contentDescription = "Back to keyboard"
        emojiBackButton.setOnClickListener {
            emojiContainer.visibility = View.GONE
            mainContainer.visibility = View.VISIBLE
        }
    }

    private inner class EmojiGridAdapter(
        emojis: List<String>,
        private val cellSize: Int
    ) : BaseAdapter() {
        private val emojis = ArrayList<String>(emojis)

        override fun getCount(): Int = emojis.size
        override fun getItem(position: Int): Any = emojis[position]
        override fun getItemId(position: Int): Long = position.toLong()

        fun updateEmojis(updated: List<String>) {
            emojis.clear()
            emojis.addAll(updated)
            notifyDataSetChanged()
        }

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val label = (convertView as? TextView) ?: TextView(this@KeyboardService).apply {
                layoutParams = AbsListView.LayoutParams(cellSize, cellSize)
                gravity = Gravity.CENTER
                textSize = 23f
                includeFontPadding = false
                setTextColor(Color.WHITE)
            }
            val emoji = emojis[position]
            label.text = emoji
            label.contentDescription = emojiAccessibilityLabel(emoji)
            return label
        }
    }

    private fun sanitizeEmojiList(input: List<String>): List<String> =
        input.filter { emojiGlyphPaint.hasGlyph(it) }

    private fun buildEmojiCategories(baseCategories: List<KeyboardSymbols.EmojiCategory>): List<KeyboardSymbols.EmojiCategory> {
        val output = ArrayList<KeyboardSymbols.EmojiCategory>(baseCategories.size + 1)
        if (recentEmojis.isNotEmpty()) {
            output.add(KeyboardSymbols.EmojiCategory("\uD83D\uDD52", recentEmojis.toList()))
        }
        output.addAll(baseCategories)
        return output
    }

    private fun emojiCategoryAccessibilityLabel(
        category: KeyboardSymbols.EmojiCategory,
        index: Int
    ): String {
        if (category.icon == "\uD83D\uDD52") return "Recent emoji"
        val baseIndex = index - if (recentEmojis.isNotEmpty()) 1 else 0
        return when (baseIndex) {
            0 -> "Smileys emoji"
            1 -> "People emoji"
            2 -> "Animals and nature emoji"
            3 -> "Food emoji"
            4 -> "Objects and travel emoji"
            5 -> "Symbols and flags emoji"
            else -> "Emoji category"
        }
    }

    private fun emojiAccessibilityLabel(emoji: String): String {
        val hint = emojiSearchHint(emoji)
        return if (hint == "emoji") "Emoji $emoji" else "Emoji $hint"
    }

    private fun emojiSearchHint(emoji: String): String = when (emoji) {
        "\uD83D\uDE00" -> "grin smile happy face joy"
        "\uD83D\uDE03" -> "smile happy face grin"
        "\uD83D\uDE02" -> "laugh tears happy lol"
        "\uD83D\uDE0D" -> "heart love face eyes"
        "\uD83D\uDE18" -> "kiss love face"
        "\uD83D\uDE22" -> "cry sad face tears"
        "\uD83D\uDE21" -> "angry mad face"
        "\uD83D\uDE2D" -> "cry sob tears sad"
        "\uD83D\uDE31" -> "fear shocked face"
        "\uD83E\uDD2E" -> "vomit sick face"
        "\uD83E\uDD27" -> "crazy face"
        "\uD83D\uDC4D" -> "thumbs up like hand"
        "\uD83D\uDC4E" -> "thumbs down dislike hand"
        "\uD83D\uDC4F" -> "clap hand applause"
        "\uD83D\uDCAA" -> "muscle strong gym arm"
        "\uD83D\uDE4F" -> "pray thanks folded hands"
        "\uD83D\uDC4B" -> "wave hello hand"
        "\uD83D\uDC36" -> "dog animal pet"
        "\uD83D\uDC31" -> "cat animal pet"
        "\uD83D\uDC3B" -> "bear animal"
        "\uD83D\uDC2F" -> "tiger animal"
        "\uD83E\uDD81" -> "lion animal"
        "\uD83D\uDC37" -> "pig animal"
        "\uD83D\uDC14" -> "chicken bird animal"
        "\uD83D\uDC1F" -> "fish sea animal"
        "\uD83D\uDC19" -> "octopus sea animal"
        "\uD83C\uDF38" -> "flower nature"
        "\uD83C\uDF32" -> "tree nature"
        "\uD83C\uDF4E" -> "apple fruit food"
        "\uD83C\uDF55" -> "pizza food"
        "\uD83C\uDF54" -> "burger food"
        "\uD83C\uDF5F" -> "fries food"
        "\u2615" -> "coffee drink"
        "\uD83C\uDF7A" -> "beer drink"
        "\uD83E\uDD64" -> "cup drink tea"
        "\uD83D\uDCF1" -> "phone mobile object"
        "\uD83D\uDCBB" -> "laptop computer object"
        "\uD83D\uDCF7" -> "camera photo object"
        "\uD83D\uDCBC" -> "briefcase work office object"
        "\u2699\uFE0F" -> "gear settings object"
        "\uD83D\uDE97" -> "car vehicle travel"
        "\uD83D\uDE8C" -> "bus vehicle travel"
        "\u2708\uFE0F" -> "plane travel"
        "\uD83D\uDE80" -> "rocket travel space"
        "\u26F5" -> "boat ship travel"
        "\u2764\uFE0F" -> "heart symbol love"
        "\uD83D\uDD25" -> "fire hot"
        "\u2728" -> "sparkles stars"
        "\uD83C\uDF89" -> "party celebration"
        "\uD83D\uDCAF" -> "hundred score"
        "\u2705" -> "check tick done"
        "\u26A0\uFE0F" -> "warning alert"
        "\uD83D\uDD34" -> "red circle symbol"
        "\uD83D\uDFE2" -> "green circle symbol"
        "\uD83D\uDD35" -> "blue circle symbol"
        else -> "emoji"
    }

    private fun recordRecentEmoji(emoji: String) {
        recentEmojis.remove(emoji)
        recentEmojis.add(0, emoji)
        if (recentEmojis.size > MAX_RECENT_EMOJIS) {
            recentEmojis.removeAt(recentEmojis.lastIndex)
        }
        saveRecentEmojis()
    }

    private fun loadRecentEmojis() {
        val prefs = getSharedPreferences("keyboard_prefs", MODE_PRIVATE)
        val raw = prefs.getString(PREFS_EMOJI_RECENTS_KEY, "").orEmpty()
        if (raw.isBlank()) return
        recentEmojis.clear()
        raw.split(RECENT_DELIMITER)
            .filter { it.isNotBlank() }
            .take(MAX_RECENT_EMOJIS)
            .forEach { recentEmojis.add(it) }
    }

    private fun saveRecentEmojis() {
        val prefs = getSharedPreferences("keyboard_prefs", MODE_PRIVATE)
        val payload = recentEmojis.joinToString(RECENT_DELIMITER)
        prefs.edit().putString(PREFS_EMOJI_RECENTS_KEY, payload).apply()
    }

    private fun buildKeyboard() {
        collapseSwipeTrailForMeasurement()
        keyboardLayout.removeAllViews()
        keyButtons.clear()
        val sizing = currentKeyboardSizing()
        if (cachedKeyboardSizing != sizing) {
            clearCachedKeyboardViews()
            cachedKeyboardSizing = sizing
        }
        applyKeyboardSizing(sizing)
        setupNumberRow(sizing)

        val rows = keyboardRowsByMode[mode] ?: createKeyboardRows(mode, sizing)
        val buttons = keyboardButtonsByMode[mode].orEmpty()
        keyButtons.addAll(buttons)
        rows.forEach { rowLayout ->
            keyboardLayout.addView(rowLayout)
        }

        updateActionKeyUI()
        updateShiftUI()
        updateVoiceKeyUI()
        keyboardPanel.post {
            refreshCachedKeyBounds()
            syncSwipeTrailToMeasuredPanel()
        }
    }

    private fun createKeyboardRows(mode: Mode, sizing: KeyboardSizingProfile): List<LinearLayout> {
        val createdRows = mutableListOf<LinearLayout>()
        val createdButtons = mutableListOf<Button>()
        keyRowsForMode(mode).forEachIndexed { index, row ->
            val rowLayout = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                setPadding(rowSidePadding(index, sizing), 0, rowSidePadding(index, sizing), 0)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    sizing.keyHeightPx
                ).apply {
                    setMargins(0, sizing.rowVerticalMarginPx, 0, sizing.rowVerticalMarginPx)
                }
            }
            rowLayout.setOnTouchListener { _, event -> handleRowTouch(rowLayout, event) }

            row.forEach { key ->
                val btn = createKeyButton(key, sizing)
                rowLayout.addView(btn)
                createdButtons.add(btn)
            }

            createdRows.add(rowLayout)
        }
        keyboardRowsByMode[mode] = createdRows
        keyboardButtonsByMode[mode] = createdButtons
        return createdRows
    }

    private fun keyRowsForMode(mode: Mode): List<List<String>> = when (mode) {
        Mode.LETTERS -> listOf(
            listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p"),
            listOf("a", "s", "d", "f", "g", "h", "j", "k", "l"),
            listOf(KEY_SHIFT, "z", "x", "c", "v", "b", "n", "m", KEY_BACKSPACE),
            listOf(KEY_EMOJI, "123", ",", KEY_SPACE, ".", KEY_ENTER)
        )
        Mode.NUMBERS -> listOf(
            listOf("+", "\u00D7", KeyboardSymbols.DIVIDE, "=", "/", "_", "<", ">", "[", "]"),
            listOf("!", "@", "#", KeyboardSymbols.RUPEE, "%", "^", "&", "*", "(", ")"),
            listOf("1/2", "-", "'", "\"", ":", ";", ",", "?", KEY_BACKSPACE),
            listOf("ABC", ",", KEY_SPACE, ".", KEY_ENTER)
        )
        Mode.SYMBOLS -> listOf(
            listOf("`", "~", "\\", "|", "{", "}", KeyboardSymbols.EURO, KeyboardSymbols.POUND, KeyboardSymbols.YEN, "$"),
            listOf("\u00B0", KeyboardSymbols.BULLET, "\u25CB", "\u25CF", "\u25A1", "\u25A0", "\u2664", "\u2662", "\u2667"),
            listOf("\u00A7", "\u00B6", "\u00A9", "\u00AE", "\u2122", "\u00B1", "\u2248", "\u2260", "\u2264", "\u2265"),
            listOf("2/2", "\u2606", "\u25AA", "\u00A4", "\u00AB", "\u00BB", "\u00A1", "\u00BF", KEY_BACKSPACE),
            listOf("ABC", ",", KEY_SPACE, ".", KEY_ENTER)
        )
    }

    private fun stripKeysForMode(mode: Mode): List<String> = when (mode) {
        Mode.LETTERS -> NUMBER_ROW_KEYS
        Mode.NUMBERS -> NUMBER_ROW_KEYS
        Mode.SYMBOLS -> emptyList()
    }

    private fun clearCachedKeyboardViews() {
        keyboardRowsByMode.clear()
        keyboardButtonsByMode.clear()
        cachedKeyBounds.clear()
        numberRowButtons.clear()
        if (::numberRow.isInitialized) {
            numberRow.removeAllViews()
        }
    }

    private fun collapseSwipeTrailForMeasurement() {
        if (!::swipeTrailView.isInitialized) return
        val params = swipeTrailView.layoutParams as? FrameLayout.LayoutParams ?: return
        if (params.height != 0) {
            params.height = 0
            swipeTrailView.layoutParams = params
        }
    }

    private fun syncSwipeTrailToMeasuredPanel() {
        if (!::swipeTrailView.isInitialized || !::keyboardPanel.isInitialized) return
        val measuredHeight = keyboardPanel.height
        if (measuredHeight <= 0) return

        val params = swipeTrailView.layoutParams as? FrameLayout.LayoutParams ?: return
        if (params.height != measuredHeight) {
            params.width = FrameLayout.LayoutParams.MATCH_PARENT
            params.height = measuredHeight
            swipeTrailView.layoutParams = params
        }
    }

    private fun applyKeyboardSizing(sizing: KeyboardSizingProfile) {
        keyboardContent.setPadding(
            sizing.panelHorizontalPaddingPx,
            sizing.panelTopPaddingPx,
            sizing.panelHorizontalPaddingPx,
            sizing.panelBottomPaddingPx
        )
        suggestionBar.layoutParams = suggestionBar.layoutParams.apply {
            height = sizing.suggestionBarHeightPx
        }
    }

    private fun currentKeyboardSizing(): KeyboardSizingProfile {
        val metrics = resources.displayMetrics
        val configuration = resources.configuration
        val density = metrics.density.coerceAtLeast(1f)
        val fallbackWidthDp = (metrics.widthPixels / density).toInt()
        val fallbackHeightDp = (metrics.heightPixels / density).toInt()
        val widthDp = if (configuration.screenWidthDp != Configuration.SCREEN_WIDTH_DP_UNDEFINED) {
            configuration.screenWidthDp
        } else {
            fallbackWidthDp
        }.coerceAtLeast(1)
        val heightDp = if (configuration.screenHeightDp != Configuration.SCREEN_HEIGHT_DP_UNDEFINED) {
            configuration.screenHeightDp
        } else {
            fallbackHeightDp
        }.coerceAtLeast(1)
        val widthPx = (widthDp * density).roundToInt().coerceAtLeast(1)
        val heightPx = (heightDp * density).roundToInt().coerceAtLeast(1)
        val smallestWidthDp = if (
            configuration.smallestScreenWidthDp != Configuration.SMALLEST_SCREEN_WIDTH_DP_UNDEFINED
        ) {
            configuration.smallestScreenWidthDp
        } else {
            widthDp
        }
        return KeyboardSizingProfile.fromDevice(
            widthPx = widthPx,
            heightPx = heightPx,
            density = density,
            smallestWidthDp = smallestWidthDp,
            navigationBottomInsetPx = navigationBottomInsetPx,
            fallbackNavigationBottomInsetPx = 0
        )
    }

    private fun rowSidePadding(rowIndex: Int, sizing: KeyboardSizingProfile): Int = when (mode) {
        Mode.LETTERS -> when (rowIndex) {
            1 -> sizing.homeRowSidePaddingPx
            2 -> sizing.bottomRowSidePaddingPx
            else -> sizing.topRowSidePaddingPx
        }
        else -> sizing.topRowSidePaddingPx
    }

    private fun createKeyButton(key: String, sizing: KeyboardSizingProfile): Button {
        return HintKeyButton(this).apply {
            text = displayTextForKey(key)
            tag = key
            contentDescription = KeyboardSymbols.accessibilityLabelForKey(key, currentImeAction.label)
            setSymbolHint(LongPressSymbolMap.hintFor(key))
            isAllCaps = false
            stateListAnimator = null
            elevation = 0f
            minWidth = 0
            minimumWidth = 0
            minHeight = 0
            minimumHeight = 0
            setPadding(0, 0, 0, 0)
            textSize = when (key) {
                KEY_SHIFT, KEY_BACKSPACE -> 17.5f
                KEY_ENTER -> if (currentImeAction == ImeAction.Enter) 19f else 13f
                KEY_SPACE -> 11f
                else -> 18f
            }
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setIncludeFontPadding(false)
            setSingleLine(true)
            setTextColor(textColorForKey(key))
            background = resources.getDrawable(keyBackgroundResForKey(key), theme)

            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                keyWeight(key)
            ).apply {
                setMargins(
                    sizing.keyHorizontalMarginPx,
                    sizing.keyVerticalMarginPx,
                    sizing.keyHorizontalMarginPx,
                    sizing.keyVerticalMarginPx
                )
            }

            setOnTouchListener { view, event -> handleTouch(view as Button, key, event) }
        }
    }

    private fun keyWeight(key: String): Float = when (key) {
        KEY_SPACE -> 5.05f
        KEY_SHIFT, KEY_BACKSPACE -> 1.28f
        KEY_ENTER -> 1.42f
        "123", "ABC", "#+=", KEY_EMOJI -> 0.96f
        else -> 1f
    }

    private fun displayTextForKey(key: String): String = when (key) {
        KEY_SPACE -> ""
        KEY_ENTER -> currentImeAction.label
        else -> key
    }

    private fun confidenceZoneForKey(key: String): KeyConfidenceZone = when {
        key == "q" || key == "a" || key == "z" || key == "1" -> KeyConfidenceZone.LEFT_EDGE
        key == "p" || key == "l" || key == "m" || key == "0" || key == KEY_BACKSPACE ->
            KeyConfidenceZone.RIGHT_EDGE
        key == KEY_SPACE || key == KEY_EMOJI || key == "123" || key == "ABC" ||
            key == "#+=" || key == KEY_SHIFT -> KeyConfidenceZone.BOTTOM_MODIFIER
        key == KEY_ENTER -> KeyConfidenceZone.ACTION_EDGE
        key.length == 1 && (key[0] in 'a'..'z' || key[0] in '2'..'9') -> KeyConfidenceZone.CENTER_ALPHA
        else -> KeyConfidenceZone.UNKNOWN
    }

    private fun textColorForKey(key: String): Int = when {
        key == KEY_ENTER -> Color.rgb(216, 224, 234)
        isModifierKey(key) -> Color.rgb(186, 195, 206)
        else -> Color.rgb(244, 247, 250)
    }

    private fun keyBackgroundResForKey(key: String): Int = when {
        key == KEY_ENTER -> R.drawable.key_bg_action
        key == KEY_SPACE -> R.drawable.key_bg_space
        isModifierKey(key) || key == KEY_SPACE -> R.drawable.key_bg_modifier
        else -> R.drawable.key_bg
    }

    private fun isModifierKey(key: String): Boolean = when (key) {
        KEY_EMOJI, "123", "ABC", "#+=", KEY_ENTER, KEY_SHIFT, KEY_BACKSPACE -> true
        else -> false
    }

    private fun handleTouch(
        button: Button,
        key: String,
        event: MotionEvent,
        localX: Float = event.x,
        localY: Float = event.y
    ): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val now = SystemClock.elapsedRealtime()
                lastKeyDownAtMs = now
                metrics.recordTypingTouch(now, confidenceZoneForKey(key))
                applyKeyPressFeedback(button, key)
                showKeyPreview(button, key)
                startSwipeTrackingIfEligible(key, event)
                isLongPressActive = false
                handleKeyDown(key, event)
            }

            MotionEvent.ACTION_MOVE -> {
                if (key != KEY_SPACE && updateSwipeTracking(event)) {
                    return true
                }
                val inside = isInsideExpandedTouchTarget(button, localX, localY)
                button.isPressed = inside
                if (!inside) {
                    dismissKeyPreviewSafely()
                }
            }

            MotionEvent.ACTION_UP -> {
                if (swipeTracker.isActive) {
                    dismissKeyPreviewSafely()
                    releaseKeyPressFeedback(button)
                    finishSwipeGesture()
                    button.performClick()
                    return true
                }
                swipeTrailView.resetNow()
                dismissKeyPreviewSafely()
                releaseKeyPressFeedback(button)
                handleKeyUp(key)
                button.performClick()
            }

            MotionEvent.ACTION_CANCEL -> {
                lastKeyDownAtMs = 0L
                cancelActiveTouchState(button)
            }
        }

        return true
    }

    private fun startSwipeTrackingIfEligible(key: String, event: MotionEvent) {
        if (!isSwipeLetterKey(key) || mode != Mode.LETTERS) {
            cancelSwipeGesture()
            return
        }

        swipeTrackingStarted = true
        if (cachedKeyBounds.isEmpty()) {
            refreshCachedKeyBounds()
        }
        updateEventPointInKeyboardPanel(event)
        swipeTracker.start(
            swipePanelX,
            swipePanelY,
            key[0],
            event.eventTime,
            event.pressure,
            event.touchMajor
        )
        swipeTrailView.start(swipePanelX, swipePanelY)
    }

    private fun updateSwipeTracking(event: MotionEvent): Boolean {
        if (!swipeTrackingStarted) {
            return false
        }
        if (mode != Mode.LETTERS) {
            return false
        }

        updateEventPointInKeyboardPanel(event)
        val hitButton = findKeyAtRawPosition(event.rawX, event.rawY, lettersOnly = true)
        val hitKey = (hitButton?.tag as? String)
        val crossedNewKey = swipeTracker.move(
            swipePanelX,
            swipePanelY,
            hitKey?.firstOrNull() ?: '\u0000',
            event.eventTime,
            event.pressure,
            event.touchMajor
        )

        if (!swipeTracker.isActive) {
            return false
        }

        cancelLongPress()
        dismissKeyPreviewSafely()
        swipeTrailView.addPoint(swipePanelX, swipePanelY)
        updateSwipePressedKey(hitButton)
        if (crossedNewKey && hitButton != null) {
            performSwipeTickHaptic(hitButton)
        }
        return true
    }

    private fun finishSwipeGesture() {
        cancelLongPress()
        stopRepeatingDelete()
        stopRepeatingSpace()
        clearSwipePressedKey()
        val gesture = swipeTracker.finishGesture()
        val trailDiagnostics = swipeTrailView.diagnosticsSnapshot()
        swipeTrackingStarted = false
        swipeTrailView.fadeAndReset()
        if (gesture.weightedSequence.isEmpty()) {
            Log.w(SWIPE_DEBUG_TAG, "swipe finished with empty sequence")
        }
        commitSwipeSequence(gesture, trailDiagnostics)
    }

    private fun cancelSwipeGesture() {
        val hadSwipeInProgress = swipeTrackingStarted || swipeTracker.isActive
        val sequenceLength = swipeTracker.keySequence.length
        swipeTrackingStarted = false
        swipeTracker.cancel()
        if (::swipeTrailView.isInitialized) {
            swipeTrailView.resetNow()
        }
        clearSwipePressedKey()
        swipeHapticGate.reset()
        if (hadSwipeInProgress) {
            metrics.recordSwipeFailure(sequenceLength, candidateCount = 0, interrupted = true)
        }
    }

    private fun handleRowTouch(row: LinearLayout, event: MotionEvent): Boolean {
        val target = if (event.actionMasked == MotionEvent.ACTION_DOWN) {
            findNearestKeyInRow(row, event.x)
        } else {
            routedTouchButton
        } ?: return false

        val key = (target.tag as? String) ?: routedTouchKey ?: return false
        routedTouchButton = target
        routedTouchKey = key

        val localX = event.x - target.left
        val localY = event.y - target.top
        return try {
            handleTouch(target, key, event, localX, localY)
        } finally {
            if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
                clearRoutedTouchOwner()
            }
        }
    }

    private fun cancelActiveTouchState(button: Button) {
        cancelLongPress()
        stopRepeatingDelete()
        stopRepeatingSpace()
        resetSpaceHoldState()
        dismissKeyPreviewSafely()
        releaseKeyPressFeedback(button)
        cancelSwipeGesture()
        hapticTapGate.reset()
        isLongPressActive = false
    }

    private fun findNearestKeyInRow(row: LinearLayout, x: Float): Button? {
        val slop = dp(TOUCH_SLOP_HORIZONTAL_DP)
        var bestButton: Button? = null
        var bestDistance = Int.MAX_VALUE

        for (index in 0 until row.childCount) {
            val child = row.getChildAt(index) as? Button ?: continue
            if (x < child.left - slop || x > child.right + slop) continue

            val centerX = child.left + child.width / 2
            val distance = kotlin.math.abs(x - centerX).toInt()
            if (distance < bestDistance) {
                bestDistance = distance
                bestButton = child
            }
        }

        return bestButton
    }

    private fun applyKeyPressFeedback(button: Button, key: String) {
        button.parent?.requestDisallowInterceptTouchEvent(true)
        button.isPressed = true
        button.jumpDrawablesToCurrentState()
        button.scaleX = KEY_PRESS_SCALE
        button.scaleY = KEY_PRESS_SCALE
        button.translationY = dp(1).toFloat()
        button.elevation = 0f
        performKeyboardTapSound(key)
        performKeyboardTapHaptic(button, key)
    }

    private fun releaseKeyPressFeedback(button: Button) {
        button.parent?.requestDisallowInterceptTouchEvent(false)
        button.isPressed = false
        button.scaleX = 1f
        button.scaleY = 1f
        button.translationY = 0f
        button.elevation = 0f
    }

    private fun showKeyPreview(anchor: Button, key: String) {
        if (!shouldShowKeyPreview(key) || !anchor.isAttachedToWindow || anchor.windowToken == null) {
            return
        }

        val popup = ensureKeyPreviewPopup()
        val previewText = keyPreviewText ?: return
        val previewLabel = displayTextForPreview(anchor, key)
        previewText.text = previewLabel
        previewText.contentDescription = KeyboardSymbols.accessibilityLabelForKey(key, currentImeAction.label)

        try {
            val xOffset = (anchor.width - dp(KEY_PREVIEW_WIDTH_DP)) / 2
            val yOffset = -anchor.height - dp(KEY_PREVIEW_HEIGHT_DP) + dp(4)
            if (popup.isShowing) {
                popup.update(anchor, xOffset, yOffset, dp(KEY_PREVIEW_WIDTH_DP), dp(KEY_PREVIEW_HEIGHT_DP))
            } else {
                popup.showAsDropDown(anchor, xOffset, yOffset, Gravity.NO_GRAVITY)
            }
        } catch (e: RuntimeException) {
            metrics.recordPopupFailure(e.javaClass.simpleName.ifEmpty { "preview-show" })
            dismissKeyPreviewSafely()
            maybeFlushMetrics()
        }
    }

    private fun ensureKeyPreviewPopup(): PopupWindow {
        keyPreviewPopup?.let { return it }

        val content = layoutInflater.inflate(R.layout.key_preview, root, false)
        keyPreviewText = content.findViewById(R.id.previewText)
        return PopupWindow(content, dp(KEY_PREVIEW_WIDTH_DP), dp(KEY_PREVIEW_HEIGHT_DP), false).apply {
            isOutsideTouchable = false
            isClippingEnabled = false
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            elevation = dp(10).toFloat()
            keyPreviewPopup = this
        }
    }

    private fun shouldShowKeyPreview(key: String): Boolean {
        return false
    }

    private fun displayTextForPreview(anchor: Button, key: String): String =
        if (key == KEY_ENTER) currentImeAction.label else anchor.text.toString()

    private fun handleKeyDown(key: String, event: MotionEvent) {
        if (executionLayerOpen) {
            handleExecutionCommandKeyDown(key)
            return
        }
        when (key) {
            KEY_BACKSPACE -> {
                deleteOneCharacter()
                startRepeatingDelete()
            }

            KEY_SHIFT -> {
                    scheduleLongPress(SHIFT_LONG_PRESS_DELAY_MS) {
                    isLongPressActive = true
                    isShiftLongPressing = true
                    prevShiftStateBeforeLongPress = shiftState
                    shiftState = ShiftState.ON
                    updateShiftUI()
                }
            }

            KEY_SPACE -> {
                handleSpaceDown()
            }

            KEY_MIC -> Unit

            else -> {
                if (LongPressSymbolMap.symbolFor(key) != null) {
                    scheduleLongPress(SYMBOL_LONG_PRESS_DELAY_MS) {
                        isLongPressActive = true
                        commitLongPressSymbol(key)
                    }
                }
            }
        }
    }

    private fun isInsideExpandedTouchTarget(button: View, x: Float, y: Float): Boolean {
        val horizontalSlop = dp(TOUCH_SLOP_HORIZONTAL_DP)
        val verticalSlop = dp(TOUCH_SLOP_VERTICAL_DP)
        return x >= -horizontalSlop &&
            x <= button.width + horizontalSlop &&
            y >= -verticalSlop &&
            y <= button.height + verticalSlop
    }

    private fun isSwipeLetterKey(key: String): Boolean =
        key.length == 1 && key[0] in 'a'..'z'

    private fun updateEventPointInKeyboardPanel(event: MotionEvent) {
        swipePanelX = event.rawX - cachedPanelScreenX
        swipePanelY = event.rawY - cachedPanelScreenY
    }

    private fun findKeyAtRawPosition(rawX: Float, rawY: Float, lettersOnly: Boolean): Button? {
        val horizontalSlop = dp(TOUCH_SLOP_HORIZONTAL_DP)
        val verticalSlop = dp(TOUCH_SLOP_VERTICAL_DP)
        var bestButton: Button? = null
        var bestDistance = Int.MAX_VALUE

        for (button in keyButtons) {
            val key = button.tag as? String ?: continue
            if (lettersOnly && !isSwipeLetterKey(key)) continue

            val bounds = cachedKeyBounds[button] ?: continue
            val left = bounds.left - horizontalSlop
            val top = bounds.top - verticalSlop
            val right = bounds.right + horizontalSlop
            val bottom = bounds.bottom + verticalSlop
            if (rawX < left || rawX > right || rawY < top || rawY > bottom) continue

            val distance = kotlin.math.abs(rawX - bounds.centerX).toInt() +
                kotlin.math.abs(rawY - bounds.centerY).toInt()
            if (distance < bestDistance) {
                bestDistance = distance
                bestButton = button
            }
        }

        return bestButton
    }

    private fun refreshCachedKeyBounds() {
        if (!::keyboardPanel.isInitialized) return
        keyboardPanel.getLocationOnScreen(screenLocationBuffer)
        cachedPanelScreenX = screenLocationBuffer[0]
        cachedPanelScreenY = screenLocationBuffer[1]
        cachedKeyBounds.clear()

        for (button in keyButtons) {
            if (button.width <= 0 || button.height <= 0 || button.visibility != View.VISIBLE) continue
            button.getLocationOnScreen(screenLocationBuffer)
            val left = screenLocationBuffer[0]
            val top = screenLocationBuffer[1]
            val right = left + button.width
            val bottom = top + button.height
            cachedKeyBounds[button] = CachedKeyBounds(
                left = left,
                top = top,
                right = right,
                bottom = bottom,
                centerX = left + button.width / 2,
                centerY = top + button.height / 2
            )
        }
    }

    private fun updateSwipePressedKey(button: Button?) {
        if (button == null || button === swipePressedButton) return
        clearSwipePressedKey()
        swipePressedButton = button
        button.isPressed = true
        button.jumpDrawablesToCurrentState()
        button.scaleX = KEY_PRESS_SCALE
        button.scaleY = KEY_PRESS_SCALE
        button.translationY = dp(1).toFloat()
        button.elevation = 0f
    }

    private fun clearSwipePressedKey() {
        swipePressedButton?.let { releaseKeyPressFeedback(it) }
        swipePressedButton = null
    }

    private fun handleKeyUp(key: String) {
        val wasLongPress = isLongPressActive
        cancelLongPress()

        if (executionLayerOpen) {
            handleExecutionCommandKeyUp(key)
            return
        }

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
                stopRepeatingSpace()
                handleSpaceUp(wasLongPress)
                resetSpaceHoldState()
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
        var interval = DELETE_REPEAT_START_INTERVAL_MS
        repeatingDelete = object : Runnable {
            override fun run() {
                deleteOneCharacter()
                interval = max(DELETE_REPEAT_MIN_INTERVAL_MS, interval - DELETE_REPEAT_ACCELERATION_MS)
                mainHandler.postDelayed(this, interval)
            }
        }.also {
            mainHandler.postDelayed(it, DELETE_REPEAT_INITIAL_DELAY_MS)
        }
    }

    private fun stopRepeatingDelete() {
        repeatingDelete?.let(mainHandler::removeCallbacks)
        repeatingDelete = null
    }

    private fun startRepeatingSpace() {
        if (repeatingSpace != null) return
        repeatingSpace = object : Runnable {
            override fun run() {
                commitSpace()
                mainHandler.postDelayed(this, SPACE_REPEAT_INTERVAL_MS)
            }
        }.also {
            it.run()
        }
    }

    private fun stopRepeatingSpace() {
        repeatingSpace?.let(mainHandler::removeCallbacks)
        repeatingSpace = null
    }

    private fun handleExecutionCommandKeyDown(key: String) {
        when (key) {
            KEY_BACKSPACE -> deleteExecutionCommandCharacter()
            KEY_SPACE -> appendExecutionCommand(" ")
            KEY_ENTER -> executeExecutionCommand(executionCommand.toString())
            KEY_SHIFT, KEY_EMOJI, "123", "ABC", "#+=" -> Unit
            else -> Unit
        }
    }

    private fun handleExecutionCommandKeyUp(key: String) {
        when {
            key.length == 1 && key != "," && key != "." -> appendExecutionCommand(
                if (shiftState == ShiftState.OFF) key.lowercase() else key.uppercase()
            )
            key == "," || key == "." -> appendExecutionCommand(key)
        }
    }

    private fun appendExecutionCommand(text: String) {
        executionCommand.append(text)
        renderExecutionCommand()
    }

    private fun deleteExecutionCommandCharacter() {
        if (executionCommand.isEmpty()) return
        executionCommand.deleteCharAt(executionCommand.length - 1)
        renderExecutionCommand()
    }

    private fun handleSpaceDown() {
        pendingSpaceCommit = true
        scheduleLongPress(SPACE_REPEAT_INITIAL_DELAY_MS) {
            isLongPressActive = true
            pendingSpaceCommit = false
            startRepeatingSpace()
        }
    }

    private fun handleSpaceUp(wasLongPress: Boolean) {
        if (pendingSpaceCommit && !wasLongPress) {
            commitSpace()
        }
        pendingSpaceCommit = false
    }

    private fun resetSpaceHoldState() {
        pendingSpaceCommit = false
    }

    private fun deleteOneCharacter() {
        val ic = currentInputConnection ?: return
        if (!deleteSurroundingTextSafely(ic, 1, 0, "backspace")) return
        recordCommitLatency()
        if (metrics.recordBackspace(SystemClock.elapsedRealtime())) {
            metrics.recordCorrectionAfterAcceptedSuggestion()
            lastAcceptedSuggestion?.let {
                predictor.reduceAcceptedSuggestionConfidence(it, lastAcceptedSuggestionPreviousWord)
            }
            lastAcceptedSuggestion = null
            lastAcceptedSuggestionPreviousWord = null
        }
        if (currentWord.isNotEmpty()) {
            if (pendingSuggestionImpression) {
                metrics.recordSuggestionIgnored()
                pendingSuggestionImpression = false
            }
            currentWord.deleteCharAt(currentWord.length - 1)
            updateSuggestions()
        }
        maybeFlushMetrics()
    }

    private fun commitLongPressSymbol(key: String) {
        val symbol = LongPressSymbolMap.symbolFor(key) ?: return
        cancelSwipeGesture()
        dismissKeyPreviewSafely()
        if (!commitTextSafely(currentInputConnection, symbol, "longpress-symbol")) return
        recordCommitLatency()
        currentWord.clear()
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun commitNumberKey(number: String) {
        if (!commitTextSafely(currentInputConnection, number, "number-row")) return
        recordCommitLatency()
        currentWord.clear()
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun handleKey(key: String) {
        when (key) {
            KEY_ENTER -> handleImeActionKey()
            "123" -> {
                switchKeyboardMode(Mode.NUMBERS, symbolLayer = true)
            }
            "#+=", "1/2" -> {
                switchKeyboardMode(Mode.SYMBOLS, symbolLayer = true)
            }
            "2/2" -> {
                switchKeyboardMode(Mode.NUMBERS, symbolLayer = true)
            }
            "ABC" -> {
                switchKeyboardMode(Mode.LETTERS, symbolLayer = false)
            }
            KEY_EMOJI -> {
                mainContainer.visibility = View.GONE
                emojiContainer.visibility = View.VISIBLE
            }
            KEY_MIC -> toggleVoiceTyping()
            else -> commitTextKey(key)
        }
    }

    private fun switchKeyboardMode(targetMode: Mode, symbolLayer: Boolean) {
        val startedAt = SystemClock.elapsedRealtime()
        mode = targetMode
        buildKeyboard()
        metrics.recordModeSwitch(SystemClock.elapsedRealtime() - startedAt, symbolLayer)
    }

    private fun commitSpace() {
        val ic = currentInputConnection ?: return
        val previousWord = contextWords.lastOrNull()
        if (pendingSuggestionImpression) {
            metrics.recordSuggestionIgnored()
            pendingSuggestionImpression = false
        }
        if (commitAutocorrectionIfNeeded(ic, previousWord, " ")) {
            updateSuggestions()
            maybeFlushMetrics()
            return
        }
        if (!commitTextSafely(ic, " ", "space")) return
        recordCommitLatency()
        logWord()
        if (currentWord.isNotEmpty()) {
            predictor.learnWord(currentWord.toString(), previousWord)
            currentWord.clear()
        }
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun commitEnter() {
        val ic = currentInputConnection ?: return
        prepareForEditorAction()
        if (!commitTextSafely(ic, "\n", "enter")) return
        recordCommitLatency()
        contextWords.clear()
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun toggleVoiceTyping() {
        if (isVoiceTypingActive) {
            stopVoiceTyping(cancel = false)
        } else {
            startVoiceTyping()
        }
    }

    private fun startVoiceTyping() {
        if (!hasRecordAudioPermission()) {
            showVoiceTypingUnavailable("Enable microphone permission for Aritenis AI")
            openMicrophonePermissionSettings()
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            showVoiceTypingUnavailable("Voice typing is not available on this phone")
            return
        }

        val recognizer = speechRecognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also {
            it.setRecognitionListener(createSpeechRecognitionListener())
            speechRecognizer = it
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        try {
            isVoiceTypingActive = true
            voiceRecordingPulse = true
            lastVoicePartial = ""
            updateVoiceKeyUI()
            recognizer.startListening(intent)
        } catch (e: RuntimeException) {
            isVoiceTypingActive = false
            voiceRecordingPulse = false
            updateVoiceKeyUI()
            showVoiceTypingUnavailable("Could not start voice typing")
        }
    }

    private fun startExecutionVoiceCommand() {
        if (!executionLayerOpen) return
        if (!hasRecordAudioPermission()) {
            renderExecutionStatus("Enable microphone permission, then try again.")
            openMicrophonePermissionSettings()
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            renderExecutionStatus("Voice command is not available on this phone.")
            return
        }

        stopVoiceTyping(cancel = true)
        val recognizer = speechRecognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also {
            it.setRecognitionListener(createSpeechRecognitionListener())
            speechRecognizer = it
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        try {
            isExecutionVoiceCommandActive = true
            isVoiceTypingActive = true
            voiceRecordingPulse = true
            lastVoicePartial = ""
            executionCommand.clear()
            renderExecutionCommand()
            renderExecutionStatus("Listening for app launch command.")
            renderExecutionVoiceButton()
            recognizer.startListening(intent)
        } catch (e: RuntimeException) {
            isExecutionVoiceCommandActive = false
            isVoiceTypingActive = false
            voiceRecordingPulse = false
            renderExecutionVoiceButton()
            renderExecutionStatus("Could not start voice command.")
        }
    }

    private fun createSpeechRecognitionListener(): RecognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) {
            if (!isVoiceTypingActive) return
            val nextPulse = rmsdB > 1.5f
            if (voiceRecordingPulse != nextPulse) {
                voiceRecordingPulse = nextPulse
                updateVoiceKeyUI()
            }
        }
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onError(error: Int) {
            isVoiceTypingActive = false
            isExecutionVoiceCommandActive = false
            voiceRecordingPulse = false
            lastVoicePartial = ""
            updateVoiceKeyUI()
            renderExecutionVoiceButton()
        }
        override fun onResults(results: Bundle?) {
            val commandMode = isExecutionVoiceCommandActive
            isVoiceTypingActive = false
            isExecutionVoiceCommandActive = false
            voiceRecordingPulse = false
            updateVoiceKeyUI()
            renderExecutionVoiceButton()
            val spokenText = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            if (commandMode) {
                commitExecutionVoiceResult(spokenText)
            } else {
                commitVoiceResult(spokenText)
            }
        }
        override fun onPartialResults(partialResults: Bundle?) {
            val partialText = partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            if (isExecutionVoiceCommandActive) {
                commitExecutionVoicePartial(partialText)
            } else {
                commitVoicePartial(partialText)
            }
        }
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    private fun commitExecutionVoicePartial(spokenText: String) {
        val clean = spokenText.trim()
        if (clean.isEmpty() || clean == lastVoicePartial) return
        executionCommand.clear()
        executionCommand.append(clean)
        lastVoicePartial = clean
        renderExecutionCommand()
        renderExecutionStatus("Heard: $clean")
    }

    private fun commitExecutionVoiceResult(spokenText: String) {
        val clean = spokenText.trim()
        if (clean.isEmpty()) {
            renderExecutionStatus("No command heard.")
            return
        }
        executionCommand.clear()
        executionCommand.append(clean)
        lastVoicePartial = ""
        renderExecutionCommand()
        executeExecutionCommand(clean)
    }

    private fun executeExecutionCommand(command: String) {
        val launchName = detectExecutionLaunchIntent(command)
        if (launchName == null) {
            renderExecutionStatus("Try: Open Instagram, WhatsApp, Chrome, Camera, Settings, or any app name.")
            return
        }
        launchExecutionApp(launchName)
    }

    private fun detectExecutionLaunchIntent(command: String): String? {
        val normalized = normalizeExecutionCommand(command)
        if (normalized.isBlank()) return null
        val prefixes = listOf("open ", "launch ", "start ", "go to ")
        for (prefix in prefixes) {
            if (normalized.startsWith(prefix)) {
                return normalized.removePrefix(prefix).trim().takeIf { it.isNotEmpty() }
            }
        }
        return normalized.takeIf { EXECUTION_APP_ALIASES.containsKey(it) || it == "camera" || it == "settings" }
    }

    private fun launchExecutionApp(appName: String) {
        val requestStartedAt = SystemClock.elapsedRealtime()
        val target = resolveLaunchableApp(appName)
        if (target == null) {
            renderExecutionStatus("Could not find $appName on this phone.")
            return
        }
        try {
            target.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(target.intent)
            val elapsedMs = SystemClock.elapsedRealtime() - requestStartedAt
            renderExecutionStatus("Opened ${target.label} in ${elapsedMs}ms.")
            Toast.makeText(this, "Opened ${target.label}", Toast.LENGTH_SHORT).show()
            mainHandler.postDelayed({ closeExecutionLayer() }, 450L)
        } catch (e: RuntimeException) {
            Log.w(LOG_TAG, "Unable to launch ${target.label}", e)
            renderExecutionStatus("Could not open ${target.label}.")
        }
    }

    private fun resolveLaunchableApp(appName: String): ExecutionLaunchTarget? {
        val normalizedName = normalizeExecutionCommand(appName)
        if (normalizedName == "settings") {
            return ExecutionLaunchTarget("Settings", Intent(Settings.ACTION_SETTINGS))
        }
        if (normalizedName == "camera") {
            return ExecutionLaunchTarget("Camera", Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA))
        }

        EXECUTION_APP_ALIASES[normalizedName]?.forEach { packageName ->
            packageManager.getLaunchIntentForPackage(packageName)?.let { intent ->
                return ExecutionLaunchTarget(appName.replaceFirstChar { it.uppercase() }, intent)
            }
        }

        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val launchableApps = packageManager.queryIntentActivities(launcherIntent, 0)
        var containsMatch: ExecutionLaunchTarget? = null
        for (resolveInfo in launchableApps) {
            val label = resolveInfo.loadLabel(packageManager)?.toString().orEmpty()
            val normalizedLabel = normalizeExecutionCommand(label)
            if (normalizedLabel == normalizedName) {
                val intent = packageManager.getLaunchIntentForPackage(resolveInfo.activityInfo.packageName) ?: continue
                return ExecutionLaunchTarget(label, intent)
            }
            if (containsMatch == null && normalizedLabel.contains(normalizedName)) {
                val intent = packageManager.getLaunchIntentForPackage(resolveInfo.activityInfo.packageName) ?: continue
                containsMatch = ExecutionLaunchTarget(label, intent)
            }
        }
        return containsMatch
    }

    private fun normalizeExecutionCommand(value: String): String =
        value.lowercase(Locale.getDefault())
            .replace(Regex("[^a-z0-9 ]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private data class ExecutionLaunchTarget(
        val label: String,
        val intent: Intent
    )

    private fun commitVoicePartial(spokenText: String) {
        val clean = spokenText.trim()
        if (clean.isEmpty() || clean == lastVoicePartial) return
        val ic = currentInputConnection ?: return
        try {
            ic.setComposingText(clean, 1)
            lastVoicePartial = clean
        } catch (e: RuntimeException) {
            Log.w(INPUT_CONNECTION_TAG, "voice partial failed", e)
        }
    }

    private fun commitVoiceResult(spokenText: String) {
        val clean = spokenText.trim()
        if (clean.isEmpty()) return
        val ic = currentInputConnection ?: return
        val textToCommit = if (clean.last().isWhitespace()) clean else "$clean "
        if (commitTextSafely(ic, textToCommit, "voice")) {
            currentWord.clear()
            contextWords.clear()
            lastVoicePartial = ""
            updateSuggestions()
            maybeFlushMetrics()
        }
    }

    private fun stopVoiceTyping(cancel: Boolean) {
        val recognizer = speechRecognizer ?: return
        try {
            if (cancel) {
                recognizer.cancel()
            } else {
                recognizer.stopListening()
            }
        } catch (_: RuntimeException) {
            // SpeechRecognizer implementations can throw when stopped during teardown.
        } finally {
            if (cancel) {
                try {
                    if (!isExecutionVoiceCommandActive) {
                        currentInputConnection?.finishComposingText()
                    }
                    lastVoicePartial = ""
                } catch (_: RuntimeException) {
                    // Ignore composition cleanup failures during IME teardown.
                }
            }
            isVoiceTypingActive = false
            isExecutionVoiceCommandActive = false
            voiceRecordingPulse = false
            updateVoiceKeyUI()
            renderExecutionVoiceButton()
        }
    }

    private fun destroySpeechRecognizer() {
        stopVoiceTyping(cancel = true)
        try {
            speechRecognizer?.destroy()
        } catch (_: RuntimeException) {
            // Ignore teardown failures from OEM recognizer services.
        } finally {
            speechRecognizer = null
            isVoiceTypingActive = false
            isExecutionVoiceCommandActive = false
            voiceRecordingPulse = false
            lastVoicePartial = ""
            renderExecutionVoiceButton()
        }
    }

    private fun hasRecordAudioPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun showVoiceTypingUnavailable(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun openMicrophonePermissionSettings() {
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra(MainActivity.EXTRA_REQUEST_MIC_PERMISSION, true)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(intent)
        } catch (e: RuntimeException) {
            Log.w(LOG_TAG, "Unable to open microphone permission flow", e)
        }
    }

    private fun handleImeActionKey() {
        if (currentImeAction == ImeAction.Enter) {
            commitEnter()
            return
        }

        val ic = currentInputConnection ?: return
        prepareForEditorAction()
        val handled = performEditorActionSafely(ic, currentImeAction.editorActionId, currentImeAction.label)
        recordCommitLatency()
        if (currentImeAction == ImeAction.Done) {
            requestHideSelf(0)
        } else if (!handled && currentImeAction == ImeAction.Next) {
            sendKeyEventSafely(ic, KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_TAB), "next-tab-down")
            sendKeyEventSafely(ic, KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_TAB), "next-tab-up")
        }
        contextWords.clear()
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun prepareForEditorAction() {
        if (pendingSuggestionImpression) {
            metrics.recordSuggestionIgnored()
            pendingSuggestionImpression = false
        }
        logSentence()
        if (currentWord.isNotEmpty()) {
            val previousWord = contextWords.lastOrNull()
            if (!commitAutocorrectionIfNeeded(currentInputConnection, previousWord, "")) {
                predictor.learnWord(currentWord.toString(), previousWord)
                currentWord.clear()
            }
        }
    }

    private fun commitAutocorrectionIfNeeded(
        ic: android.view.inputmethod.InputConnection?,
        previousWord: String?,
        suffix: String
    ): Boolean {
        if (ic == null || currentWord.isEmpty()) return false
        val typedWord = currentWord.toString()
        val correction = consumePrefetchedAutocorrection(typedWord, previousWord) ?: return false
        if (correction == typedWord.lowercase()) return false

        if (!deleteSurroundingTextSafely(ic, typedWord.length, 0, "autocorrect")) return false
        if (!commitTextSafely(ic, "$correction$suffix", "autocorrect")) return false
        recordCommitLatency()
        predictor.learnAcceptedSuggestion(correction, previousWord)
        contextWords.add(correction)
        if (contextWords.size > 2) {
            contextWords.removeAt(0)
        }
        currentWord.clear()
        lastAcceptedSuggestion = correction
        lastAcceptedSuggestionPreviousWord = previousWord
        return true
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

        if (pendingSuggestionImpression) {
            metrics.recordSuggestionIgnored()
            pendingSuggestionImpression = false
        }
        if (!commitTextSafely(ic, output, "key")) return
        recordCommitLatency()
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
        maybeFlushMetrics()
    }

    private fun commitSwipeSequence(
        gesture: SwipeGestureResult,
        trailDiagnostics: SwipeTrailDiagnostics? = null
    ) {
        val sequences = gesture.resolutionSequences
        if (sequences.isEmpty()) {
            logSwipeFinishDiagnostics(gesture, trailDiagnostics, candidateCount = 0, winner = null)
            metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = 0, committed = false)
            Log.w(SWIPE_DEBUG_TAG, "commit skipped: no usable sequences")
            return
        }
        val previousWord = contextWords.lastOrNull()
        val debugReporter: ((String) -> Unit)? = if (isDebugLoggingEnabled()) {
            { report -> Log.d(SWIPE_DEBUG_TAG, report) }
        } else {
            null
        }
        val generation = ++swipeResolveGeneration
        scope.launch {
            val resolveStartedAt = SystemClock.elapsedRealtime()
            val candidates = predictor.getSwipeSuggestions(
                sequences = sequences,
                previousWord = previousWord,
                debugReporter = debugReporter
            )
            val resolveMs = SystemClock.elapsedRealtime() - resolveStartedAt
            mainHandler.post {
                if (generation != swipeResolveGeneration) return@post
                applySwipeSuggestionResult(
                    gesture = gesture,
                    trailDiagnostics = trailDiagnostics,
                    candidates = candidates,
                    previousWord = previousWord,
                    resolveMs = resolveMs,
                    sourceSequence = sequences.first()
                )
            }
        }
    }

    private fun applySwipeSuggestionResult(
        gesture: SwipeGestureResult,
        trailDiagnostics: SwipeTrailDiagnostics?,
        candidates: List<String>,
        previousWord: String?,
        resolveMs: Long,
        sourceSequence: String
    ) {
        metrics.recordSwipeResolveDuration(resolveMs)
        if (resolveMs > SWIPE_RESOLVE_WARN_MS) {
            Log.w(
                SWIPE_DEBUG_TAG,
                "swipe resolve slow durationMs=$resolveMs sequenceLength=${gesture.rawSequence.length}"
            )
        }
        val suggestion = candidates.firstOrNull()
        logSwipeFinishDiagnostics(gesture, trailDiagnostics, candidateCount = candidates.size, winner = suggestion)
        if (suggestion == null) {
            metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = candidates.size, committed = false)
            Log.w(
                SWIPE_DEBUG_TAG,
                "commit skipped: no candidates sequenceLength=${sourceSequence.length} previousPresent=${previousWord != null}"
            )
            return
        }
        val committedWord = suggestion.trim().lowercase()
        if (committedWord.length < 2) {
            metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = candidates.size, committed = false)
            Log.w(
                SWIPE_DEBUG_TAG,
                "commit skipped: invalid candidateLength=${suggestion.length} sequenceLength=${sourceSequence.length}"
            )
            return
        }
        val ic = currentInputConnection
        if (ic == null) {
            metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = candidates.size, committed = false)
            Log.w(SWIPE_DEBUG_TAG, "commit failed: InputConnection null sequenceLength=${sourceSequence.length}")
            return
        }

        if (pendingSuggestionImpression) {
            metrics.recordSuggestionIgnored()
            pendingSuggestionImpression = false
        }
        if (currentWord.isNotEmpty()) {
            if (!deleteSurroundingTextSafely(ic, currentWord.length, 0, "swipe-replace")) {
                metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = candidates.size, committed = false)
                return
            }
        }

        val output = formatSwipeWord(committedWord)
        if (!commitTextSafely(ic, "$output ", "swipe")) {
            metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = candidates.size, committed = false)
            return
        }
        metrics.recordSwipeResolved(gesture.rawSequence.length, candidateCount = candidates.size, committed = true)
        recordCommitLatency()
        predictor.learnAcceptedSuggestion(committedWord, previousWord)
        contextWords.add(committedWord)
        if (contextWords.size > 2) {
            contextWords.removeAt(0)
        }
        currentWord.clear()
        lastAcceptedSuggestion = committedWord
        lastAcceptedSuggestionPreviousWord = previousWord
        if (shiftState == ShiftState.ON && !isShiftLongPressing) {
            shiftState = ShiftState.OFF
            updateShiftUI()
        }
        updateSuggestions()
        maybeFlushMetrics()
    }

    private fun logSwipeFinishDiagnostics(
        gesture: SwipeGestureResult,
        trailDiagnostics: SwipeTrailDiagnostics?,
        candidateCount: Int,
        winner: String?
    ) {
        if (!isDebugLoggingEnabled()) return
        Log.d(
            SWIPE_DEBUG_TAG,
            "swipe finish samples=${gesture.sampledPointCount}" +
                " stored=${gesture.storedPointCount}" +
                " cap=${gesture.pointCapHit || trailDiagnostics?.capHit == true}" +
                " px=${gesture.gestureLengthPx.toInt()}" +
                " trailSamples=${trailDiagnostics?.totalPointSamples ?: 0}" +
                " compressed=${gesture.compressedSequence.length}" +
                " raw=${gesture.rawSequence.length}" +
                " weighted=${gesture.weightedSequence.length}" +
                " candidates=$candidateCount" +
                " winner=${winner.orEmpty()}"
        )
    }

    private fun formatSwipeWord(word: String): String = when (shiftState) {
        ShiftState.CAPS -> word.uppercase()
        ShiftState.ON -> word.replaceFirstChar { it.uppercase() }
        ShiftState.OFF -> word
    }

    private fun updateSuggestions() {
        val previousWord = contextWords.lastOrNull()
        val prefix = currentWord.toString()
        val stablePrevious = previousWord.orEmpty()
        if (prefix == lastSuggestionQueryPrefix && stablePrevious == lastSuggestionQueryPreviousWord) {
            return
        }

        val requestGeneration = ++autocorrectGeneration
        autocorrectPrefetchFuture?.cancel(true)
        autocorrectPrefetchWord = null
        autocorrectPrefetchPreviousWord = null
        autocorrectPrefetchResult = null
        lastSuggestionQueryPrefix = prefix
        lastSuggestionQueryPreviousWord = stablePrevious
        suggestionLookupFuture?.cancel(true)
        suggestionLookupFuture = suggestionExecutor.submit {
            val suggestions = predictor.getSuggestions(prefix, previousWord)
            mainHandler.post {
                if (requestGeneration != autocorrectGeneration) return@post
                publishSuggestionsIfCurrent(prefix, stablePrevious, suggestions)
            }
        }
        prefetchAutocorrection(prefix, previousWord, requestGeneration)
    }

    private fun prefetchAutocorrection(prefix: String, previousWord: String?, requestGeneration: Int) {
        autocorrectPrefetchFuture?.cancel(true)
        autocorrectPrefetchWord = null
        autocorrectPrefetchPreviousWord = null
        autocorrectPrefetchResult = null
        if (!isAutocorrectEligible(prefix)) return

        autocorrectPrefetchFuture = autocorrectExecutor.submit {
            val correction = predictor.getAutocorrection(prefix, previousWord)
            mainHandler.post {
                if (requestGeneration != autocorrectGeneration) return@post
                autocorrectPrefetchWord = prefix
                autocorrectPrefetchPreviousWord = previousWord
                autocorrectPrefetchResult = correction
            }
        }
    }

    private fun isAutocorrectEligible(prefix: String): Boolean =
        prefix.length >= 2 && prefix.all { it in 'a'..'z' }

    private fun consumePrefetchedAutocorrection(typedWord: String, previousWord: String?): String? {
        if (typedWord != autocorrectPrefetchWord) return null
        if (previousWord != autocorrectPrefetchPreviousWord) return null
        val value = autocorrectPrefetchResult
        autocorrectPrefetchWord = null
        autocorrectPrefetchPreviousWord = null
        autocorrectPrefetchResult = null
        return value
    }

    private fun publishSuggestionsIfCurrent(
        prefix: String,
        previousWord: String,
        suggestions: List<String>
    ) {
        if (prefix != currentWord.toString()) return
        if (previousWord != contextWords.lastOrNull().orEmpty()) return

        metrics.recordSuggestionImpression(suggestions)
        pendingSuggestionImpression = currentWord.isNotEmpty() && suggestions.any { it.isNotBlank() }

        suggestionButtons.forEachIndexed { index, btn ->
            val nextText = suggestions.getOrNull(index).orEmpty()
            if (renderedSuggestionTexts[index] != nextText) {
                renderedSuggestionTexts[index] = nextText
                btn.text = nextText
            }
            if (btn.visibility != View.VISIBLE) {
                btn.visibility = View.VISIBLE
            }
        }
    }

    private fun cleanupInputViewState() {
        swipeResolveGeneration += 1
        closeExecutionLayer()
        stopVoiceTyping(cancel = true)
        cancelLongPress()
        stopRepeatingDelete()
        stopRepeatingSpace()
        dismissKeyPreviewSafely()
        disposeKeyPreviewReferences()
        dismissActivePopupSafely()
        clearPressedKeyStates()
        clearRoutedTouchOwner()
        cancelSwipeGesture()
        hapticTapGate.reset()
        isLongPressActive = false
        restoreMainKeyboardPanel()
        if (isShiftLongPressing) {
            restoreShiftAfterLongPress()
        }
    }

    private fun restoreMainKeyboardPanel() {
        if (::mainContainer.isInitialized) {
            mainContainer.visibility = View.VISIBLE
        }
        if (::emojiContainer.isInitialized) {
            emojiContainer.visibility = View.GONE
        }
    }

    private fun clearPressedKeyStates() {
        routedTouchButton?.let { releaseKeyPressFeedback(it) }
        swipePressedButton?.let { releaseKeyPressFeedback(it) }
        if (keyButtons.isNotEmpty()) {
            keyButtons.forEach { button ->
                button.isPressed = false
                button.scaleX = 1f
                button.scaleY = 1f
                button.translationY = 0f
                button.elevation = 0f
            }
        }
        swipePressedButton = null
    }

    private fun clearRoutedTouchOwner() {
        routedTouchButton = null
        routedTouchKey = null
    }

    private fun resetInputSessionState() {
        currentWord.clear()
        contextWords.clear()
        lastSuggestionQueryPrefix = SUGGESTION_QUERY_UNSET
        lastSuggestionQueryPreviousWord = SUGGESTION_QUERY_UNSET
        pendingSuggestionImpression = false
        lastAcceptedSuggestion = null
        lastAcceptedSuggestionPreviousWord = null
        swipeResolveGeneration += 1
        autocorrectGeneration += 1
        autocorrectPrefetchFuture?.cancel(true)
        autocorrectPrefetchWord = null
        autocorrectPrefetchPreviousWord = null
        autocorrectPrefetchResult = null
        if (::predictor.isInitialized) {
            predictor.resetSessionMemory()
        }
        updateSuggestionsIfReady()
    }

    private fun updateSuggestionsIfReady() {
        if (suggestionButtons.isNotEmpty() && ::predictor.isInitialized) {
            updateSuggestions()
        }
    }

    private fun recordCommitLatency() {
        val startedAt = lastKeyDownAtMs
        if (startedAt == 0L) return

        val now = SystemClock.elapsedRealtime()
        metrics.recordKeyCommit(now - startedAt, now)
        lastKeyDownAtMs = 0L
    }

    private fun maybeFlushMetrics(force: Boolean = false) {
        val now = SystemClock.elapsedRealtime()
        if (!force && now - lastMetricsFlushAtMs < METRICS_FLUSH_INTERVAL_MS) return

        val usage = metrics.usageSnapshot(now)
        val snapshot = metrics.flushSnapshot(now)
        if (!snapshot.hasReportableData()) return

        lastMetricsFlushAtMs = now
        Log.i(METRICS_TAG, snapshot.toCompactLogLine())
        
        // Automatic Local Signal Ingestion
        ProductSignalBridge.emitAggregateSignal(usage)
    }

    private fun KeyboardMetricsSnapshot.hasReportableData(): Boolean =
        keyPresses > 0 ||
            suggestionImpressions > 0 ||
            suggestionClicks > 0 ||
            ignoredSuggestions > 0 ||
            swipeAttempts > 0 ||
            modeSwitches > 0 ||
            frameHitchSuspicions > 0 ||
            totalFailures() > 0

    private fun recordLifecycleInterruptionIfNeeded(reason: String) {
        if (
            currentWord.isNotEmpty() ||
            contextWords.isNotEmpty() ||
            repeatingDelete != null ||
            longPressRunnable != null ||
            activePopup != null
        ) {
            metrics.recordLifecycleInterruption(reason)
            maybeFlushMetrics()
        }
    }

    private fun dismissActivePopupSafely() {
        val popup = activePopup
        activePopup = null
        if (popup != null) {
            try {
                popup.dismiss()
            } catch (e: RuntimeException) {
                metrics.recordPopupFailure(e.javaClass.simpleName.ifEmpty { "dismiss-active" })
            }
        }
    }

    private fun dismissKeyPreviewSafely() {
        val popup = keyPreviewPopup
        if (popup != null && popup.isShowing) {
            try {
                popup.dismiss()
            } catch (e: RuntimeException) {
                metrics.recordPopupFailure(e.javaClass.simpleName.ifEmpty { "preview-dismiss" })
            }
        }
    }

    private fun disposeKeyPreviewReferences() {
        dismissKeyPreviewSafely()
        keyPreviewPopup = null
        keyPreviewText = null
    }

    private fun updateImeAction(attribute: EditorInfo?) {
        currentImeAction = if (attribute == null) {
            ImeAction.Enter
        } else {
            ImeActionMapper.resolve(attribute.imeOptions, attribute.inputType)
        }
        updateActionKeyUI()
    }

    private fun updateActionKeyUI() {
        keyButtons.forEach { button ->
            if (button.tag == KEY_ENTER) {
                button.text = currentImeAction.label
                button.textSize = if (currentImeAction == ImeAction.Enter) 19f else 13f
            }
        }
    }

    private fun updateVoiceKeyUI() {
        val activeColor = if (voiceRecordingPulse) Color.parseColor("#35D07F") else Color.parseColor("#8AB4F8")
        voiceSuggestionButton?.let { button ->
            button.alpha = if (isVoiceTypingActive) 1f else 0.9f
            button.setTextColor(
                if (isVoiceTypingActive) activeColor else textColorForKey(KEY_MIC)
            )
            button.text = if (isVoiceTypingActive && voiceRecordingPulse) "$KEY_MIC)))" else KEY_MIC
        }
        keyButtons.forEach { button ->
            if (button.tag == KEY_MIC) {
                button.alpha = if (isVoiceTypingActive) 1f else 0.88f
                button.setTextColor(
                    if (isVoiceTypingActive) activeColor else textColorForKey(KEY_MIC)
                )
            }
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
                    if (shiftState == ShiftState.OFF) textColorForKey(KEY_SHIFT) else Color.parseColor("#8AB4F8")
                )
            }
        }
    }

    private fun logWord() {
        val word = currentWord.toString().trim().lowercase()
        if (word.length < 2) return

        contextWords.add(word)
        if (contextWords.size > 2) {
            contextWords.removeAt(0)
        }
    }

    private fun logSentence() = Unit

    private fun isDebugLoggingEnabled(): Boolean =
        (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    private fun commitTextSafely(
        ic: InputConnection?,
        text: CharSequence,
        reason: String
    ): Boolean {
        return mutateInputConnectionSafely(ic, "commit:$reason") { connection ->
            val committed = connection.commitText(text, 1)
            if (!committed) {
                Log.w(INPUT_CONNECTION_TAG, "commit failed: commitText returned false reason=$reason")
            }
            committed
        }
    }

    private fun deleteSurroundingTextSafely(
        ic: InputConnection?,
        beforeLength: Int,
        afterLength: Int,
        reason: String
    ): Boolean {
        return mutateInputConnectionSafely(ic, "delete:$reason") { connection ->
            val deleted = connection.deleteSurroundingText(beforeLength, afterLength)
            if (!deleted) {
                Log.w(INPUT_CONNECTION_TAG, "delete failed: deleteSurroundingText returned false reason=$reason")
            }
            deleted
        }
    }

    private fun performEditorActionSafely(
        ic: InputConnection?,
        editorActionId: Int,
        reason: String
    ): Boolean {
        return mutateInputConnectionSafely(ic, "editor-action:$reason") { connection ->
            val handled = connection.performEditorAction(editorActionId)
            if (!handled) {
                Log.w(INPUT_CONNECTION_TAG, "editor action returned false reason=$reason")
            }
            handled
        }
    }

    private fun sendKeyEventSafely(
        ic: InputConnection?,
        event: KeyEvent,
        reason: String
    ): Boolean {
        return mutateInputConnectionSafely(ic, "key-event:$reason") { connection ->
            val sent = connection.sendKeyEvent(event)
            if (!sent) {
                Log.w(INPUT_CONNECTION_TAG, "key event returned false reason=$reason")
            }
            sent
        }
    }

    private inline fun mutateInputConnectionSafely(
        ic: InputConnection?,
        reason: String,
        mutation: (InputConnection) -> Boolean
    ): Boolean {
        if (ic == null) {
            Log.w(INPUT_CONNECTION_TAG, "mutation skipped: InputConnection null reason=$reason")
            return false
        }

        return try {
            mutation(ic)
        } catch (e: RuntimeException) {
            Log.w(INPUT_CONNECTION_TAG, "mutation failed: ${e.javaClass.simpleName} reason=$reason", e)
            false
        }
    }

    private fun logMetricSnapshot(snapshot: KeyboardMetricsSnapshot) {
        logEvent(
            "METRICS",
            "key_presses" to snapshot.keyPresses,
            "avg_latency_ms" to snapshot.averageLatencyMs,
            "worst_latency_ms" to snapshot.worstLatencyMs,
            "session_duration_ms" to snapshot.sessionDurationMs,
            "suggestion_impressions" to snapshot.suggestionImpressions,
            "suggestion_clicks" to snapshot.suggestionClicks,
            "acceptance_rate_percent" to snapshot.acceptanceRatePercent,
            "ignored_suggestions" to snapshot.ignoredSuggestions,
            "top_accepted_words" to snapshot.topAcceptedWords.map { "${it.wordKey}:${it.count}" },
            "prediction_hit_rate_percent" to snapshot.predictionHitRatePercent,
            "corrections_after_accepted_suggestion" to snapshot.correctionsAfterAcceptedSuggestion,
            "backspace_after_autocomplete" to snapshot.backspaceAfterAutocomplete,
            "average_completion_length" to snapshot.averageCompletionLength,
            "popup_failures" to snapshot.popupFailures,
            "lifecycle_interruptions" to snapshot.lifecycleInterruptions,
            "save_model_failures" to snapshot.saveModelFailures,
            "predictor_load_failures" to snapshot.predictorLoadFailures,
            "network_failures" to snapshot.networkFailures,
            "logging_cancellations" to snapshot.loggingCancellations,
            "failure_reasons" to snapshot.failureReasons
        )
    }

    private fun logEvent(action: String, vararg dataPairs: Pair<String, Any>) {
        scope.launch {
            try {
                val baseUrl = supabaseUrl.trim()
                val apiKey = supabaseKey.trim()
                if (baseUrl.isEmpty() || apiKey.isEmpty()) {
                    val now = System.currentTimeMillis()
                    if (now - lastConfigErrorLogAtMs >= LOG_CONFIG_THROTTLE_MS) {
                        lastConfigErrorLogAtMs = now
                        Log.e(
                            LOG_TAG,
                            "Supabase config missing. url_empty=${baseUrl.isEmpty()} key_empty=${apiKey.isEmpty()} action=$action"
                        )
                    }
                    return@launch
                }

                val dataJson = JSONObject()
                dataPairs.forEach { dataJson.put(it.first, it.second) }

                val payload = JSONObject().apply {
                    put("app_id", packageName)
                    put("user_id", cachedUserId)
                    put("action", action)
                    put("timestamp", System.currentTimeMillis())
                    put("data", dataJson)
                }

                val endpoint = "${baseUrl.trimEnd('/')}/rest/v1/typing_logs"
                val req = Request.Builder()
                    .url(endpoint)
                    .addHeader("apikey", apiKey)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .post(payload.toString().toRequestBody())
                    .build()

                val requestIndex = logEventCounter.incrementAndGet()
                httpClient.newCall(req).execute().use { response ->
                    if (!response.isSuccessful) {
                        metrics.recordNetworkFailure("http-${response.code}")
                        val responseBody = response.body?.string().orEmpty()
                        Log.e(
                            LOG_TAG,
                            "Supabase insert failed code=${response.code} action=$action endpoint=$endpoint response=${responseBody.take(300)}"
                        )
                    } else if (requestIndex <= 2 || requestIndex % LOG_SUCCESS_SAMPLE_EVERY == 0) {
                        Log.i(
                            LOG_TAG,
                            "Supabase insert ok code=${response.code} action=$action endpoint=$endpoint"
                        )
                    }
                }
            } catch (e: CancellationException) {
                metrics.recordLoggingCancellation()
                Log.w(LOG_TAG, "Supabase logging cancelled action=$action message=${e.message}")
                throw e
            } catch (e: SocketTimeoutException) {
                metrics.recordNetworkFailure("timeout")
                Log.e(LOG_TAG, "Supabase timeout action=$action message=${e.message}", e)
            } catch (e: Exception) {
                metrics.recordNetworkFailure(e.javaClass.simpleName.ifEmpty { "exception" })
                Log.e(LOG_TAG, "Supabase logging exception action=$action message=${e.message}", e)
            }
        }
    }

    private fun loadOrCreateUserId(): String {
        val prefs = getSharedPreferences("keyboard_prefs", MODE_PRIVATE)
        var id = prefs.getString("user_id", null)

        if (id == null) {
            id = UUID.randomUUID().toString()
            prefs.edit().putString("user_id", id).apply()
        }

        return id
    }

    private fun performKeyboardTapHaptic(source: View, key: String) {
        if (!hapticTapGate.shouldPulse(SystemClock.elapsedRealtime())) {
            return
        }

        source.performHapticFeedback(
            HapticFeedbackConstants.KEYBOARD_TAP,
            HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING
        )

        val profile = HapticProfile.forKey(key)
        if (profile.kind == HapticKind.Normal) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrationEffectFor(profile)?.let(cachedVibrator::vibrate)
        } else {
            @Suppress("DEPRECATION")
            cachedVibrator.vibrate(profile.durationMs)
        }
    }

    private fun performKeyboardTapSound(key: String) {
        cachedAudioManager.playSoundEffect(soundEffectForKey(key), KEY_SOUND_EFFECT_VOLUME)
    }

    private fun soundEffectForKey(key: String): Int = when (key) {
        KEY_BACKSPACE -> AudioManager.FX_KEYPRESS_DELETE
        KEY_ENTER -> AudioManager.FX_KEYPRESS_RETURN
        KEY_SPACE -> AudioManager.FX_KEYPRESS_SPACEBAR
        else -> AudioManager.FX_KEYPRESS_STANDARD
    }

    private fun resolveVibrator(): Vibrator =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

    private fun createVibrationEffect(profile: HapticProfile): VibrationEffect? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            VibrationEffect.createOneShot(profile.durationMs, profile.amplitude)
        } else {
            null
        }

    private fun vibrationEffectFor(profile: HapticProfile): VibrationEffect? = when (profile.kind) {
        HapticKind.Normal -> normalVibrationEffect
        HapticKind.Backspace -> backspaceVibrationEffect
        HapticKind.Action -> actionVibrationEffect
        HapticKind.Space -> spaceVibrationEffect
    }

    private fun performSwipeTickHaptic(source: View) {
        if (!swipeHapticGate.shouldPulse(SystemClock.elapsedRealtime())) {
            return
        }

        source.performHapticFeedback(
            HapticFeedbackConstants.KEYBOARD_TAP,
            HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING
        )
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun View.updateHeight(heightPx: Int) {
        val params = layoutParams ?: return
        if (params.height == heightPx) return
        params.height = heightPx
        layoutParams = params
    }

    private data class CachedKeyBounds(
        val left: Int,
        val top: Int,
        val right: Int,
        val bottom: Int,
        val centerX: Int,
        val centerY: Int
    )

    override fun onFinishInputView(finishingInput: Boolean) {
        recordLifecycleInterruptionIfNeeded(if (finishingInput) "finish-input-view" else "hide-input-view")
        cleanupInputViewState()
        if (finishingInput) {
            resetInputSessionState()
        }
        super.onFinishInputView(finishingInput)
    }

    override fun onFinishInput() {
        recordLifecycleInterruptionIfNeeded("finish-input")
        cleanupInputViewState()
        resetInputSessionState()
        metrics.endSession()
        super.onFinishInput()
    }

    override fun onWindowHidden() {
        recordLifecycleInterruptionIfNeeded("window-hidden")
        cleanupInputViewState()
        super.onWindowHidden()
    }

    override fun onDestroy() {
        recordLifecycleInterruptionIfNeeded("destroy")
        cleanupInputViewState()
        resetInputSessionState()
        if (::predictor.isInitialized) {
            predictor.flushPendingSave()
        }
        maybeFlushMetrics(force = true)
        metrics.endSession()
        destroySpeechRecognizer()
        suggestionLookupFuture?.cancel(true)
        autocorrectPrefetchFuture?.cancel(true)
        suggestionExecutor.shutdownNow()
        autocorrectExecutor.shutdownNow()
        scope.cancel()
        super.onDestroy()
    }
}

