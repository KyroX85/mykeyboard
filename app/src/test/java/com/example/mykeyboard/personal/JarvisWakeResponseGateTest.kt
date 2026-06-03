package com.example.mykeyboard.personal

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class JarvisWakeResponseGateTest {
    @Test
    fun usesYesSirAsLocalWakeResponse() {
        assertEquals("Yes Sir", JarvisWakeResponseGate.RESPONSE_TEXT)
    }

    @Test
    fun suppressesRepeatedPartialWakeResultsDuringCooldown() {
        val gate = JarvisWakeResponseGate(cooldownMs = 2500L)

        assertTrue(gate.shouldRespond(nowMs = 1000L))
        assertFalse(gate.shouldRespond(nowMs = 1200L))
        assertFalse(gate.shouldRespond(nowMs = 3499L))
        assertTrue(gate.shouldRespond(nowMs = 3500L))
    }
}
