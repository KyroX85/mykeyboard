package com.example.mykeyboard.haptics

import com.example.mykeyboard.KeyboardSymbols

enum class HapticKind {
    Normal,
    Backspace,
    Action,
    Space
}

data class HapticProfile(
    val kind: HapticKind,
    val durationMs: Long,
    val amplitude: Int
) {
    companion object {
        private const val KEY_SPACE = "space"
        private val NORMAL = HapticProfile(HapticKind.Normal, durationMs = 16L, amplitude = 180)
        private val BACKSPACE = HapticProfile(HapticKind.Backspace, durationMs = 18L, amplitude = 210)
        private val ACTION = HapticProfile(HapticKind.Action, durationMs = 20L, amplitude = 220)
        private val SPACE = HapticProfile(HapticKind.Space, durationMs = 14L, amplitude = 150)

        fun forKey(key: String): HapticProfile = when (key) {
            KeyboardSymbols.BACKSPACE -> BACKSPACE
            KeyboardSymbols.ENTER -> ACTION
            KEY_SPACE -> SPACE
            else -> NORMAL
        }
    }
}
