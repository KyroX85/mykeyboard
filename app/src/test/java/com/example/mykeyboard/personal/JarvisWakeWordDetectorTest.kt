package com.example.mykeyboard.personal

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisWakeWordDetectorTest {
    @Test
    fun detectsHeyJarvisPhrase() {
        assertTrue(JarvisWakeWordDetector.containsWakeWord("hey jarvis"))
        assertTrue(JarvisWakeWordDetector.containsWakeWord("Hey, Jarvis can you hear me"))
        assertTrue(JarvisWakeWordDetector.containsWakeWord("JARVIS"))
    }

    @Test
    fun ignoresNonWakePhrases() {
        assertFalse(JarvisWakeWordDetector.containsWakeWord("hey keyboard"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("java service"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord(""))
    }
}
