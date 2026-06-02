package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JarvisQuestionDetectorTest {
    @Test
    fun extractsDirectJarvisQuestion() {
        val question = JarvisQuestionDetector.extractQuestion(
            JarvisNotificationSnapshot(
                packageName = "com.whatsapp",
                title = "Kaamesh",
                text = "Jarvis, what should I do about the APK release?"
            )
        )

        assertEquals("what should I do about the APK release?", question)
    }

    @Test
    fun ignoresQuestionsNotAddressedToJarvis() {
        val question = JarvisQuestionDetector.extractQuestion(
            JarvisNotificationSnapshot(
                packageName = "com.whatsapp",
                title = "Rahul",
                text = "What time is the class?"
            )
        )

        assertNull(question)
    }
}
