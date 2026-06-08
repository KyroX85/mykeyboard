package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Test

class JarvisConversationCommandTest {
    @Test
    fun takeRestEndsActiveConversation() {
        listOf(
            "take rest",
            "Jarvis take rest",
            "go to sleep",
            "stop listening"
        ).forEach { phrase ->
            assertEquals(phrase, JarvisConversationCommandType.TAKE_REST, JarvisConversationCommand.classify(phrase))
        }
    }

    @Test
    fun continuationPhrasesKeepConversationOpen() {
        listOf(
            "continue",
            "next",
            "anything else?"
        ).forEach { phrase ->
            assertEquals(
                phrase,
                JarvisConversationCommandType.CONTINUE_PROMPT,
                JarvisConversationCommand.classify(phrase)
            )
        }
    }

    @Test
    fun normalQuestionsStayQuestions() {
        assertEquals(
            JarvisConversationCommandType.QUESTION,
            JarvisConversationCommand.classify("what am I building")
        )
    }
}
