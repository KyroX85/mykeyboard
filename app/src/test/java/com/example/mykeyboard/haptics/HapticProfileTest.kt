package com.example.mykeyboard.haptics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticProfileTest {

    @Test
    fun normalKeysUseCrispNoticeablePulse() {
        val profile = HapticProfile.forKey("a")

        assertEquals(HapticKind.Normal, profile.kind)
        assertEquals(8L, profile.durationMs)
        assertEquals(92, profile.amplitude)
    }

    @Test
    fun backspaceUsesSharperPulse() {
        val profile = HapticProfile.forKey("⌫")

        assertEquals(HapticKind.Backspace, profile.kind)
        assertEquals(5L, profile.durationMs)
        assertTrue(profile.amplitude > HapticProfile.forKey("a").amplitude)
    }

    @Test
    fun enterActionsUseDeeperPulse() {
        val profile = HapticProfile.forKey("⏎")

        assertEquals(HapticKind.Action, profile.kind)
        assertEquals(10L, profile.durationMs)
        assertTrue(profile.amplitude > HapticProfile.forKey("a").amplitude)
    }

    @Test
    fun spacebarUsesSofterPulse() {
        val profile = HapticProfile.forKey("space")

        assertEquals(HapticKind.Space, profile.kind)
        assertEquals(6L, profile.durationMs)
        assertTrue(profile.amplitude < HapticProfile.forKey("a").amplitude)
    }
}
