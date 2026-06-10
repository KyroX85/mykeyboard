package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PersonalOperatorDecisionLayerTest {
    @Test
    fun emptyInputsDoNotInventDecision() {
        val decision = PersonalOperatorDecisionLayer.decide(
            realitySnapshot = RealitySnapshot(),
            personalSnapshot = PersonalSnapshot(),
            projectSnapshot = ProjectSnapshot()
        )

        assertTrue(decision.currentPriorities.isEmpty())
        assertNull(decision.recommendedNextAction)
        assertNull(decision.reason)
        assertEquals(
            "I do not have enough verified reality, personal, or project data to decide.",
            PersonalOperatorDecisionFormatter.voiceSummary(decision)
        )
    }

    @Test
    fun criticalBlockerBeatsSchoolAndAritenis() {
        val decision = PersonalOperatorDecisionLayer.decide(
            realitySnapshot = RealitySnapshot(
                currentBlockers = listOf("remote APK distribution failed"),
                currentMilestone = "personal operator"
            ),
            personalSnapshot = PersonalSnapshot(
                homeworkTasks = listOf("math worksheet")
            ),
            projectSnapshot = ProjectSnapshot(
                currentMilestone = "keyboard polish"
            )
        )

        assertEquals("Resolve blocker: remote APK distribution failed", decision.recommendedNextAction)
        assertEquals("A blocker is verified in current reality.", decision.reason)
    }

    @Test
    fun schoolComesBeforeHealthAndAritenisWhenNoCriticalDeadlineExists() {
        val decision = PersonalOperatorDecisionLayer.decide(
            realitySnapshot = RealitySnapshot(recentProgress = listOf("debug APK assembled")),
            personalSnapshot = PersonalSnapshot(
                homeworkTasks = listOf("physics notes"),
                manualCommitments = listOf("sleep by 10pm")
            ),
            projectSnapshot = ProjectSnapshot(currentMilestone = "Jarvis operator")
        )

        assertEquals("Complete homework: physics notes", decision.recommendedNextAction)
        assertTrue(decision.currentPriorities.indexOf("Complete homework: physics notes") <
            decision.currentPriorities.indexOf("Handle health item: sleep by 10pm"))
        assertTrue(decision.currentPriorities.indexOf("Handle health item: sleep by 10pm") <
            decision.currentPriorities.indexOf("Work on Aritenis milestone: Jarvis operator"))
    }

    @Test
    fun formatterUsesStructuredFieldsWithoutMotivationalLanguage() {
        val decision = PersonalOperatorDecisionLayer.decide(
            realitySnapshot = RealitySnapshot(),
            personalSnapshot = PersonalSnapshot(homeworkTasks = listOf("chemistry assignment")),
            projectSnapshot = ProjectSnapshot()
        )
        val speech = PersonalOperatorDecisionFormatter.voiceSummary(decision)

        assertTrue(speech.contains("Current priorities:"))
        assertTrue(speech.contains("Recommended next action: Complete homework: chemistry assignment."))
        assertTrue(speech.contains("Reason: Homework is verified in personal awareness."))
        assertFalse(speech.contains("you can do it", ignoreCase = true))
        assertFalse(speech.contains("stay productive", ignoreCase = true))
    }

    @Test
    fun classifiesOperatorQuestions() {
        assertTrue(PersonalOperatorDecisionLayer.isOperatorQuestion("What should I do now?"))
        assertTrue(PersonalOperatorDecisionLayer.isOperatorQuestion("What is pending?"))
        assertTrue(PersonalOperatorDecisionLayer.isOperatorQuestion("What is most important today?"))
        assertFalse(PersonalOperatorDecisionLayer.isOperatorQuestion("Who am I becoming?"))
    }
}
