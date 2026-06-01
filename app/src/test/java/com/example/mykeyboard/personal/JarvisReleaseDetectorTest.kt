package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class JarvisReleaseDetectorTest {
    @Test
    fun detectsFirebaseApkReadyNotification() {
        val signal = JarvisReleaseDetector.detect(
            JarvisNotificationSnapshot(
                packageName = "com.google.firebase.appdistribution",
                title = "Firebase App Distribution",
                text = "Aritenis APK is ready and available for testing."
            )
        )

        assertNotNull(signal)
        assertEquals(JarvisReleaseSignal.Priority.READY, signal!!.priority)
        assertEquals("Sir, a new Aritenis APK is ready.", signal.speech)
    }

    @Test
    fun detectsGithubBuildFailureNotification() {
        val signal = JarvisReleaseDetector.detect(
            JarvisNotificationSnapshot(
                packageName = "com.github.android",
                title = "GitHub Actions",
                text = "MyKeyboard build APK failed."
            )
        )

        assertNotNull(signal)
        assertEquals(JarvisReleaseSignal.Priority.FAILED, signal!!.priority)
        assertEquals("Sir, the Aritenis build failed.", signal.speech)
    }

    @Test
    fun ignoresUnrelatedNotifications() {
        val signal = JarvisReleaseDetector.detect(
            JarvisNotificationSnapshot(
                packageName = "com.whatsapp",
                title = "Rahul",
                text = "Where are you?"
            )
        )

        assertNull(signal)
    }
}
