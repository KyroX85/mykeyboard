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
        private val NORMAL = HapticProfile(HapticKind.Normal, durationMs = 8L, amplitude = 92)
        private val BACKSPACE = HapticProfile(HapticKind.Backspace, durationMs = 5L, amplitude = 118)
        private val ACTION = HapticProfile(HapticKind.Action, durationMs = 10L, amplitude = 128)
        private val SPACE = HapticProfile(HapticKind.Space, durationMs = 6L, amplitude = 64)

        fun forKey(key: String): HapticProfile = when (key) {
            KeyboardSymbols.BACKSPACE -> BACKSPACE
            KeyboardSymbols.ENTER -> ACTION
            KEY_SPACE -> SPACE
            else -> NORMAL
        }
    }
}
