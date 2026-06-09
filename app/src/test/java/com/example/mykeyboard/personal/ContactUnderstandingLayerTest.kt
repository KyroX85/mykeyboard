package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class ContactUnderstandingLayerTest {
    @Test
    fun unknownRelationshipAsksInsteadOfGuessing() {
        val result = ContactUnderstandingLayer.resolve("Mom", InMemoryContactRelationshipMemory())

        assertTrue(result is ContactResolution.Unknown)
        assertEquals("Who is Mom to you?", (result as ContactResolution.Unknown).prompt)
    }

    @Test
    fun founderConfirmedRelationshipResolvesFutureReference() {
        val memory = InMemoryContactRelationshipMemory()
        val learning = ContactUnderstandingLayer.parseLearning("Anitha is my mom")
        assertTrue(learning != null)
        memory.save(ContactUnderstandingLayer.createRelationship(learning!!, Instant.parse("2026-06-09T10:00:00Z")))

        val result = ContactUnderstandingLayer.resolve("Mom", memory)

        assertTrue(result is ContactResolution.Known)
        val relationship = (result as ContactResolution.Known).relationship
        assertEquals("Anitha", relationship.displayName)
        assertEquals("mom", relationship.relationship)
        assertEquals(0.95f, relationship.confidence)
        assertEquals("2026-06-09T10:00:00Z", relationship.lastVerified)
    }

    @Test
    fun normalContactNamesDoNotBecomeRelationshipGuesses() {
        val result = ContactUnderstandingLayer.resolve("Rahul", InMemoryContactRelationshipMemory())

        assertTrue(result is ContactResolution.NotRelationship)
    }

    @Test
    fun relationshipAliasesResolveToFounderConfirmedContact() {
        val memory = InMemoryContactRelationshipMemory()
        val learning = ContactUnderstandingLayer.parseLearning("Anitha is my mom")
        memory.save(ContactUnderstandingLayer.createRelationship(learning!!, Instant.parse("2026-06-09T10:00:00Z")))

        val result = ContactUnderstandingLayer.resolve("amma", memory)

        assertTrue(result is ContactResolution.Known)
        assertEquals("Anitha", (result as ContactResolution.Known).relationship.displayName)
    }
}
