package com.example.mykeyboard.personal

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisWakeWordDetectorTest {
    @Test
    fun detectsHeyJarvisPhrase() {
        assertTrue(JarvisWakeWordDetector.containsWakeWord("hey jarvis"))
        assertTrue(JarvisWakeWordDetector.containsWakeWord("Hey, Jarvis can you hear me"))
    }

    @Test
    fun ignoresNonWakePhrases() {
        assertFalse(JarvisWakeWordDetector.containsWakeWord("JARVIS"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("he Jarvis"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("hey Javis"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("a Jarvis"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("he Javed"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("hey keyboard"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("java service"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("javed"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("javelin"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord(""))
    }

    @Test
    fun explainsRejectedWakeCandidates() {
        val singleWord = JarvisWakeWordDetector.evaluate("jarvis")
        assertFalse(singleWord.accepted)
        assertTrue(singleWord.reason.contains("single word"))

        val completePhrase = JarvisWakeWordDetector.evaluate("hey jarvis")
        assertTrue(completePhrase.accepted)
        assertTrue(completePhrase.confidence >= 1.0f)
    }
}
