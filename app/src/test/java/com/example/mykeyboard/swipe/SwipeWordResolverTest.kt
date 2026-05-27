package com.example.mykeyboard.swipe

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SwipeWordResolverTest {

    @Test
    fun exactAndHighTrustWordsRankFirst() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("thus", frequency = 4),
            SwipeWordCandidate("this", frequency = 20, acceptedCount = 1),
            SwipeWordCandidate("thesis", frequency = 8)
        )

        val result = resolver.resolve("this", candidates)

        assertEquals("this", result.firstOrNull())
    }

    @Test
    fun toleratesMissingInteriorLetterFromSloppySwipe() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("this", frequency = 16),
            SwipeWordCandidate("thus", frequency = 8),
            SwipeWordCandidate("toast", frequency = 30)
        )

        val result = resolver.resolve("ths", candidates)

        assertEquals("this", result.firstOrNull())
    }

    @Test
    fun toleratesExtraIntermediateKeysFromRealSwipePath() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("this", frequency = 16),
            SwipeWordCandidate("thus", frequency = 8)
        )

        val result = resolver.resolve("tghis", candidates)

        assertEquals("this", result.firstOrNull())
    }

    @Test
    fun recoversShortCommonWordsFromAdjacentExtraKeys() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("hi", frequency = 40),
            SwipeWordCandidate("hill", frequency = 8),
            SwipeWordCandidate("hug", frequency = 6)
        )

        assertEquals("hi", resolver.resolve("hui", candidates).firstOrNull())
        assertEquals("hi", resolver.resolve("hji", candidates).firstOrNull())
    }

    @Test
    fun recoversCommonWordsFromAdjacentDriftAndSubstitution() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("how", frequency = 40),
            SwipeWordCandidate("you", frequency = 44),
            SwipeWordCandidate("this", frequency = 36),
            SwipeWordCandidate("good", frequency = 30),
            SwipeWordCandidate("what", frequency = 34),
            SwipeWordCandidate("where", frequency = 32),
            SwipeWordCandidate("hello", frequency = 36),
            SwipeWordCandidate("because", frequency = 30),
            SwipeWordCandidate("thus", frequency = 8)
        )

        assertEquals("how", resolver.resolve("hwo", candidates).firstOrNull())
        assertEquals("what", resolver.resolve("wjat", candidates).firstOrNull())
        assertEquals("where", resolver.resolve("whwre", candidates).firstOrNull())
        assertEquals("you", resolver.resolve("yiu", candidates).firstOrNull())
        assertEquals("this", resolver.resolve("tjis", candidates).firstOrNull())
        assertEquals("good", resolver.resolve("gppd", candidates).firstOrNull())
        assertEquals("hello", resolver.resolve("hrllo", candidates).firstOrNull())
        assertEquals("because", resolver.resolve("becsuse", candidates).firstOrNull())
    }

    @Test
    fun toleratesMessyHumanThumbDriftForCommonWords() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("hello", frequency = 36),
            SwipeWordCandidate("this", frequency = 38),
            SwipeWordCandidate("good", frequency = 34),
            SwipeWordCandidate("how", frequency = 40)
        )

        assertEquals("hello", resolver.resolve("hujello", candidates).firstOrNull())
        assertEquals("this", resolver.resolve("tgjis", candidates).firstOrNull())
        assertEquals("good", resolver.resolve("gipoid", candidates).firstOrNull())
        assertEquals("how", resolver.resolve("hjow", candidates).firstOrNull())
    }

    @Test
    fun recoversWeakNoisyGesturesWithSafeCommonFallbacks() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("the", frequency = 48),
            SwipeWordCandidate("you", frequency = 46),
            SwipeWordCandidate("how", frequency = 40),
            SwipeWordCandidate("what", frequency = 30),
            SwipeWordCandidate("zebra", frequency = 5)
        )

        assertEquals("you", resolver.resolve("uop", candidates).firstOrNull())
        assertEquals("what", resolver.resolve("wjqt", candidates).firstOrNull())
    }

    @Test
    fun hybridResolutionLetsTrustedCustomWordsUseWeightedAndRawPaths() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("kaamesh", frequency = 12, acceptedCount = 3, contextualFrequency = 4, trustedLearned = true),
            SwipeWordCandidate("because", frequency = 50),
            SwipeWordCandidate("hello", frequency = 36),
            SwipeWordCandidate("how", frequency = 40)
        )

        val result = resolver.resolve(listOf("kmsh", "kuaamjsh"), candidates)

        assertEquals("kaamesh", result.firstOrNull())
    }

    @Test
    fun strongPathIntentBeatsHighFrequencySafeFallback() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("the", frequency = 80),
            SwipeWordCandidate("this", frequency = 18),
            SwipeWordCandidate("thus", frequency = 12)
        )

        val result = resolver.resolve(listOf("this", "tgjis"), candidates)

        assertEquals("this", result.firstOrNull())
    }

    @Test
    fun exactIntendedPathBeatsStackedTrustedBonuses() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("this", frequency = 8),
            SwipeWordCandidate("thesis", frequency = 12, acceptedCount = 20, contextualFrequency = 20, trustedLearned = true)
        )

        val result = resolver.resolve("this", candidates)

        assertEquals("this", result.firstOrNull())
    }

    @Test
    fun trustedLearnedWordsNeedRoughPathOrder() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("kaamesh", frequency = 20, acceptedCount = 5, trustedLearned = true),
            SwipeWordCandidate("hello", frequency = 40),
            SwipeWordCandidate("what", frequency = 34)
        )

        val result = resolver.resolve("qazplmokn", candidates)

        assertTrue(result.isEmpty())
    }

    @Test
    fun weakFallbackDoesNotReturnBizarreUnrelatedWords() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("zebra", frequency = 5),
            SwipeWordCandidate("xylophone", frequency = 4)
        )

        assertTrue(resolver.resolve("uop", candidates).isEmpty())
    }

    @Test
    fun suppressesGarbageForWeakSequences() {
        val resolver = SwipeWordResolver()

        val result = resolver.resolve(
            "qazplmokn",
            listOf(
                SwipeWordCandidate("hi", frequency = 42),
                SwipeWordCandidate("how", frequency = 40),
                SwipeWordCandidate("you", frequency = 46),
                SwipeWordCandidate("this", frequency = 38),
                SwipeWordCandidate("good", frequency = 34),
                SwipeWordCandidate("because", frequency = 50),
                SwipeWordCandidate("people", frequency = 50)
            )
        )

        assertTrue(result.isEmpty())
        assertTrue(resolver.resolve("zzzxxyqq", listOf(
            SwipeWordCandidate("how", frequency = 40),
            SwipeWordCandidate("what", frequency = 34),
            SwipeWordCandidate("where", frequency = 32),
            SwipeWordCandidate("good", frequency = 34),
            SwipeWordCandidate("hello", frequency = 36),
            SwipeWordCandidate("because", frequency = 30)
        )).isEmpty())
    }

    @Test
    fun resolvesLongWordsWithoutConfidenceCollapseWhenCandidateExists() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("conversation", frequency = 32),
            SwipeWordCandidate("development", frequency = 32),
            SwipeWordCandidate("understanding", frequency = 28),
            SwipeWordCandidate("because", frequency = 30),
            SwipeWordCandidate("architecture", frequency = 28),
            SwipeWordCandidate("information", frequency = 32),
            SwipeWordCandidate("keyboard", frequency = 28),
            SwipeWordCandidate("confidence", frequency = 28),
            SwipeWordCandidate("between", frequency = 28),
            SwipeWordCandidate("tomorrow", frequency = 28)
        )

        assertEquals("conversation", resolver.resolve("conversatuon", candidates).firstOrNull())
        assertEquals("development", resolver.resolve("devekopment", candidates).firstOrNull())
        assertEquals("understanding", resolver.resolve("understamding", candidates).firstOrNull())
        assertEquals("because", resolver.resolve("becsuse", candidates).firstOrNull())
        assertEquals("architecture", resolver.resolve("arxhitecture", candidates).firstOrNull())
        assertEquals("information", resolver.resolve("infotmation", candidates).firstOrNull())
        assertEquals("keyboard", resolver.resolve("keyboafd", candidates).firstOrNull())
        assertEquals("confidence", resolver.resolve("confidenxe", candidates).firstOrNull())
        assertEquals("between", resolver.resolve("betwern", candidates).firstOrNull())
        assertEquals("tomorrow", resolver.resolve("tomorriw", candidates).firstOrNull())
    }

    @Test
    fun resolvesCompressedLongWordSwipesWithoutOverRejectingInteriorSkips() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("conversation", frequency = 32),
            SwipeWordCandidate("development", frequency = 32),
            SwipeWordCandidate("information", frequency = 32),
            SwipeWordCandidate("architecture", frequency = 28),
            SwipeWordCandidate("understanding", frequency = 28),
            SwipeWordCandidate("because", frequency = 30)
        )

        assertEquals("conversation", resolver.resolve("cnvrsation", candidates).firstOrNull())
        assertEquals("development", resolver.resolve("dvlopment", candidates).firstOrNull())
        assertEquals("information", resolver.resolve("infrmation", candidates).firstOrNull())
        assertEquals("architecture", resolver.resolve("archtecture", candidates).firstOrNull())
        val diagnostics = mutableListOf<String>()
        val understanding = resolver.resolve(
            listOf("undrstnding"),
            candidates,
            debugReporter = diagnostics::add
        ).firstOrNull()
        assertEquals(diagnostics.joinToString("\n"), "understanding", understanding)
    }

    @Test
    fun keepsLongCommonWordsAvailableWithMultipleInteriorDrifts() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("conversation", frequency = 32),
            SwipeWordCandidate("development", frequency = 32),
            SwipeWordCandidate("architecture", frequency = 28),
            SwipeWordCandidate("information", frequency = 32),
            SwipeWordCandidate("confidence", frequency = 28),
            SwipeWordCandidate("tomorrow", frequency = 28)
        )

        assertEquals("conversation", resolver.resolve("conversqtion", candidates).firstOrNull())
        assertEquals("development", resolver.resolve("develooment", candidates).firstOrNull())
        assertEquals("architecture", resolver.resolve("architecrure", candidates).firstOrNull())
        assertEquals("information", resolver.resolve("informqtion", candidates).firstOrNull())
        assertEquals("confidence", resolver.resolve("confidrnce", candidates).firstOrNull())
        assertEquals("tomorrow", resolver.resolve("tomorroe", candidates).firstOrNull())
    }

    @Test
    fun longWordRecoveryStaysConservativeWhenSignalIsTooWeak() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("conversation", frequency = 32),
            SwipeWordCandidate("development", frequency = 32),
            SwipeWordCandidate("understanding", frequency = 28)
        )

        assertTrue(resolver.resolve("caa", candidates).isEmpty())
        assertTrue(resolver.resolve("uvx", candidates).isEmpty())
    }

    @Test
    fun rejectsLongWordTrustCollapseForChaoticPaths() {
        val resolver = SwipeWordResolver()
        val candidates = listOf(
            SwipeWordCandidate("conversation", frequency = 50),
            SwipeWordCandidate("development", frequency = 50),
            SwipeWordCandidate("architecture", frequency = 50),
            SwipeWordCandidate("information", frequency = 50),
            SwipeWordCandidate("confidence", frequency = 50)
        )

        assertTrue(resolver.resolve("qazplmokn", candidates).isEmpty())
        assertTrue(resolver.resolve("zzzxxyqq", candidates).isEmpty())
    }
}
