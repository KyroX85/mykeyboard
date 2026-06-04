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
        assertTrue(JarvisWakeWordDetector.containsWakeWord("he Jarvis"))
        assertTrue(JarvisWakeWordDetector.containsWakeWord("hey Javis"))
        assertTrue(JarvisWakeWordDetector.containsWakeWord("a Jarvis"))
        assertTrue(JarvisWakeWordDetector.containsWakeWord("he Javed"))
    }

    @Test
    fun ignoresNonWakePhrases() {
        assertFalse(JarvisWakeWordDetector.containsWakeWord("hey keyboard"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("java service"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("javed"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord("javelin"))
        assertFalse(JarvisWakeWordDetector.containsWakeWord(""))
    }
}
