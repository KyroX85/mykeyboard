package com.example.mykeyboard.personal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PersonalSnapshotRuntimeTest {
    @Test
    fun blankPersonalFieldsBecomeNullInsteadOfGuessedValues() {
        val snapshot = PersonalSnapshotRuntime.capture(
            FakePersonalSnapshotBuildInfo(
                userEnteredSchedule = "",
                classTimings = "",
                badmintonTimings = "",
                jeeTimings = "",
                homeworkTasks = "",
                manualCommitments = "",
                snapshotVerifiedAt = ""
            )
        )

        assertNull(snapshot.userEnteredSchedule)
        assertNull(snapshot.classTimings)
        assertNull(snapshot.badmintonTimings)
        assertNull(snapshot.jeeTimings)
        assertNull(snapshot.homeworkTasks)
        assertNull(snapshot.manualCommitments)
        assertNull(snapshot.lastVerifiedTimestamp)
        assertFalse(snapshot.hasEvidence())
    }

    @Test
    fun capturesOnlyManualPersonalEvidence() {
        val snapshot = PersonalSnapshotRuntime.capture(
            FakePersonalSnapshotBuildInfo(
                userEnteredSchedule = "school 8am|revision 7pm",
                classTimings = "math 10am; physics 2pm",
                badmintonTimings = "6pm practice",
                jeeTimings = "chemistry 8pm",
                homeworkTasks = "math worksheet|english notes",
                manualCommitments = "call teacher; pack bag",
                snapshotVerifiedAt = "2026-06-08T10:00:00Z"
            )
        )

        assertEquals(listOf("school 8am", "revision 7pm"), snapshot.userEnteredSchedule)
        assertEquals(listOf("math 10am", "physics 2pm"), snapshot.classTimings)
        assertEquals(listOf("6pm practice"), snapshot.badmintonTimings)
        assertEquals(listOf("chemistry 8pm"), snapshot.jeeTimings)
        assertEquals(listOf("math worksheet", "english notes"), snapshot.homeworkTasks)
        assertEquals(listOf("call teacher", "pack bag"), snapshot.manualCommitments)
        assertEquals("2026-06-08T10:00:00Z", snapshot.lastVerifiedTimestamp)
        assertTrue(snapshot.hasEvidence())
    }

    @Test
    fun personalResponsesUseOnlySnapshotEvidence() {
        val snapshot = PersonalSnapshot(
            classTimings = listOf("math 10am", "physics 2pm"),
            homeworkTasks = listOf("math worksheet"),
            manualCommitments = listOf("pack bag")
        )

        assertEquals(
            "Pending today: homework: math worksheet; commitments: pack bag.",
            PersonalSnapshotResponseFormatter.voiceSummary(snapshot, "What is pending today?")
        )
        assertEquals(
            "Focus on homework first: math worksheet.",
            PersonalSnapshotResponseFormatter.voiceSummary(snapshot, "What should I focus on?")
        )
        assertEquals(
            "Verified class timings: math 10am, physics 2pm.",
            PersonalSnapshotResponseFormatter.voiceSummary(snapshot, "What classes are left?")
        )
    }

    @Test
    fun emptyPersonalSnapshotDoesNotInventAnswer() {
        assertEquals(
            "I do not have enough verified personal data yet.",
            PersonalSnapshotResponseFormatter.voiceSummary(PersonalSnapshot(), "What is pending today?")
        )
    }

    private data class FakePersonalSnapshotBuildInfo(
        override val userEnteredSchedule: String,
        override val classTimings: String,
        override val badmintonTimings: String,
        override val jeeTimings: String,
        override val homeworkTasks: String,
        override val manualCommitments: String,
        override val snapshotVerifiedAt: String
    ) : PersonalSnapshotBuildInfo
}
