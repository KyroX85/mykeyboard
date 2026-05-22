package com.example.mykeyboard

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SymbolErgonomicsTest {

    @Test
    fun criticalSymbolsRemainAccessibleWithinOneTransition() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val rows = methodBody(source, "keyRowsForMode")
        val stripRows = methodBody(source, "stripKeysForMode")
        val numbersMode = rows.substringAfter("Mode.NUMBERS -> listOf(").substringBefore("Mode.SYMBOLS")
        val firstAccessNumbers = numbersMode + stripRows.substringAfter("Mode.NUMBERS ->").substringBefore("Mode.SYMBOLS")

        for (symbol in listOf("@", "#", "=", "&", "*", "(", ")", "-", "+", "_", "\\", "[", "]", "/", ":", ";", "'", "\"", "?", "!")) {
            assertTrue("Missing first-transition symbol $symbol", firstAccessNumbers.contains(sourceLiteral(symbol)))
        }
    }

    @Test
    fun symbolStripGroupsCodingDelimitersWithoutDuplicatingNumberRow() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val stripRows = methodBody(source, "stripKeysForMode")

        for (symbol in listOf("{", "}", "[", "]", "<", ">", "\\", "|")) {
            assertTrue("Missing grouped symbol-strip key $symbol", stripRows.contains(sourceLiteral(symbol)))
        }
        assertTrue(stripRows.contains("Mode.LETTERS -> NUMBER_ROW_KEYS"))
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
