package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AgenticWorkflowOverlayTest {

    @Test
    fun agenticEntryLivesInsideSuggestionBar() {
        val layout = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText()
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val setupSuggestions = methodBody(source, "setupSuggestionBar")

        assertFalse(layout.contains("android:id=\"@+id/actionOptionsBar\""))
        assertTrue(layout.contains("android:id=\"@+id/suggestionBar\""))
        assertTrue(setupSuggestions.contains("agentActionChip = TextView"))
        assertTrue(setupSuggestions.contains("text = \"AI\""))
        assertTrue(setupSuggestions.contains("suggestionBar.addView(agentActionChip)"))
    }

    @Test
    fun agenticChipStaysDisabledUntilTextExists() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val update = methodBody(source, "updateAgenticWorkflowOverlay")
        val setup = methodBody(source, "setupSuggestionBar")
        val cleanup = methodBody(source, "cleanupInputViewState")

        assertTrue(source.contains("const val AGENTIC_MIN_CONTEXT_WORDS = 1"))
        assertTrue(update.contains("agentActionChip.isEnabled = enabled"))
        assertTrue(update.contains("agentActionChip.alpha"))
        assertTrue(setup.contains("updateAgenticWorkflowOverlay()"))
        assertFalse(source.contains("setupAgentActionRow"))
        assertFalse(source.contains("agentActionRow"))
        assertTrue(cleanup.contains("updateAgenticWorkflowOverlay()"))
    }

    @Test
    fun workflowOverlayDoesNotUseNetworkLoggingOrPredictionWorkers() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val update = methodBody(source, "updateAgenticWorkflowOverlay")
        val suggestions = methodBody(source, "setupSuggestionBar")

        assertTrue(update.contains("buildAgenticWorkflowState"))
        assertTrue(update.contains("agentActionChip"))
        assertFalse(update.contains("logEvent("))
        assertFalse(update.contains("suggestionExecutor"))
        assertFalse(suggestions.contains("logEvent("))
    }

    @Test
    fun workflowOverlayProvidesCopyEditAndFormatActions() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()

        assertTrue(source.contains("ACTION_COPY"))
        assertTrue(source.contains("ACTION_EDIT"))
        assertTrue(source.contains("ACTION_WHATSAPP"))
        assertTrue(source.contains("ACTION_EMAIL"))
        assertTrue(source.contains("copyAgenticDraftToClipboard"))
        assertTrue(source.contains("commitAgenticDraft"))
        assertTrue(source.contains("deleteSurroundingTextSafely(ic, replaceLength, 0, \"agentic-replace\")"))
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
