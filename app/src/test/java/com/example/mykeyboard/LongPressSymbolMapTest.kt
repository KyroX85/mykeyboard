package com.example.mykeyboard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LongPressSymbolMapTest {

    @Test
    fun topLetterRowDoesNotExposeLongPressNumbers() {
        for (key in listOf("y")) {
            assertNull(LongPressSymbolMap.symbolFor(key))
            assertNull(LongPressSymbolMap.hintFor(key))
        }
    }

    @Test
    fun mapsTopRowToHighFrequencySymbolsWithoutNumbers() {
        assertEquals("\\", LongPressSymbolMap.symbolFor("q"))
        assertEquals("$", LongPressSymbolMap.symbolFor("w"))
        assertEquals("€", LongPressSymbolMap.symbolFor("e"))
        assertEquals("[", LongPressSymbolMap.symbolFor("r"))
        assertEquals("]", LongPressSymbolMap.symbolFor("t"))
        assertEquals("_", LongPressSymbolMap.symbolFor("u"))
        assertEquals("+", LongPressSymbolMap.symbolFor("i"))
        assertEquals("=", LongPressSymbolMap.symbolFor("o"))
        assertEquals("*", LongPressSymbolMap.symbolFor("p"))
        for (key in listOf("q", "w", "e", "r", "t", "u", "i", "o", "p")) {
            assertEquals(LongPressSymbolMap.symbolFor(key), LongPressSymbolMap.hintFor(key))
        }
    }

    @Test
    fun mapsHomeAndBottomRowsToCommonSymbols() {
        assertEquals("@", LongPressSymbolMap.symbolFor("a"))
        assertEquals(";", LongPressSymbolMap.symbolFor("s"))
        assertEquals(":", LongPressSymbolMap.symbolFor("d"))
        assertEquals("/", LongPressSymbolMap.symbolFor("f"))
        assertEquals("&", LongPressSymbolMap.symbolFor("g"))
        assertEquals("-", LongPressSymbolMap.symbolFor("h"))
        assertEquals("(", LongPressSymbolMap.symbolFor("j"))
        assertEquals(")", LongPressSymbolMap.symbolFor("k"))
        assertEquals("\"", LongPressSymbolMap.symbolFor("l"))
        assertEquals("#", LongPressSymbolMap.symbolFor("z"))
        assertEquals("%", LongPressSymbolMap.symbolFor("x"))
        assertEquals("!", LongPressSymbolMap.symbolFor("c"))
        assertEquals("?", LongPressSymbolMap.symbolFor("v"))
        assertEquals(",", LongPressSymbolMap.symbolFor("b"))
        assertEquals(".", LongPressSymbolMap.symbolFor("n"))
        assertEquals("'", LongPressSymbolMap.symbolFor("m"))
    }

    @Test
    fun mapsNumberLayerBracketsToBraceLongPresses() {
        assertEquals("{", LongPressSymbolMap.symbolFor("["))
        assertEquals("}", LongPressSymbolMap.symbolFor("]"))
        assertEquals("{", LongPressSymbolMap.hintFor("["))
        assertEquals("}", LongPressSymbolMap.hintFor("]"))
    }

    @Test
    fun exposesVisibleHintMatchingCommittedSymbol() {
        for (key in listOf("a", "d", "z", "m")) {
            assertEquals(LongPressSymbolMap.symbolFor(key), LongPressSymbolMap.hintFor(key))
        }
    }

    @Test
    fun ignoresNonLetterControlKeys() {
        assertNull(LongPressSymbolMap.symbolFor("space"))
        assertNull(LongPressSymbolMap.symbolFor("123"))
    }
}
