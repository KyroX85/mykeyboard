package com.example.mykeyboard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class FoundationalDebtGuardrailsTest {

    @Test
    fun sourceDoesNotContainKnownMojibakeMarkers() {
        val markers = listOf(
            0x00E2.toChar().toString(),
            0x00C3.toChar().toString(),
            0x00F0.toChar().toString(),
            0xFFFD.toChar().toString(),
            0x00C2.toChar().toString(),
            listOf(0x00EF, 0x00BF, 0x00BD).map { it.toChar() }.joinToString("")
        )
        val files = sourceRoots()
            .flatMap { root -> root.walkTopDown().filter { it.isFile && it.extension in textExtensions } }

        for (file in files) {
            val text = file.readText(Charsets.UTF_8)
            for (marker in markers) {
                assertFalse("${file.path} contains mojibake marker $marker", text.contains(marker))
            }
        }
    }

    @Test
    fun generatedResourceReferencesUseDrawableIdsOnly() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)

        assertFalse(source.contains("R.getDrawable"))
        assertFalse(source.contains("resources.getDrawable(R.getDrawable"))
        assertTrue(source.contains("R.drawable.key_bg"))
    }

    @Test
    fun dependencyFamiliesHaveSingleDeclaredVersion() {
        val gradle = sourceFile("app/build.gradle.kts").readText(Charsets.UTF_8)

        assertEquals(1, Regex("""com\.squareup\.okhttp3:okhttp:""").findAll(gradle).count())
        assertEquals(0, Regex("""io\.github\.jan-tennert\.supabase:""").findAll(gradle).count())
        assertEquals(0, Regex("""io\.ktor:""").findAll(gradle).count())
        assertFalse(gradle.contains("postgrest-kt:1.4.0"))
        assertFalse(gradle.contains("postgrest-kt:2.4.0"))
        assertFalse(gradle.contains("okhttp:4.11.0"))
    }

    @Test
    fun keySymbolsAndAccessibilityLabelsAreCentralized() {
        val keyboard = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)
        val symbols = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt").readText(Charsets.UTF_8)

        assertTrue(keyboard.contains("KeyboardSymbols.accessibilityLabelForKey"))
        assertTrue(keyboard.contains("KeyboardSymbols.numberAccessibilityLabel"))
        assertTrue(symbols.contains("const val BACKSPACE"))
        assertTrue(symbols.contains("val EMOJI_PANEL"))
    }

    @Test
    fun keyRadiusStaysNormalizedForUnifiedKeyboardSurface() {
        val drawables = listOf(
            "app/src/main/res/drawable/key_bg.xml",
            "app/src/main/res/drawable/key_bg_modifier.xml",
            "app/src/main/res/drawable/key_bg_space.xml",
            "app/src/main/res/drawable/key_bg_action.xml"
        )

        for (drawable in drawables) {
            val keyBackground = sourceFile(drawable).readText(Charsets.UTF_8)
            assertTrue("$drawable must use normalized raised-key radius", keyBackground.contains("android:radius=\"6dp\""))
            assertFalse("$drawable must not restore separated-card radius", keyBackground.contains("android:radius=\"8dp\""))
        }
    }

    @Test
    fun keyLabelsUseOpticalFontPaddingNormalization() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)

        assertTrue(methodBody(source, "setupSuggestionBar").contains("setIncludeFontPadding(false)"))
        assertTrue(methodBody(source, "setupNumberRow").contains("setIncludeFontPadding(false)"))
        assertTrue(methodBody(source, "createKeyButton").contains("setIncludeFontPadding(false)"))
    }

    @Test
    fun keyVisualHierarchyStaysQuietAndBounded() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)
        val suggestionBody = methodBody(source, "setupSuggestionBar")
        val stripBody = methodBody(source, "configureStripKeyButton")
        val keyButtonBody = methodBody(source, "createKeyButton")
        val weightBody = methodBody(source, "keyWeight")

        assertTrue(suggestionBody.contains("ColorDrawable(Color.TRANSPARENT)"))
        assertTrue(suggestionBody.contains("setSingleLine(true)"))
        assertTrue(stripBody.contains("textSize = 14.5f"))
        assertTrue(methodBody(source, "setupNumberRow").contains("stripKeysForMode(mode)"))
        assertTrue(keyButtonBody.contains("elevation = 0f"))
        assertTrue(keyButtonBody.contains("setSingleLine(true)"))
        assertTrue(weightBody.contains("KEY_SPACE -> 5.05f"))
        assertTrue(weightBody.contains("KEY_ENTER -> 1.42f"))
        assertTrue(weightBody.contains("\"123\", \"ABC\", \"#+=\", KEY_EMOJI -> 0.96f"))
    }

    @Test
    fun keyDrawablesAvoidFloatingCardContrast() {
        val alpha = sourceFile("app/src/main/res/drawable/key_bg.xml").readText(Charsets.UTF_8)
        val modifier = sourceFile("app/src/main/res/drawable/key_bg_modifier.xml").readText(Charsets.UTF_8)
        val space = sourceFile("app/src/main/res/drawable/key_bg_space.xml").readText(Charsets.UTF_8)
        val action = sourceFile("app/src/main/res/drawable/key_bg_action.xml").readText(Charsets.UTF_8)
        val panel = sourceFile("app/src/main/res/drawable/keyboard_container_bg.xml").readText(Charsets.UTF_8)

        assertTrue(alpha.contains("#8A000000"))
        assertTrue(alpha.contains("#FF2C2C2E"))
        assertTrue(alpha.contains("#FF3A3A3C"))
        assertTrue(modifier.contains("#8A000000"))
        assertTrue(modifier.contains("#FF1C1C1E"))
        assertTrue(modifier.contains("#FF3A3A3C"))
        assertTrue(space.contains("#FF2C2C2E"))
        assertTrue(space.contains("#FF3A3A3C"))
        assertTrue(action.contains("#8A000000"))
        assertTrue(action.contains("#FF303033"))
        assertTrue(action.contains("#FF4A4A4D"))
        assertTrue(panel.contains("<solid android:color=\"#FF0B0B0D\""))
        assertFalse(panel.contains("<gradient"))
    }

    @Test
    fun lowBrightnessDarkModeKeepsKeyTypeSeparation() {
        val alpha = sourceFile("app/src/main/res/drawable/key_bg.xml").readText(Charsets.UTF_8)
        val modifier = sourceFile("app/src/main/res/drawable/key_bg_modifier.xml").readText(Charsets.UTF_8)
        val action = sourceFile("app/src/main/res/drawable/key_bg_action.xml").readText(Charsets.UTF_8)
        val space = sourceFile("app/src/main/res/drawable/key_bg_space.xml").readText(Charsets.UTF_8)

        assertTrue(alpha.contains("#FF2C2C2E"))
        assertTrue(modifier.contains("#FF1C1C1E"))
        assertTrue(action.contains("#FF303033"))
        assertTrue(space.contains("#FF2C2C2E"))
        assertTrue(alpha.contains("#8A000000"))
        assertTrue(modifier.contains("#8A000000"))
    }

    @Test
    fun suggestionRowUsesPanelSurfaceForHierarchyContinuity() {
        val layout = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText(Charsets.UTF_8)
        val panel = sourceFile("app/src/main/res/drawable/keyboard_container_bg.xml").readText(Charsets.UTF_8)

        assertTrue(panel.contains("#FF0B0B0D"))
        assertTrue(layout.contains("android:id=\"@+id/suggestionBar\""))
        assertTrue(layout.contains("android:background=\"#FF0B0B0D\""))
    }

    @Test
    fun emojiPanelKeepsCommonEmotionsAndCompactGrid() {
        val symbols = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardSymbols.kt").readText(Charsets.UTF_8)
        val service = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)
        val layout = sourceFile("app/src/main/res/layout/keyboard_container.xml").readText(Charsets.UTF_8)

        assertTrue(symbols.contains("\"\\uD83D\\uDE22\""))
        assertTrue(symbols.contains("\"\\uD83D\\uDE2D\""))
        assertTrue(symbols.contains("\"\\uD83D\\uDE21\""))
        assertTrue(symbols.contains("\"\\uD83E\\uDD7A\""))
        assertTrue(service.contains("val emojiCellSize = dp(34)"))
        assertTrue(service.contains("emojiGrid.numColumns = 9"))
        assertTrue(service.contains("textSize = 23f"))
        assertTrue(layout.contains("android:layout_height=\"204dp\""))
        assertFalse(layout.contains("Search emojis"))
        assertFalse(layout.contains("emojiSearchInput"))
        assertFalse(layout.contains("emojiSearchKeys"))
    }

    @Test
    fun maturityReportDocumentsStopConditionsAndVisualRisks() {
        val report = sourceFile("docs/KEYBOARD_MATURITY_REPORT.md").readText(Charsets.UTF_8)

        assertTrue(report.contains("Stop Conditions"))
        assertTrue(report.contains("touch confidence decreases"))
        assertTrue(report.contains("Subjective-Risk Warnings"))
        assertTrue(report.contains("Release Readiness Score"))
        assertTrue(report.contains("Pause visual tuning"))
    }

    @Test
    fun reductionReportDocumentsRemovedVisualRemnants() {
        val report = sourceFile("docs/KEYBOARD_REDUCTION_REPORT.md").readText(Charsets.UTF_8)

        assertTrue(report.contains("SAFE REMOVE"))
        assertTrue(report.contains("HIGH RISK REMOVE"))
        assertTrue(report.contains("Complexity score"))
        assertTrue(report.contains("Visual consistency score"))
        assertTrue(report.contains("Maintainability score"))
        assertTrue(report.contains("bg_keyboard.jpg"))
    }

    @Test
    fun gboardReferenceAnalysisStaysStructuralAndNonCloning() {
        val report = sourceFile("docs/GBOARD_ERGONOMIC_ANALYSIS.md").readText(Charsets.UTF_8)

        assertTrue(report.contains("structural ergonomic references only"))
        assertTrue(report.contains("does not recommend copying Gboard branding"))
        assertTrue(report.contains("Safe Improvement Opportunities"))
        assertTrue(report.contains("Dangerous Changes To Avoid"))
        assertTrue(report.contains("Structurally Beneficial"))
        assertTrue(report.contains("Merely Aesthetic Imitation"))
        assertTrue(report.contains("Ergonomic Confidence Score"))
        assertTrue(report.contains("Recommended Next Pass Priority"))
    }

    @Test
    fun stabilizationReportsDocumentRollbackRiskAndValidation() {
        val reports = listOf(
            "docs/DEPENDENCY_ALIGNMENT_REPORT.md",
            "docs/HOT_PATH_OPTIMIZATION_REPORT.md",
            "docs/PREDICTOR_STABILITY_REPORT.md",
            "docs/SURFACE_PERFORMANCE_REPORT.md",
            "docs/CTO_HEALTH_SCORING_REPORT.md"
        )

        for (path in reports) {
            val report = sourceFile(path).readText(Charsets.UTF_8)
            assertTrue("$path must document risk", report.contains("Risk") || report.contains("risk"))
            assertTrue("$path must document rollback", report.contains("Rollback") || report.contains("rollback"))
            assertTrue("$path must document confidence", report.contains("Confidence"))
        }
    }

    @Test
    fun ctoHealthScoringSupportsRecoveryMomentum() {
        val source = sourceFile(".ai-pipeline/scripts/generate-founder-report.ps1").readText(Charsets.UTF_8)

        assertTrue(source.contains("ctoHealthScore"))
        assertTrue(source.contains("resolvedIssueDecay"))
        assertTrue(source.contains("recoveryMomentumBonus"))
        assertTrue(source.contains("stabilizationBonus"))
        assertTrue(source.contains("severityWeights"))
    }

    @Test
    fun obsoleteVisualRemnantsStayRemoved() {
        val removed = listOf(
            "app/src/main/res/drawable/bg_dark.xml",
            "app/src/main/res/drawable/bg_light.xml",
            "app/src/main/res/drawable/bg_purple.xml",
            "app/src/main/res/drawable/keyboard_bg.xml",
            "app/src/main/res/drawable/bg_image.xml",
            "app/src/main/res/drawable/bg_keyboard.jpg",
            "app/src/main/res/anim/press.xml",
            "app/src/main/res/anim/release.xml"
        )

        for (path in removed) {
            assertFalse("$path must stay removed", sourceFile(path).exists())
        }
    }

    @Test
    fun usageIntelligenceStaysLocalOnlyAndAggregateOnly() {
        val metrics = sourceFile("app/src/main/java/com/example/mykeyboard/metrics/KeyboardMetrics.kt")
            .readText(Charsets.UTF_8)
        val report = sourceFile("docs/KEYBOARD_USAGE_REPORT.md").readText(Charsets.UTF_8)
        val forbidden = listOf(
            "SharedPreferences",
            "JSONObject",
            "OkHttp",
            "Request(",
            "CoroutineScope",
            "launch",
            "File(",
            "currentWord",
            "rawKeystroke"
        )

        assertTrue(metrics.contains("data class KeyboardUsageSnapshot"))
        assertTrue(metrics.contains("enum class KeyConfidenceZone"))
        for (token in forbidden) {
            assertFalse("usage metrics must not contain $token", metrics.contains(token))
        }
        assertTrue(report.lowercase().contains("local-only"))
        assertTrue(report.contains("No raw keystrokes"))
        assertTrue(report.lowercase().contains("rollback complexity"))
    }

    @Test
    fun protectedHotPathsDoNotContainPersistenceNetworkOrSerializationWork() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)
        val protectedMethods = listOf(
            "handleTouch",
            "updateSwipeTracking",
            "commitNumberKey",
            "commitLongPressSymbol",
            "commitTextKey",
            "commitSwipeSequence",
            "commitSpace",
            "commitEnter",
            "updateSuggestions"
        )
        val forbidden = listOf(
            "JSONObject",
            "newCall(",
            ".execute()",
            "scope.launch",
            "getSharedPreferences(",
            ".edit()",
            "layoutInflater.inflate",
            "Bitmap",
            "Thread.sleep",
            "runBlocking"
        )

        for (method in protectedMethods) {
            val body = methodBody(source, method)
            val methodForbidden = if (method == "commitSwipeSequence") {
                forbidden - "scope.launch"
            } else {
                forbidden
            }
            for (token in methodForbidden) {
                assertFalse("$method must not contain $token", body.contains(token))
            }
        }
    }

    @Test
    fun swipeFailureLogsDoNotExposeRawSequencesOrPreviousWords() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)
        val commitSwipe = methodBody(source, "commitSwipeSequence")

        assertFalse(commitSwipe.contains("sequence=${'$'}sourceSequence"))
        assertFalse(commitSwipe.contains("previous=${'$'}previousWord"))
        assertTrue(source.contains("sequenceLength=${'$'}{sourceSequence.length}"))
        assertTrue(source.contains("previousPresent=${'$'}{previousWord != null}"))
    }

    @Test
    fun supabaseFailureLogsDoNotEchoSerializedPayload() {
        val source = sourceFile("app/src/main/java/com/example/mykeyboard/KeyboardService.kt").readText(Charsets.UTF_8)
        val logEvent = methodBody(source, "logEvent")

        assertFalse(logEvent.contains("payload=${'$'}{payload.toString()"))
        assertFalse(logEvent.contains("payload=${'$'}payload"))
        assertTrue(logEvent.contains("response=${'$'}{responseBody.take(300)}"))
    }

    @Test
    fun predictorPreferencesAreExcludedFromBackupAndTransfer() {
        val backup = sourceFile("app/src/main/res/xml/backup_rules.xml").readText(Charsets.UTF_8)
        val extraction = sourceFile("app/src/main/res/xml/data_extraction_rules.xml").readText(Charsets.UTF_8)

        for (prefs in listOf("keyboard_predictions.xml", "keyboard_prefs.xml")) {
            assertTrue("backup rules must exclude $prefs", backup.contains("path=\"$prefs\""))
            assertTrue("data extraction rules must exclude $prefs", extraction.contains("path=\"$prefs\""))
        }
        assertTrue(extraction.contains("<cloud-backup>"))
        assertTrue(extraction.contains("<device-transfer>"))
    }

    private val textExtensions = setOf("kt", "kts", "xml", "txt", "pro")

    private fun sourceRoots(): List<File> = listOf(
        sourceFile("app/src/main"),
        sourceFile("app/src/test")
    )

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
