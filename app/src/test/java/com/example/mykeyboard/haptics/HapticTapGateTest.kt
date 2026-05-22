package com.example.mykeyboard.haptics

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticTapGateTest {

    @Test
    fun allowsFirstTapImmediately() {
        val gate = HapticTapGate(minIntervalMs = 24L)

        assertTrue(gate.shouldPulse(100L))
    }

    @Test
    fun suppressesRapidQueueBuildupInsideInterval() {
        val gate = HapticTapGate(minIntervalMs = 24L)

        assertTrue(gate.shouldPulse(100L))
        assertFalse(gate.shouldPulse(110L))
        assertFalse(gate.shouldPulse(123L))
        assertTrue(gate.shouldPulse(124L))
    }

    @Test
    fun resetAllowsNextSessionPulse() {
        val gate = HapticTapGate(minIntervalMs = 24L)

        assertTrue(gate.shouldPulse(100L))
        gate.reset()

        assertTrue(gate.shouldPulse(101L))
    }
}
