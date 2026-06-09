import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

fun String.asBuildConfigString(): String =
    "\"" + replace("\\", "\\\\").replace("\"", "\\\"") + "\""

fun envValue(name: String): String =
    providers.environmentVariable(name).orElse("").get()

fun firstPresentEnvValue(vararg names: String): String =
    names.firstNotNullOfOrNull { name ->
        providers.environmentVariable(name).orNull?.takeIf { it.isNotBlank() }
    }.orEmpty()

fun commandOutput(vararg command: String): String =
    try {
        providers.exec {
            commandLine(command.toList())
            isIgnoreExitValue = true
        }.standardOutput.asText.get().trim()
    } catch (_: RuntimeException) {
        ""
    }

fun String.asSingleLineEvidence(): String =
    replace(Regex("\\s*\\r?\\n\\s*"), " | ").trim()

val ciBuildNumber = providers.environmentVariable("GITHUB_RUN_NUMBER")
    .orElse("1")
    .get()
    .toIntOrNull()
    ?: 1

val projectLatestCommit = firstPresentEnvValue("GITHUB_SHA")
    .ifBlank { commandOutput("git", "rev-parse", "--short", "HEAD") }

val projectLatestCommitMessage = firstPresentEnvValue("ARITENIS_LATEST_COMMIT_MESSAGE")
    .ifBlank { commandOutput("git", "log", "-1", "--pretty=%s") }

val projectTodayStart = LocalDate.now(ZoneId.of("Asia/Calcutta"))
    .atStartOfDay(ZoneId.of("Asia/Calcutta"))
    .toOffsetDateTime()
    .toString()

val projectCommitsToday = firstPresentEnvValue("ARITENIS_COMMITS_TODAY")
    .ifBlank { commandOutput("git", "rev-list", "--count", "--since=$projectTodayStart", "HEAD") }

val projectBranchState = firstPresentEnvValue("ARITENIS_BRANCH_STATE")
    .ifBlank { commandOutput("git", "status", "--short", "--branch").asSingleLineEvidence() }

val projectBuildVerifiedAt = firstPresentEnvValue("ARITENIS_BUILD_VERIFIED_AT")
    .ifBlank { Instant.now().toString() }

android {
    namespace = "com.example.mykeyboard"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.example.mykeyboard"
        minSdk = 24
        targetSdk = 36
        versionCode = ciBuildNumber
        versionName = "1.0.$ciBuildNumber"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "SUPABASE_URL", envValue("ARITENIS_SUPABASE_URL").asBuildConfigString())
        buildConfigField("String", "SUPABASE_ANON_KEY", envValue("ARITENIS_SUPABASE_ANON_KEY").asBuildConfigString())
        buildConfigField("Boolean", "PERSONAL_JARVIS_ENABLED", "true")
        buildConfigField(
            "String",
            "FOUNDER_BRAIN_API_URL",
            firstPresentEnvValue(
                "ARITENIS_FOUNDER_BRAIN_API_URL",
                "FOUNDER_BRAIN_API_URL"
            ).asBuildConfigString()
        )
        buildConfigField(
            "String",
            "FOUNDER_BRAIN_API_TOKEN",
            firstPresentEnvValue(
                "ARITENIS_FOUNDER_BRAIN_API_TOKEN",
                "FOUNDER_BRAIN_API_TOKEN"
            ).asBuildConfigString()
        )
        buildConfigField(
            "String",
            "PICOVOICE_ACCESS_KEY",
            firstPresentEnvValue(
                "ARITENIS_PICOVOICE_ACCESS_KEY",
                "PICOVOICE_ACCESS_KEY"
            ).asBuildConfigString()
        )
        buildConfigField("String", "PROJECT_CURRENT_PHASE", envValue("ARITENIS_CURRENT_PHASE").asBuildConfigString())
        buildConfigField("String", "PROJECT_CURRENT_MILESTONE", envValue("ARITENIS_CURRENT_MILESTONE").asBuildConfigString())
        buildConfigField("String", "PROJECT_LATEST_COMMIT", projectLatestCommit.asBuildConfigString())
        buildConfigField("String", "PROJECT_LATEST_COMMIT_MESSAGE", projectLatestCommitMessage.asBuildConfigString())
        buildConfigField("String", "PROJECT_COMMITS_TODAY", projectCommitsToday.asBuildConfigString())
        buildConfigField("String", "PROJECT_BRANCH_STATE", projectBranchState.asBuildConfigString())
        buildConfigField("String", "PROJECT_BUILD_STATUS", envValue("ARITENIS_BUILD_STATUS").asBuildConfigString())
        buildConfigField("String", "PROJECT_LAST_SUCCESSFUL_BUILD", envValue("ARITENIS_LAST_SUCCESSFUL_BUILD").asBuildConfigString())
        buildConfigField("String", "PROJECT_LAST_FAILED_BUILD", envValue("ARITENIS_LAST_FAILED_BUILD").asBuildConfigString())
        buildConfigField("String", "PROJECT_CI_STATE", envValue("ARITENIS_CI_STATE").asBuildConfigString())
        buildConfigField("String", "PROJECT_KNOWN_BLOCKERS", envValue("ARITENIS_KNOWN_BLOCKERS").asBuildConfigString())
        buildConfigField(
            "String",
            "PROJECT_OPEN_BLOCKERS",
            firstPresentEnvValue("ARITENIS_OPEN_BLOCKERS", "ARITENIS_KNOWN_BLOCKERS").asBuildConfigString()
        )
        buildConfigField("String", "PROJECT_ACTIVE_RUNTIME_MODULES", envValue("ARITENIS_ACTIVE_RUNTIME_MODULES").asBuildConfigString())
        buildConfigField("String", "PROJECT_BUILD_VERIFIED_AT", projectBuildVerifiedAt.asBuildConfigString())
        buildConfigField("String", "PERSONAL_SCHEDULE", envValue("ARITENIS_PERSONAL_SCHEDULE").asBuildConfigString())
        buildConfigField("String", "PERSONAL_CLASS_TIMINGS", envValue("ARITENIS_CLASS_TIMINGS").asBuildConfigString())
        buildConfigField("String", "PERSONAL_BADMINTON_TIMINGS", envValue("ARITENIS_BADMINTON_TIMINGS").asBuildConfigString())
        buildConfigField("String", "PERSONAL_JEE_TIMINGS", envValue("ARITENIS_JEE_TIMINGS").asBuildConfigString())
        buildConfigField("String", "PERSONAL_HOMEWORK_TASKS", envValue("ARITENIS_HOMEWORK_TASKS").asBuildConfigString())
        buildConfigField("String", "PERSONAL_MANUAL_COMMITMENTS", envValue("ARITENIS_MANUAL_COMMITMENTS").asBuildConfigString())
        buildConfigField("String", "PERSONAL_SNAPSHOT_VERIFIED_AT", envValue("ARITENIS_PERSONAL_SNAPSHOT_VERIFIED_AT").asBuildConfigString())
        buildConfigField("String", "AGENT_VISIBILITY_JSON", envValue("ARITENIS_AGENT_VISIBILITY_JSON").asBuildConfigString())
        buildConfigField("String", "AGENT_VISIBILITY_VERIFIED_AT", envValue("ARITENIS_AGENT_VISIBILITY_VERIFIED_AT").asBuildConfigString())
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("ai.picovoice:porcupine-android:4.0.0")
    implementation("com.alphacephei:vosk-android:0.3.75")
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation("org.json:json:20231013")
    implementation("org.rednoise:rita:2.8.21")
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
