package com.example.mykeyboard

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AgenticWorkflowOverlayTest {

    @Test
    fun actionOptionsBarIsOptionalAndBelowSuggestions() {
        val layout = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText()

        assertTrue(layout.contains("android:id=\"@+id/actionOptionsBar\""))
        assertTrue(layout.indexOf("@+id/suggestionBar") < layout.indexOf("@+id/actionOptionsBar"))
        assertTrue(layout.contains("android:visibility=\"gone\""))
    }

    @Test
    fun actionOptionsBarStaysVisibleWithDisabledActionsUntilTextExists() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val update = methodBody(source, "updateAgenticWorkflowOverlay")
        val setup = methodBody(source, "setupAgentActionRow")
        val cleanup = methodBody(source, "cleanupInputViewState")

        assertTrue(source.contains("const val AGENTIC_MIN_CONTEXT_WORDS = 1"))
        assertTrue(update.contains("agentActionRow.visibility = View.VISIBLE"))
        assertTrue(update.contains("button.isEnabled = false"))
        assertTrue(setup.contains("updateAgenticWorkflowOverlay()"))
        assertFalse(setup.contains("agentActionRow.visibility = View.GONE"))
        assertTrue(cleanup.contains("updateAgenticWorkflowOverlay()"))
    }

    @Test
    fun workflowOverlayDoesNotUseNetworkLoggingOrPredictionWorkers() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText()
        val update = methodBody(source, "updateAgenticWorkflowOverlay")
        val actions = methodBody(source, "setupAgentActionRow")

        assertTrue(update.contains("buildAgenticWorkflowState"))
        assertTrue(update.contains("agentActionRow.visibility"))
        assertFalse(update.contains("logEvent("))
        assertFalse(update.contains("suggestionExecutor"))
        assertFalse(actions.contains("logEvent("))
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
