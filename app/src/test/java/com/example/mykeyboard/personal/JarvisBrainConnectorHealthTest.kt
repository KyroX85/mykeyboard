package com.example.mykeyboard.personal

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class JarvisBrainConnectorHealthTest {
    @Test
    fun gradleInjectsFounderBrainConfigFromCanonicalAndFallbackEnvNames() {
        val buildGradle = sourceFile("app/build.gradle.kts").readText()

        assertTrue(buildGradle.contains("firstPresentEnvValue"))
        assertTrue(buildGradle.contains("\"ARITENIS_FOUNDER_BRAIN_API_URL\""))
        assertTrue(buildGradle.contains("\"FOUNDER_BRAIN_API_URL\""))
        assertTrue(buildGradle.contains("\"ARITENIS_FOUNDER_BRAIN_API_TOKEN\""))
        assertTrue(buildGradle.contains("\"FOUNDER_BRAIN_API_TOKEN\""))
        assertTrue(buildGradle.contains("buildConfigField("))
        assertTrue(buildGradle.contains("\"FOUNDER_BRAIN_API_URL\""))
        assertTrue(buildGradle.contains("\"FOUNDER_BRAIN_API_TOKEN\""))
    }

    @Test
    fun apkBuildingWorkflowsExportFounderBrainConfig() {
        val workflows = listOf(
            ".github/workflows/android.yml",
            ".github/workflows/product-lab-validation.yml",
            ".github/workflows/build-and-distribute.yml"
        )

        workflows.forEach { workflowPath ->
            val workflow = sourceFile(workflowPath).readText()
            assertTrue("$workflowPath must export ARITENIS_FOUNDER_BRAIN_API_URL", workflow.contains("ARITENIS_FOUNDER_BRAIN_API_URL"))
            assertTrue("$workflowPath must export ARITENIS_FOUNDER_BRAIN_API_TOKEN", workflow.contains("ARITENIS_FOUNDER_BRAIN_API_TOKEN"))
            assertTrue("$workflowPath must support FOUNDER_BRAIN_API_URL fallback", workflow.contains("FOUNDER_BRAIN_API_URL"))
            assertTrue("$workflowPath must support FOUNDER_BRAIN_API_TOKEN fallback", workflow.contains("FOUNDER_BRAIN_API_TOKEN"))
        }
    }

    @Test
    fun connectorRejectsBlankBuildConfigBeforeNetworkCall() {
        val connector = sourceFile("app/src/main/java/com/example/mykeyboard/personal/JarvisBrainConnector.kt").readText()
        val config = sourceFile("app/src/main/java/com/example/mykeyboard/personal/PersonalJarvisConfig.kt").readText()

        assertTrue(config.contains("BuildConfig.FOUNDER_BRAIN_API_URL"))
        assertTrue(config.contains("BuildConfig.FOUNDER_BRAIN_API_TOKEN"))
        assertTrue(connector.contains("configurationIssue(endpoint, token)"))
        assertTrue(connector.contains("ARITENIS_FOUNDER_BRAIN_API_URL was blank when this APK was built"))
        assertTrue(connector.contains("ARITENIS_FOUNDER_BRAIN_API_TOKEN was blank when this APK was built"))
    }

    private fun sourceFile(relativePath: String): File {
        val current = File("").absoluteFile
        val direct = File(current, relativePath)
        if (direct.exists()) return direct
        return File(current.parentFile, relativePath)
    }
}
