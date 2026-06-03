package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Test

class PersonalJarvisConfigTest {
    @Test
    fun founderBrainEndpointAcceptsBaseBrainOrFullQuestionUrl() {
        assertEquals(
            "https://mykeyboard.onrender.com/brain/question",
            PersonalJarvisConfig.founderBrainQuestionEndpointFrom("https://mykeyboard.onrender.com")
        )
        assertEquals(
            "https://mykeyboard.onrender.com/brain/question",
            PersonalJarvisConfig.founderBrainQuestionEndpointFrom("https://mykeyboard.onrender.com/brain")
        )
        assertEquals(
            "https://mykeyboard.onrender.com/brain/question",
            PersonalJarvisConfig.founderBrainQuestionEndpointFrom("https://mykeyboard.onrender.com/brain/question")
        )
    }
}
