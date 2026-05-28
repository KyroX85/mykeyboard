package com.example.mykeyboard

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SymbolErgonomicsTest {

    @Test
    fun criticalSymbolsRemainAccessibleWithinOneTransition() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val rows = methodBody(source, "keyRowsForMode")
        val numbersMode = rows.substringAfter("Mode.NUMBERS -> listOf(").substringBefore("Mode.SYMBOLS")

        for (symbol in listOf("@", "#", "=", "&", "*", "(", ")", "-", "+", "_", "[", "]", "/", ":", ";", "'", "\"", "?", "!")) {
            assertTrue("Missing first-transition symbol $symbol", numbersMode.contains(sourceLiteral(symbol)))
        }
        assertTrue("Backspace should stay on the first symbol page control row", numbersMode.substringAfter("\"1/2\"").contains("KEY_BACKSPACE"))
    }

    @Test
    fun symbolLayerGroupsSecondaryDelimitersWithoutNumberStrip() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val rows = methodBody(source, "keyRowsForMode")
        val stripRows = methodBody(source, "stripKeysForMode")
        val symbolsMode = rows.substringAfter("Mode.SYMBOLS -> listOf(")

        for (symbol in listOf("{", "}", "\\", "|", "~", "`", "$")) {
            assertTrue("Missing grouped secondary symbol $symbol", symbolsMode.contains(sourceLiteral(symbol)))
        }
        assertTrue(stripRows.contains("Mode.LETTERS -> NUMBER_ROW_KEYS"))
        assertTrue(stripRows.contains("Mode.NUMBERS -> NUMBER_ROW_KEYS"))
        assertTrue(stripRows.contains("Mode.SYMBOLS -> emptyList()"))
        assertTrue(symbolsMode.contains("\"2/2\""))
        assertTrue(symbolsMode.contains("KEY_BACKSPACE"))
        assertTrue(symbolsMode.contains("KeyboardSymbols.YEN"))
        assertTrue(symbolsMode.contains("KeyboardSymbols.HEART").not())
        assertTrue(symbolsMode.contains("KeyboardSymbols.SPARKLES").not())
        assertTrue(symbolsMode.contains("KeyboardSymbols.BOLT").not())
        assertTrue(symbolsMode.contains("KeyboardSymbols.CHECK").not())
    }

    @Test
    fun secondaryBracesUseLongPressInsteadOfExtraLayerSwitching() {
        assertTrue(LongPressSymbolMap.symbolFor("[") == "{")
        assertTrue(LongPressSymbolMap.symbolFor("]") == "}")
    }

    @Test
    fun symbolHintsAreNotLimitedToLetterModeOnly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val createKeyButton = methodBody(source, "createKeyButton")

        assertTrue(createKeyButton.contains("setSymbolHint(LongPressSymbolMap.hintFor(key))"))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }

    private fun sourceLiteral(symbol: String): String =
        "\"" + symbol.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

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
