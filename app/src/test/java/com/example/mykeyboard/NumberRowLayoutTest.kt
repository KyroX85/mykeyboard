package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class NumberRowLayoutTest {

    @Test
    fun keyboardLayoutContainsStaticNumberRowBetweenSuggestionsAndLetters() {
        val layout = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText()

        assertTrue(layout.contains("android:id=\"@+id/numberRow\""))
        assertTrue(layout.indexOf("@+id/suggestionBar") < layout.indexOf("@+id/numberRow"))
        assertTrue(layout.indexOf("@+id/numberRow") < layout.indexOf("@+id/lettersLayout"))
    }

    @Test
    fun numberRowUsesDedicatedSetupAndDoesNotUseLongPressOrSwipePath() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val setupNumberRow = methodBody(source, "setupNumberRow")
        val stripKeysForMode = methodBody(source, "stripKeysForMode")
        val commitNumberKey = methodBody(source, "commitNumberKey")

        assertTrue(source.contains("val NUMBER_ROW_KEYS = listOf(\"1\", \"2\", \"3\", \"4\", \"5\", \"6\", \"7\", \"8\", \"9\", \"0\")"))
        assertTrue(setupNumberRow.contains("stripKeysForMode(mode)"))
        assertTrue(stripKeysForMode.contains("Mode.LETTERS -> NUMBER_ROW_KEYS"))
        assertTrue(stripKeysForMode.contains("Mode.NUMBERS -> NUMBER_ROW_KEYS"))
        assertTrue(stripKeysForMode.contains("Mode.SYMBOLS -> emptyList()"))
        assertTrue(setupNumberRow.contains("HintKeyButton"))
        assertFalse(setupNumberRow.contains("setOnTouchListener"))
        assertFalse(setupNumberRow.contains("scheduleLongPress"))
        assertFalse(setupNumberRow.contains("startSwipeTrackingIfEligible"))
        assertTrue(commitNumberKey.contains("commitTextSafely"))
    }

    @Test
    fun keyboardRowsAreCachedPerModeForSmoothModeSwitches() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val buildKeyboard = methodBody(source, "buildKeyboard")

        assertTrue(source.contains("keyboardRowsByMode"))
        assertTrue(source.contains("keyboardButtonsByMode"))
        assertTrue(buildKeyboard.contains("keyboardRowsByMode[mode] ?: createKeyboardRows(mode, sizing)"))
        assertTrue(buildKeyboard.contains("keyButtons.addAll(buttons)"))
        assertTrue(source.contains("clearCachedKeyboardViews()"))
    }

    @Test
    fun numberRowAndMainRowsUseDeviceNormalizedSizing() {
        val layout = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText()
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()

        assertTrue(layout.contains("android:id=\"@+id/keyboardContent\""))
        assertTrue(layout.contains("android:layout_height=\"1dp\""))
        assertTrue(source.contains("KeyboardSizingProfile.fromDevice"))
        assertTrue(source.contains("applyKeyboardSizing(sizing)"))
        assertTrue(source.contains("sizing.numberRowHeightPx"))
        assertTrue(source.contains("sizing.keyHeightPx"))
        assertTrue(source.contains("sizing.rowVerticalMarginPx"))
        assertFalse(source.contains("KEY_HEIGHT_MIN_DP"))
        assertFalse(source.contains("NUMBER_ROW_HEIGHT_DP"))
    }

    @Test
    fun stripRowStaysVisibleForLettersAndNumbersOnly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val setupNumberRow = methodBody(source, "setupNumberRow")
        val rows = methodBody(source, "keyRowsForMode")

        assertTrue(setupNumberRow.contains("numberRow.visibility = View.VISIBLE"))
        assertTrue(setupNumberRow.contains("numberRow.visibility = View.GONE"))
        assertTrue(setupNumberRow.contains("height = sizing.numberRowHeightPx"))
        assertTrue(setupNumberRow.contains("height = 0"))
        assertFalse(rows.substringAfter("Mode.NUMBERS -> listOf(").substringBefore("Mode.SYMBOLS").contains("NUMBER_ROW_KEYS"))
        assertFalse(rows.substringAfter("Mode.SYMBOLS -> listOf(").contains("NUMBER_ROW_KEYS"))
    }

    @Test
    fun numberModeKeepsNumberStripAndSymbolModeUsesFullRows() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val stripKeysForMode = methodBody(source, "stripKeysForMode")
        val rows = methodBody(source, "keyRowsForMode")
        val numbersMode = rows.substringAfter("Mode.NUMBERS -> listOf(").substringBefore("Mode.SYMBOLS")
        val symbolsMode = rows.substringAfter("Mode.SYMBOLS -> listOf(")

        assertTrue(stripKeysForMode.contains("Mode.NUMBERS -> NUMBER_ROW_KEYS"))
        assertTrue(stripKeysForMode.contains("Mode.SYMBOLS -> emptyList()"))
        assertTrue(numbersMode.contains("\"@\""))
        assertTrue(numbersMode.contains("\"?\""))
        assertTrue(numbersMode.contains("KEY_BACKSPACE"))
        assertTrue(symbolsMode.contains("\"{\""))
        assertTrue(symbolsMode.contains("\"~\""))
        assertTrue(symbolsMode.contains("\"2/2\""))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }

    private fun methodBody(source: String, methodName: String): String {
        val start = source.indexOf("fun $methodName")
        require(start >= 0) { "Missing method $methodName" }
        val openBrace = source.indexOf('{', start)
        require(openBrace >= 0) { "Missing method body for $methodName" }

        var depth = 0
        for (index in openBrace until source.length) {
            when (source[index]) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return source.substring(openBrace + 1, index)
                }
            }
        }
        error("Unterminated method body for $methodName")
    }
}
