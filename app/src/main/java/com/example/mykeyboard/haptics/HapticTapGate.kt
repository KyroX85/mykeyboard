package com.example.mykeyboard.haptics

class HapticTapGate(
    private val minIntervalMs: Long
) {
    private var lastPulseAtMs = Long.MIN_VALUE

    fun shouldPulse(nowMs: Long): Boolean {
        if (lastPulseAtMs != Long.MIN_VALUE && nowMs - lastPulseAtMs < minIntervalMs) {
            return false
        }

        lastPulseAtMs = nowMs
        return true
    }

    fun reset() {
        lastPulseAtMs = Long.MIN_VALUE
    }
}
