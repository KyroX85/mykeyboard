package com.example.mykeyboard.haptics

import com.example.mykeyboard.KeyboardSymbols
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticProfileTest {

    @Test
    fun normalKeysUseStrongerNoticeablePulse() {
        val profile = HapticProfile.forKey("a")

        assertEquals(HapticKind.Normal, profile.kind)
        assertEquals(16L, profile.durationMs)
        assertEquals(180, profile.amplitude)
    }

    @Test
    fun backspaceUsesSharperPulse() {
        val profile = HapticProfile.forKey(KeyboardSymbols.BACKSPACE)

        assertEquals(HapticKind.Backspace, profile.kind)
        assertEquals(18L, profile.durationMs)
        assertTrue(profile.amplitude > HapticProfile.forKey("a").amplitude)
    }

    @Test
    fun enterActionsUseDeeperPulse() {
        val profile = HapticProfile.forKey(KeyboardSymbols.ENTER)

        assertEquals(HapticKind.Action, profile.kind)
        assertEquals(20L, profile.durationMs)
        assertTrue(profile.amplitude > HapticProfile.forKey("a").amplitude)
    }

    @Test
    fun spacebarUsesSofterButNoticeablePulse() {
        val profile = HapticProfile.forKey("space")

        assertEquals(HapticKind.Space, profile.kind)
        assertEquals(14L, profile.durationMs)
        assertTrue(profile.amplitude < HapticProfile.forKey("a").amplitude)
    }
}
