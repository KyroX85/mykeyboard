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

val ciBuildNumber = providers.environmentVariable("GITHUB_RUN_NUMBER")
    .orElse("1")
    .get()
    .toIntOrNull()
    ?: 1

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
