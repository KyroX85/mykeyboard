package com.example.mykeyboard.personal

object JarvisBrainSpeechPolicy {
    fun speechFor(answer: JarvisBrainAnswer): String =
        answer.voiceSummary.trim()
}
