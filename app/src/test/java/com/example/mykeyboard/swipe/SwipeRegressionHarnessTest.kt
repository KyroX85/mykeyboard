package com.example.mykeyboard.swipe

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SwipeRegressionHarnessTest {

    @Test
    fun replaysCommonRawAndWeightedSwipeGesturesDeterministically() {
        val resolver = SwipeWordResolver()
        val candidates = commonCandidates()

        val cases = listOf(
            ReplayCase("hi", weighted = "hi", raw = "huji", expected = "hi"),
            ReplayCase("how", weighted = "ho", raw = "hwo", expected = "how"),
            ReplayCase("this", weighted = "this", raw = "tgjis", expected = "this"),
            ReplayCase("you", weighted = "yu", raw = "yiu", expected = "you"),
            ReplayCase("because", weighted = "becuse", raw = "becsuse", expected = "because"),
            ReplayCase("hello", weighted = "helo", raw = "hrllo", expected = "hello"),
            ReplayCase("good", weighted = "god", raw = "gppd", expected = "good")
        )

        for (case in cases) {
            assertEquals(case.name, case.expected, resolver.resolve(case.paths, candidates).firstOrNull())
        }
    }

    @Test
    fun replaysTrustedCustomWordWithoutHallucinatingOnChaos() {
        val resolver = SwipeWordResolver()
        val candidates = commonCandidates() + SwipeWordCandidate(
            "kaamesh",
            frequency = 12,
            acceptedCount = 2,
            trustedLearned = true
        )

        assertEquals("kaamesh", resolver.resolve(listOf("kmsh", "kuaamjsh"), candidates).firstOrNull())
        assertTrue(resolver.resolve("qazplmokn", candidates).isEmpty())
        assertTrue(resolver.resolve("zzzxxyqq", candidates).isEmpty())
    }

    private fun commonCandidates(): List<SwipeWordCandidate> = listOf(
        SwipeWordCandidate("hi", frequency = 42),
        SwipeWordCandidate("how", frequency = 40),
        SwipeWordCandidate("this", frequency = 38),
        SwipeWordCandidate("you", frequency = 46),
        SwipeWordCandidate("because", frequency = 50),
        SwipeWordCandidate("hello", frequency = 36),
        SwipeWordCandidate("good", frequency = 34),
        SwipeWordCandidate("the", frequency = 48),
        SwipeWordCandidate("what", frequency = 34),
        SwipeWordCandidate("where", frequency = 32)
    )

    private data class ReplayCase(
        val name: String,
        val weighted: String,
        val raw: String,
        val expected: String
    ) {
        val paths: List<String> = listOf(weighted, raw)
    }
}
