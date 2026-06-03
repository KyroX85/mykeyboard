package com.example.mykeyboard.personal

class JarvisWakeResponseGate(
    private val cooldownMs: Long = DEFAULT_COOLDOWN_MS
) {
    private var lastResponseAtMs: Long = Long.MIN_VALUE

    fun shouldRespond(nowMs: Long): Boolean {
        val shouldRespond = lastResponseAtMs == Long.MIN_VALUE ||
            nowMs - lastResponseAtMs >= cooldownMs
        if (shouldRespond) {
            lastResponseAtMs = nowMs
        }
        return shouldRespond
    }

    companion object {
        const val RESPONSE_TEXT = "Yes Sir"
        private const val DEFAULT_COOLDOWN_MS = 2500L
    }
}
